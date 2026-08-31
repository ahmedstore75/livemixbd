const fs = require('fs');

async function fetchAndParseM3U(url, categoryFallback = "Live") {
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

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // ১. লোগো এক্সট্রাক্ট
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

        // ২. ক্যাটাগরি এক্সট্রাক্ট
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        const category = groupMatch ? groupMatch[1] : categoryFallback;

        // ৩. চ্যানেলের আসল নাম পার্সিং
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
          items.push({
            category_name: currentItem.category_name,
            name: currentItem.name,
            link: line,
            headers: { ...currentHeaders },
            logo: currentItem.logo
          });
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
    console.error(`Error fetching ${url}:`, error);
    return [];
  }
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';

  const [toffeeData, akashData] = await Promise.all([
    fetchAndParseM3U(url1, "Toffee Live"),
    fetchAndParseM3U(url2, "Akash Live")
  ]);

  const allChannels = [...toffeeData, ...akashData];

  const resultData = {
    status: "success",
    name: "Live Channels",
    owner: "Ahammad Ali",
    channels_amount: allChannels.length,
    last_update: new Date().toISOString().split('T')[0],
    response: allChannels
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json with owner "Ahammad Ali".`);
}

main();
