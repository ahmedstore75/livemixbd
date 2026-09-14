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

// ক্যাটাগরি আইডেন্টিফাই করার অ্যাডভান্সড ফাংশন
function getCategoryPriority(name) {
  const n = name.toLowerCase();

  // ১. বাংলাদেশ চ্যানেল
  const bdKeywords = [
    'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24', 
    'atn bangla', 'atn news', 'channel i', 'ntv', 'rtv', 'boishakhi', 'banglavision', 
    'desh tv', 'maasranga', 'gazi tv', 'gtv', 'nagorik', 'bijoy tv', 
    'my tv', 'asian tv', 'saampratik', 'ananda', 'deepto', 'duronto', 'btv', 'bangla tv', 'duronto tv'
  ];
  if (bdKeywords.some(key => n.includes(key))) return 1;

  // ২. কলকাতার বাংলা চ্যানেল
  const kolkataKeywords = [
    'star jalsha', 'zee bangla', 'colors bangla', 'sun bangla', 'sony aath', 
    'jalsha movies', 'zee bangla cinema', 'khabor 24', 'abp ananda', 'news18 bangla', 'ruposhi bangla'
  ];
  if (kolkataKeywords.some(key => n.includes(key))) return 2;

  // ৩. স্পোর্টস চ্যানেল
  const sportsKeywords = [
    'sport', 'sports', 'cricket', 'football', 'star sports', 'sony ten', 'ten 1', 
    'ten 2', 'ten 3', 'sports18', 'astro sports', 'willow', 'ptv sports', 'eurosport', 
    't sports', 'tapmad', 'dazn', 'bein sports', 'super sport', 'arena sport'
  ];
  if (sportsKeywords.some(key => n.includes(key))) return 3;

  // ৪. মুভি চ্যানেল
  const movieKeywords = [
    'movie', 'movies', 'cinema', 'hbo', 'star movies', 'sony pix', 'mnx', 'flix', 
    'cineplex', 'action', 'zee cinema', 'star gold', 'sony max', 'colors cineplex'
  ];
  if (movieKeywords.some(key => n.includes(key))) return 4;

  // ৫. সাধারণ বিনোদন ও ড্রামা (Entertainment)
  const dramaKeywords = [
    'star plus', 'zee tv', 'sony tv', 'colors tv', 'sab tv', 'star bharat', 
    'dangal', 'bindass', 'tlc', 'e!', 'axn', 'fx', 'wb'
  ];
  if (dramaKeywords.some(key => n.includes(key))) return 5;

  // ৬. ইনফোটেইনমেন্ট ও ডকুমেন্টারি
  const docKeywords = [
    'discovery', 'national geographic', 'nat geo', 'animal planet', 
    'history', 'investigation', 'natgeo', 'science', 'earth', 'bbc earth'
  ];
  if (docKeywords.some(key => n.includes(key))) return 6;

  // ৭. কিডস / শিশুদের চ্যানেল
  const kidsKeywords = [
    'cartoon', 'nick', 'pogo', 'disney', 'hungama', 'sonic', 'kids', 'baby', 'marvel', 'aniplus'
  ];
  if (kidsKeywords.some(key => n.includes(key))) return 7;

  // ৮. মিউজিক চ্যানেল
  const musicKeywords = [
    'music', 'song', 'mtv', 'sangeet', '9xm', 'zoOm', 'vh1', 'clubland', 'b4u music'
  ];
  if (musicKeywords.some(key => n.includes(key))) return 8;

  // ৯. আন্তর্জাতিক ও সাধারণ সংবাদ
  const newsKeywords = [
    'bbc news', 'cnn', 'al jazeera', 'reuters', 'ndtv', 'india today', 'aaj tak', 
    'republic', 'dw', 'france 24', 'news'
  ];
  if (newsKeywords.some(key => n.includes(key))) return 9;

  // ১০. ধর্মীয় (Religious)
  const religiousKeywords = [
    'islam', 'makkah', 'madinah', 'peace tv', 'quran', 'peacetv', 'bhakti', 'god', 'hajj'
  ];
  if (religiousKeywords.some(key => n.includes(key))) return 10;

  // ১১. লাইফস্টাইল ও ফুড
  const lifestyleKeywords = [
    'food', 'cooking', 'chef', 'lifestyle', 'travel', 'fashion'
  ];
  if (lifestyleKeywords.some(key => n.includes(key))) return 11;

  // ১২. অন্যান্য চ্যানেল
  return 12;
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

  const allRawChannels = [...toffeeData, ...tapmadData, ...fastIptvData];

  const seenUrls = new Set();
  const filteredChannels = [];
  const yearPattern = /\(\d{4}\)/;

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

  // ক্যাটাগরি ও ১, ২, ৩ ডিজিট অর্ডারে সম্পূর্ণ সর্ট করা
  filteredChannels.sort((a, b) => {
    const catA = getCategoryPriority(a.name);
    const catB = getCategoryPriority(b.name);

    if (catA !== catB) {
      return catA - catB;
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

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
  console.log(`Successfully generated playlist.json with ${finalChannels.length} unique channels.`);
}

main();
