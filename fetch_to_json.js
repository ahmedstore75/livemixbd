const fs = require('fs');

// M3U ফাইল পার্স করার ফাংশন
async function fetchAndParseM3U(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) {
      console.error(`Fetch failed for ${url} with status: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const lines = text.split('\n');
    const items = [];

    let currentItem = {};
    let currentCookie = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

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
          name: channelName,
          logo: logo
        };
      } else if (line.startsWith('#EXTHTTP:')) {
        try {
          const jsonStr = line.replace('#EXTHTTP:', '').trim();
          const parsedHttp = JSON.parse(jsonStr);
          currentCookie = parsedHttp.cookie || parsedHttp.Cookie || "";
        } catch (e) {
          const cookieMatch = line.match(/Edge-[^"\s]+/i);
          if (cookieMatch) {
            currentCookie = cookieMatch[0];
          }
        }
      } else if (!line.startsWith('#')) {
        if (currentItem.name) {
          items.push({
            name: currentItem.name,
            logo: currentItem.logo,
            stream_url: line,
            cookie: currentCookie
          });
        }

        currentItem = {};
        currentCookie = "";
      }
    }
    return items;
  } catch (error) {
    console.error(`Error fetching M3U ${url}:`, error.message);
    return [];
  }
}

// মূল প্রসেসিং
async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Tapmad_Auto_Update_Playlist/refs/heads/main/Tapmad_sm.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url3 = 'https://raw.githubusercontent.com/ahan443/FAST-IPTV/refs/heads/main/z.m3u';

  console.log("Fetching channels...");

  const [toffeeData, akashData, fastIptvData] = await Promise.all([
    fetchAndParseM3U(url1),
    fetchAndParseM3U(url2),
    fetchAndParseM3U(url3)
  ]);

  console.log(`Toffee channels: ${toffeeData.length}`);
  console.log(`Akash channels: ${akashData.length}`);
  console.log(`FAST IPTV channels: ${fastIptvData.length}`);

  const rawChannels = [...toffeeData, ...akashData, ...fastIptvData];

  const seenUrls = new Set();
  const filteredChannels = [];
  let idCounter = 1;

  // ব্র্যাকেটে যেকোনো ৪ ডিজিটের সাল চেনার জন্য Regex Pattern
  const yearPattern = /\(\d{4}\)/;

  for (const channel of rawChannels) {
    const streamUrl = channel.stream_url;
    const channelName = channel.name ? channel.name.trim() : "";

    if (!streamUrl) continue;

    // ১. "Program Promo" ফিল্টার করা
    if (channelName.toLowerCase() === "program promo") {
      continue;
    }

    // ২. চ্যানেলের নামের শেষে বা মাঝে ব্র্যাকেটে কোনো সাল (যেমন: (2026)) থাকলে তা স্কিপ করা
    if (yearPattern.test(channelName)) {
      continue;
    }

    if (!seenUrls.has(streamUrl)) {
      seenUrls.add(streamUrl);
      filteredChannels.push({
        id: idCounter++,
        name: channelName,
        logo: channel.logo,
        stream_url: channel.stream_url,
        cookie: channel.cookie || ""
      });
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
