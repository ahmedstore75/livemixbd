const fs = require('fs');

// ১. M3U ফাইল পার্স করার ফাংশন
async function fetchAndParseM3U(url, categoryFallback = "Live") {
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
          } else if (parsedHttp.Cookie) {
            currentCookie = parsedHttp.Cookie;
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

// ২. ৩ নম্বর JSON লিংক থেকে ডাটা আনার ফাংশন
async function fetchJsonData(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      console.error(`JSON fetch failed with status: ${response.status}`);
      return [];
    }

    const json = await response.json();
    let rawList = [];

    if (Array.isArray(json)) {
      rawList = json;
    } else if (json && typeof json === 'object') {
      if (Array.isArray(json.response)) rawList = json.response;
      else if (Array.isArray(json.channels)) rawList = json.channels;
      else if (Array.isArray(json.data)) rawList = json.data;
      else if (Array.isArray(json.channel)) rawList = json.channel;
      else if (Array.isArray(json.categories)) {
        json.categories.forEach(cat => {
          if (Array.isArray(cat.channels)) rawList.push(...cat.channels);
        });
      }
    }

    return rawList.map(ch => {
      // কুকি খুঁজে নেওয়া
      let extractCookie = ch.cookie || "";
      if (!extractCookie && ch.headers) {
        extractCookie = ch.headers.cookie || ch.headers.Cookie || "";
      }

      return {
        name: ch.name || ch.title || ch.channel_name || "Unknown Channel",
        logo: ch.logo || ch.icon || ch.image || "",
        stream_url: ch.stream_url || ch.link || ch.url || ch.streamUrl || "",
        cookie: extractCookie
      };
    }).filter(ch => ch.stream_url !== "");

  } catch (error) {
    console.error(`Error fetching JSON from ${url}:`, error.message);
    return [];
  }
}

// ৩. মূল প্রসেসিং
async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';
  const url3 = 'https://raw.githubusercontent.com/sm-monirulislam/Upcoming-and-Live-Sports-Data/refs/heads/main/Sports_data.m3u';

  console.log("Fetching channels...");

  const [toffeeData, akashData, extraJsonData] = await Promise.all([
    fetchAndParseM3U(url1, "Toffee Live"),
    fetchAndParseM3U(url2, "Akash Live"),
    fetchJsonData(url3)
  ]);

  console.log(`Toffee channels: ${toffeeData.length}`);
  console.log(`Akash channels: ${akashData.length}`);
  console.log(`Extra JSON channels: ${extraJsonData.length}`);

  const rawChannels = [...toffeeData, ...akashData, ...extraJsonData];

  // ফিল্টারিং: স্ট্রিমিং ইউআরএল প্লেলিস্টে সর্বোচ্চ ১ বারই থাকবে (ইউনিক)
  const seenUrls = new Set();
  const filteredChannels = [];
  let idCounter = 1;

  for (const channel of rawChannels) {
    const streamUrl = channel.stream_url;
    if (!streamUrl) continue;

    if (!seenUrls.has(streamUrl)) {
      seenUrls.add(streamUrl);
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
