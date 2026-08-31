const fs = require('fs');

// ১. M3U ফাইল পার্স করার ফাংশন
async function fetchAndParseM3U(url, categoryFallback = "Live", isAkash = false) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const text = await response.text();
    const lines = text.split('\n');
    const items = [];

    let currentItem = {};
    
    // Toffee এর জন্য কার্যকরী ডিফল্ট হেডার
    let currentHeaders = {
      "user-agent": "Toffee/3.0.0 (Linux; Android 10; Mobile)",
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
          "user-agent": "Toffee/3.0.0 (Linux; Android 10; Mobile)",
          "client-api-header": "null",
          "accept-encoding": "gzip"
        };
      }
    }
    return items;
  } catch (error) {
    console.error(`Error fetching M3U ${url}:`, error.message);
    return [];
  }
}

// ২. JSON লিংক থেকে ডাটা আনার ফাংশন
async function fetchJsonData(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) return [];

    const json = await response.json();
    let rawList = [];

    if (Array.isArray(json)) {
      rawList = json;
    } else if (json && typeof json === 'object') {
      if (Array.isArray(json.response)) rawList = json.response;
      else if (Array.isArray(json.channels)) rawList = json.channels;
      else if (Array.isArray(json.data)) rawList = json.data;
      else if (Array.isArray(json.channel)) rawList = json.channel;
    }

    return rawList.map(ch => ({
      category_name: ch.category_name || ch.category || "Live",
      name: ch.name || ch.title || "Unknown Channel",
      link: ch.link || ch.stream_url || ch.url || "",
      headers: ch.headers || (ch.cookie ? { "cookie": ch.cookie } : {
        "user-agent": "Toffee/3.0.0 (Linux; Android 10; Mobile)",
        "client-api-header": "null",
        "accept-encoding": "gzip"
      }),
      logo: ch.logo || ch.icon || ""
    })).filter(ch => ch.link !== "");

  } catch (error) {
    console.error(`Error fetching JSON from ${url}:`, error.message);
    return [];
  }
}

// ৩. মেইন প্রসেসিং
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

  // ফিল্টারিং: স্ট্রিমিং ইউআরএল সর্বোচ্চ ১ বারই থাকবে (ইউনিক)
  const seenUrls = new Set();
  const filteredChannels = [];

  for (const channel of rawChannels) {
    const streamUrl = channel.link || channel.stream_url;
    if (!streamUrl) continue;

    if (!seenUrls.has(streamUrl)) {
      seenUrls.add(streamUrl);
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
  console.log(`Successfully generated playlist.json with ${filteredChannels.length} unique channels.`);
}

main();
