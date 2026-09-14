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

// ১. মূল ক্যাটাগরি আইডি বের করার ফাংশন
function getCategoryPriority(name) {
  const n = name.toLowerCase();

  // ১. বাংলাদেশ ও সাধারণ বাংলা চ্যানেল
  const bdKeywords = [
    'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24', 
    'atn bangla', 'atn news', 'channel i', 'ntv', 'rtv', 'boishakhi', 'banglavision', 
    'desh tv', 'maasranga', 'gazi tv', 'gtv', 't sports', 'nagorik', 'bijoy tv', 
    'my tv', 'asian tv', 'saampratik', 'ananda', 'deepto', 'duronto', 'btv'
  ];
  if (bdKeywords.some(key => n.includes(key))) return 1;

  // ২. কলকাতার বাংলা চ্যানেল
  const kolkataKeywords = [
    'star jalsha', 'zee bangla', 'colors bangla', 'sun bangla', 'sony aath', 
    'jalsha movies', 'zee bangla cinema', 'khabor 24', 'abp ananda', 'news18 bangla'
  ];
  if (kolkataKeywords.some(key => n.includes(key))) return 2;

  // ৩. স্পোর্টস চ্যানেল
  const sportsKeywords = [
    'sport', 'sports', 'cricket', 'football', 'star sports', 'sony ten', 'ten 1', 
    'ten 2', 'ten 3', 'sports18', 'astro sports', 'willow', 'ptv sports', 'eurosport', 't sports'
  ];
  if (sportsKeywords.some(key => n.includes(key))) return 3;

  // ৪. মিউজিক এবং কিডস চ্যানেল
  const musicKidsKeywords = [
    'music', 'song', 'mtv', 'sangeet', 'cartoon', 'nick', 'pogo', 'disney', 
    'hungama', 'sonic', 'discovery kids', 'kids'
  ];
  if (musicKidsKeywords.some(key => n.includes(key))) return 4;

  // ৫. ডকুমেন্টারি চ্যানেল
  const docKeywords = [
    'discovery', 'national geographic', 'nat geo', 'animal planet', 
    'history', 'investigation', 'natgeo'
  ];
  if (docKeywords.some(key => n.includes(key))) return 5;

  // ৬. অন্যান্য চ্যানেল
  return 6;
}

// ২. একই ক্যাটাগরির ভেতর ১, ২, ৩ ক্রম অনুযায়ী নাম অনুসারে সর্ট করার ফাংশন
function sortChannelsSmartly(channels) {
  return channels.sort((a, b) => {
    const catA = getCategoryPriority(a.name);
    const catB = getCategoryPriority(b.name);

    // আগে ক্যাটাগরি অনুযায়ী ভাগ হবে
    if (catA !== catB) {
      return catA - catB;
    }

    // একই ক্যাটাগরি হলে নাম এবং নম্বর ধরে অ্যালফাবেটিকালি সাজানো হবে (যেমন: Sony Ten 1, Sony Ten 2)
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

// মূল প্রসেসিং
async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Tapmad_Auto_Update_Playlist/refs/heads/main/Tapmad_sm.m3u';
  const url2 = 'https://raw.githubusercontent.com/srhady/toffee-bd/refs/heads/main/toffee_playlist.m3u';
  const url3 = 'https://raw.githubusercontent.com/ahan443/FAST-IPTV/refs/heads/main/z.m3u';

  console.log("Fetching channels...");

  const [tapmadData, toffeeData, fastIptvData] = await Promise.all([
    fetchAndParseM3U(url1),
    fetchAndParseM3U(url2),
    fetchAndParseM3U(url3)
  ]);

  console.log(`Tapmad channels: ${tapmadData.length}`);
  console.log(`Toffee channels: ${toffeeData.length}`);
  console.log(`FAST IPTV channels: ${fastIptvData.length}`);

  // ২ নম্বর ফাইলের (Toffee) চ্যানেলগুলোকে ক্যাটাগরি ও ১, ২, ৩ সিকোয়েন্স অনুসারে সর্ট করা
  const sortedToffeeData = sortChannelsSmartly(toffeeData);

  // ১ ও ৩ নম্বরের চ্যানেলগুলোকেও ক্যাটাগরি অনুযায়ী সাজানো
  const sortedTapmadData = sortChannelsSmartly(tapmadData);
  const sortedFastIptvData = sortChannelsSmartly(fastIptvData);

  // প্রথমে সর্ট করা ২ নম্বর (Toffee), এরপর ১ নম্বর ও ৩ নম্বর চ্যানেল যুক্ত হবে
  const rawChannels = [...sortedToffeeData, ...sortedTapmadData, ...sortedFastIptvData];

  const seenUrls = new Set();
  const filteredChannels = [];
  let idCounter = 1;

  const yearPattern = /\(\d{4}\)/;

  for (const channel of rawChannels) {
    const streamUrl = channel.stream_url;
    const channelName = channel.name ? channel.name.trim() : "";

    if (!streamUrl) continue;

    // "Program Promo" এবং ব্র্যাকেটে সাল ফিল্টার করা
    if (channelName.toLowerCase() === "program promo" || yearPattern.test(channelName)) {
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
