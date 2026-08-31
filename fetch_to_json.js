const fs = require('fs');

async function fetchAndParseM3U(url, categoryFallback = "Live") {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
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
          if (parsedHttp.cookie) {
            currentCookie = parsedHttp.cookie;
          }
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

async function fetchJsonData(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    if (!response.ok) return [];
    const json = await response.json();
    let rawList = Array.isArray(json) ? json : (json.response || json.channels || json.data || []);

    return rawList.map(ch => ({
      name: ch.name || ch.title || "Unknown Channel",
      logo: ch.logo || ch.icon || "",
      stream_url: ch.stream_url || ch.link || ch.url || "",
      cookie: ch.cookie || (ch.headers && ch.headers.cookie ? ch.headers.cookie : "")
    })).filter(ch => ch.stream_url !== "");
  } catch (error) {
    return [];
  }
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';
  const url3 = 'https://sm-monirul.top/api/app/info/channel_data.json';

  const [toffeeData, akashData, extraJsonData] = await Promise.all([
    fetchAndParseM3U(url1, "Toffee Live"),
    fetchAndParseM3U(url2, "Akash Live"),
    fetchJsonData(url3)
  ]);

  const rawChannels = [...toffeeData, ...akashData, ...extraJsonData];

  const seenUrls = new Set();
  const filteredChannels = [];
  let idCounter = 1;

  for (const channel of rawChannels) {
    if (channel.stream_url && !seenUrls.has(channel.stream_url)) {
      seenUrls.add(channel.stream_url);
      filteredChannels.push({
        id: idCounter++,
        name: channel.name,
        logo: channel.logo,
        stream_url: channel.stream_url,
        cookie: channel.cookie
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
  console.log(`Generated playlist.json with ${filteredChannels.length} channels in unified format.`);
}

main();
