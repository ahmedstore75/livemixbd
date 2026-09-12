const fs = require('fs');

async function debugJsonFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log(`JSON HTTP Status: ${response.status}`);
    const rawText = await response.text();
    console.log(`JSON Raw Response Preview: ${rawText.substring(0, 300)}...`);

    if (!response.ok || !rawText) return [];

    const json = JSON.parse(rawText);
    // যদি JSON অবজেক্ট বা অ্যারে আকারে থাকে
    let list = Array.isArray(json) ? json : (json.response || json.channels || json.data || []);
    
    return list.map(ch => ({
      name: ch.name || ch.title || "Unknown",
      logo: ch.logo || ch.icon || "",
      stream_url: ch.stream_url || ch.link || ch.url || "",
      cookie: ch.cookie || (ch.headers ? ch.headers.cookie : "") || ""
    })).filter(ch => ch.stream_url);

  } catch (error) {
    console.error("JSON Fetch Error:", error.message);
    return [];
  }
}

// ১. M3U ফাইল পার্স করার ফাংশন
async function fetchAndParseM3U(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
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
        const lastCommaIndex = line.lastIndexOf(',');
        const channelName = lastCommaIndex !== -1 ? line.substring(lastCommaIndex + 1).trim() : 'Unknown Channel';

        currentItem = { name: channelName, logo: logo };
      } else if (line.startsWith('#EXTHTTP:')) {
        try {
          const parsedHttp = JSON.parse(line.replace('#EXTHTTP:', '').trim());
          currentCookie = parsedHttp.cookie || parsedHttp.Cookie || "";
        } catch (e) {
          const cookieMatch = line.match(/Edge-[^"\s]+/i);
          if (cookieMatch) currentCookie = cookieMatch[0];
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
    return [];
  }
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Tapmad_Auto_Update_Playlist/refs/heads/main/Tapmad_sm.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url3 = 'https://sm-monirul.top/api/app/info/channel_data.json';

  console.log("Fetching channels...");

  const [toffeeData, akashData, extraJsonData] = await Promise.all([
    fetchAndParseM3U(url1),
    fetchAndParseM3U(url2),
    debugJsonFetch(url3)
  ]);

  console.log(`Toffee channels: ${toffeeData.length}`);
  console.log(`Akash channels: ${akashData.length}`);
  console.log(`Extra JSON channels: ${extraJsonData.length}`);

  const rawChannels = [...toffeeData, ...akashData, ...extraJsonData];
  const seenUrls = new Set();
  const filteredChannels = [];
  let idCounter = 1;

  for (const channel of rawChannels) {
    if (!channel.stream_url) continue;

    if (!seenUrls.has(channel.stream_url)) {
      seenUrls.add(channel.stream_url);
      filteredChannels.push({
        id: idCounter++,
        name: channel.name,
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
