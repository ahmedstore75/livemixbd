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

// ক্যাটাগরি আইডেন্টিফাই করার ফাংশন
function getCategoryPriority(name) {
  const n = name.toLowerCase();

  // ১. বাংলাদেশ চ্যানেল
  const bdKeywords = [
    'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24', 
    'atn bangla', 'atn news', 'channel i', 'ntv', 'rtv', 'boishakhi', 'banglavision', 
    'desh tv', 'maasranga', 'gazi tv', 'gtv', 'nagorik', 'bijoy tv', 
    'my tv', 'asian tv', 'saampratik', 'ananda', 'deepto', 'duronto', 'btv'
  ];
  if (bdKeywords.some(key => n.includes(key))) return 1;

  // ২. কলকাতার বাংলা চ্যানেল
  const kolkataKeywords = [
    'star jalsha', 'zee bangla', 'colors bangla', 'sun bangla', 'sony aath', 
    'jalsha movies', 'zee bangla cinema', 'khabor 24', 'abp ananda', 'news18 bangla'
  ];
  if (kolkataKeywords.some(key => n.includes(key))) return 2;

  // ৩. স্পোর্টস চ্যানেল (T Sports সহ)
  const sportsKeywords = [
    'sport', 'sports', 'cricket', 'football', 'star sports', 'sony ten', 'ten 1', 
    'ten 2', 'ten 3', 'sports18', 'astro sports', 'willow', 'ptv sports', 'eurosport', 't sports', 'tapmad'
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

  // ১, ২ ও ৩ সব লিংক থেকে পাওয়া সব চ্যানেল একসাথে মেলানো
  const allRawChannels = [...toffeeData, ...tapmadData, ...fastIptvData];

  const seenUrls = new Set();
  const filteredChannels = [];
  const yearPattern = /\(\d{4}\)/;

  // ডুপ্লিকেট ইউআরএল এবং অপ্রয়োজনীয় চ্যানেল ফিল্টার করা
  for (const channel of allRawChannels) {
    const streamUrl = channel.stream_url;
    const channelName = channel.name ? channel.name.trim() : "";

    if (!streamUrl) continue;

    if (channelName.toLowerCase() === "program promo" || yearPattern.test(channelName)) {
      continue;
    }

    if (!seenUrls.has(streamUrl)) {
      seenUrls.add(streamUrl);
      filteredChannels.push({
        name: channelName,
        logo: channel.logo,
        stream_url: channel.stream_url,
        cookie: channel.cookie || ""
      });
    }
  }

  // পুরো প্লেলিস্ট একসাথে ক্যাটাগরি ও নাম/নম্বর সিকোয়েন্স অনুযায়ী সর্ট করা
  filteredChannels.sort((a, b) => {
    const catA = getCategoryPriority(a.name);
    const catB = getCategoryPriority(b.name);

    if (catA !== catB) {
      return catA - catB;
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  // আইডি নম্বর (1, 2, 3...) নতুন করে অ্যাসাইন করা
  const finalChannels = filteredChannels.map((ch, index) => ({
    id: index + 1,
    ...ch
  }));

  const resultData = {
    status: "success",
    name: "Live Channels",
    owner: "Ahammad Ali",
    channels_amount: finalChannels.length,
    last_update: new Date().toISOString().split('T')[0],
    response: finalChannels
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json with ${finalChannels.length} unique channels sorted by categories.`);
}

main();
