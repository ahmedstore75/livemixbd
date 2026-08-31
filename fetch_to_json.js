const fs = require('fs');

// M3U ফাইল পার্স করার ফাংশন
async function fetchAndParseM3U(url, categoryFallback = "Live", isAkash = false) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const items = [];

    let currentItem = {};
    let currentHeaders = {
      "user-agent": "okhttp/5.1.0",
      "client-api-header": "null",
      "accept-encoding": "gzip"
    };

    let globalIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        const category = groupMatch ? groupMatch[1] : categoryFallback;

        let channelName = '';
        const lastCommaIndex = line.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
          channelName = line.substring(lastCommaIndex + 1).trim();
        }

        if (!channelName) {
          const nameMatch = line.match(/tvg-name="([^"]+)"/i);
          channelName = nameMatch ? nameMatch[1] : 'Unknown Channel';
        }

        currentItem = {
          category_name: category,
          name: channelName,
          logo: logo
        };
      } else if (line.startsWith('#EXTHTTP:')) {
        try {
          const jsonStr = line.replace('#EXTHTTP:', '').trim();
          const parsedHttp = JSON.parse(jsonStr);
          
          Object.keys(parsedHttp).forEach(key => {
            currentHeaders[key.toLowerCase()] = parsedHttp[key];
          });
        } catch (e) {
          const cookieContent = line.replace('#EXTHTTP:', '').replace(/[\{\}"]/g, '').trim();
          if (cookieContent) {
            const parts = cookieContent.split(':');
            if (parts.length >= 2) {
              const k = parts[0].trim().toLowerCase();
              const v = parts.slice(1).join(':').trim();
              currentHeaders[k] = v;
            } else {
              currentHeaders["cookie"] = cookieContent;
            }
          }
        }
      } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
        currentHeaders["user-agent"] = line.replace('#EXTVLCOPT:http-user-agent=', '').trim();
      } else if (!line.startsWith('#')) {
        if (currentItem.name) {
          if (isAkash) {
            items.push({
              id: globalIndex++,
              name: currentItem.name,
              logo: currentItem.logo,
              stream_url: line,
              cookie: currentHeaders["cookie"] || ""
            });
          } else {
            items.push({
              category_name: currentItem.category_name,
              name: currentItem.name,
              link: line,
              headers: { ...currentHeaders },
              logo: currentItem.logo
            });
          }
        }

        currentItem = {};
        currentHeaders = {
          "user-agent": "okhttp/5.1.0",
          "client-api-header": "null",
          "accept-encoding": "gzip"
        };
      }
    }
    return items;
  } catch (error) {
    console.error(`Error fetching M3U ${url}:`, error);
    return [];
  }
}

// নতুন JSON লিংক থেকে ডাটা আনার ফাংশন
async function fetchJsonData(url) {
  try {
    const response = await fetch(url);
    const json = await response.json();
    
    // ডাটা যদি কোনো নির্দিষ্ট 'response' অ্যারের মধ্যে থাকে তা হ্যান্ডেল করা
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.response)) return json.response;
    if (Array.isArray(json.channels)) return json.channels;
    if (Array.isArray(json.data)) return json.data;

    return [];
  } catch (error) {
    console.error(`Error fetching JSON ${url}:`, error);
    return [];
  }
}

// মূল এক্সিকিউশন
async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';
  const url3 = 'https://sm-monirul.top/api/app/info/channel_data.json';

  const [toffeeData, akashData, extraJsonData] = await Promise.all([
    fetchAndParseM3U(url1, "Toffee Live", false),
    fetchAndParseM3U(url2, "Akash Live", true),
    fetchJsonData(url3)
  ]);

  const rawChannels = [...toffeeData, ...akashData, ...extraJsonData];

  // ফিল্টারিং: একই স্ট্রিম লিংক প্লেলিস্টে সর্বোচ্চ ২ বারই আসতে পারবে
  const urlCountMap = new Map();
  const filteredChannels = [];

  for (const channel of rawChannels) {
    const streamUrl = channel.link || channel.stream_url;
    if (!streamUrl) continue;

    const count = urlCountMap.get(streamUrl) || 0;
    if (count < 2) {
      urlCountMap.set(streamUrl, count + 1);
      filteredChannels.push(channel);
    }
  }

  const resultData = {
    status: "success",
    name: "Live Channels",
    owner: "Ahammad Ali",
    channels_amount: filteredChannels.length,
    last_update: new Date().toISOString().split('T')[0],
    response: filteredChannels
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json with ${filteredChannels.length} channels.`);
}

main();
