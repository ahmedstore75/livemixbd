const fs = require('fs');

// Fetch এর জন্য টাইমআউট অপশনসহ M3U পার্স করার ফাংশন
async function fetchAndParseM3U(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Fetch failed for ${url} with status: ${response.status}`);
      return [];
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);
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
    if (error.name === 'AbortError') {
      console.error(`Error: Request timed out for ${url}`);
    } else {
      console.error(`Error fetching M3U ${url}:`, error.message);
    }
    return [];
  }
}

// জনপ্রিয় চ্যানেলগুলোর তালিকা
const popularBdChannelsOrder = [
  'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24',
  't sports', 'gtv', 'gazi tv', 'ntv', 'rtv', 'channel i', 'atn bangla', 'atn news',
  'maasranga', 'deepto', 'banglavision', 'boishakhi', 'desh tv', 'nagorik', 'btv'
];

function getPopularBDIndex(name) {
  const n = name.toLowerCase();
  for (let i = 0; i < popularBdChannelsOrder.length; i++) {
    if (n.includes(popularBdChannelsOrder[i])) {
      return i;
    }
  }
  return 999;
}

// ক্যাটাগরি পার্সিং
function getCategoryPriority(name) {
  const n = name.toLowerCase();

  const isMohona = /mohona/i.test(n);
  const bdKeywords = [
    'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24', 
    'atn bangla', 'atn news', 'channel i', 'ntv', 'rtv', 'boishakhi', 'banglavision', 
    'desh tv', 'maasranga', 'gazi tv', 'gtv', 'nagorik', 'bijoy tv', 
    'my tv', 'asian tv', 'saampratik', 'ananda', 'deepto', 'duronto', 'btv', 'bangla tv',
    'channel s', 'ekhon', 'global tv', 'nexus', 'rajdhani', 't sports'
  ];
  if (isMohona || bdKeywords.some(key => n.includes(key))) return 1;

  const kolkataKeywords = [
    'star jalsha', 'zee bangla', 'colors bangla', 'sun bangla', 'sony aath', 
    'jalsha movies', 'zee bangla cinema', 'khabor 24', 'abp ananda', 'news18 bangla'
  ];
  if (kolkataKeywords.some(key => n.includes(key))) return 2;

  const sportsKeywords = [
    'sport', 'sports', 'cricket', 'football', 'star sports', 'sony ten', 'ten 1', 
    'ten 2', 'ten 3', 'sports18', 'astro sports', 'willow', 'ptv sports', 'eurosport', 
    'tapmad', 'dazn', 'bein sports', 'super sport'
  ];
  if (sportsKeywords.some(key => n.includes(key))) return 3;

  const isAndPictures = /(&|and|&amp;)\s*picture/i.test(n);
  const movieKeywords = [
    'movie', 'movies', 'cinema', 'hbo', 'star movies', 'sony pix', 'mnx', 'flix', 
    'cineplex', 'action', 'zee cinema', 'star gold', 'sony max', 'colors cineplex'
  ];
  if (isAndPictures || movieKeywords.some(key => n.includes(key))) return 4;

  const dramaKeywords = [
    'star plus', 'zee tv', 'sony tv', 'colors tv', 'sab tv', 'star bharat', 
    'dangal', 'bindass', 'tlc', 'e!', 'axn'
  ];
  if (dramaKeywords.some(key => n.includes(key))) return 5;

  const docKeywords = [
    'discovery', 'national geographic', 'nat geo', 'animal planet', 
    'history', 'investigation', 'natgeo', 'science', 'bbc earth'
  ];
  if (docKeywords.some(key => n.includes(key))) return 6;

  const kidsKeywords = [
    'cartoon', 'nick', 'pogo', 'disney', 'hungama', 'sonic', 'kids', 'baby', 'sony yay', 'yay'
  ];
  if (kidsKeywords.some(key => n.includes(key))) return 7;

  const musicKeywords = [
    'music', 'song', 'mtv', 'sangeet', '9xm', 'zoom', 'vh1'
  ];
  if (musicKeywords.some(key => n.includes(key))) return 8;

  const newsKeywords = [
    'bbc news', 'cnn', 'al jazeera', 'ndtv', 'india today', 'aaj tak', 'republic', 
    'dw', 'france 24', 'cgtn', 'russia today', 'rt news', 'trt world', 'news'
  ];
  if (newsKeywords.some(key => n.includes(key))) return 9;

  const religiousKeywords = [
    'islam', 'makkah', 'madinah', 'sunnah', 'peace tv', 'quran', 'peacetv', 'bhakti', 'saudi sunnah'
  ];
  if (religiousKeywords.some(key => n.includes(key))) return 10;

  return 11;
}

function filterChannelsOnly(channels, seenUrls) {
  const yearPattern = /\(\d{4}\)/;
  const filtered = [];

  for (const channel of channels) {
    const streamUrl = channel.stream_url;
    const channelName = channel.name ? channel.name.trim() : "";

    if (!streamUrl) continue;

    if (channelName.toLowerCase() === "program promo" || yearPattern.test(channelName)) {
      continue;
    }

    if (!seenUrls.has(streamUrl)) {
      seenUrls.add(streamUrl);
      filtered.push({
        name: channelName,
        logo: channel.logo,
        stream_url: channel.stream_url,
        cookie: channel.cookie || ""
      });
    }
  }

  return filtered;
}

function processAndSortLink2(channels, seenUrls) {
  const filtered = filterChannelsOnly(channels, seenUrls);

  filtered.sort((a, b) => {
    const catA = getCategoryPriority(a.name);
    const catB = getCategoryPriority(b.name);

    if (catA !== catB) {
      return catA - catB;
    }

    if (catA === 1) {
      const popA = getPopularBDIndex(a.name);
      const popB = getPopularBDIndex(b.name);

      if (popA !== popB) {
        return popA - popB;
      }
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return filtered;
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/srhady/SonyLiv/refs/heads/main/sonyliv_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/srhady/toffee-bd/refs/heads/main/toffee_playlist.m3u';
  const url3 = 'https://raw.githubusercontent.com/ahan443/FAST-IPTV/refs/heads/main/z.m3u';

  console.log("Fetching channels...");

  const [tapmadData, toffeeData, fastIptvData] = await Promise.all([
    fetchAndParseM3U(url1),
    fetchAndParseM3U(url2),
    fetchAndParseM3U(url3)
  ]);

  const seenUrls = new Set();

  const tapmadChannels = filterChannelsOnly(tapmadData, seenUrls);
  const sortedToffeeChannels = processAndSortLink2(toffeeData, seenUrls);
  const fastIptvChannels = filterChannelsOnly(fastIptvData, seenUrls);

  const allFinalChannels = [...tapmadChannels, ...sortedToffeeChannels, ...fastIptvChannels];

  const finalResponse = allFinalChannels.map((ch, index) => ({
    id: index + 1,
    name: ch.name,
    logo: ch.logo,
    stream_url: ch.stream_url,
    cookie: ch.cookie
  }));

  const todayDate = new Date().toISOString().split('T')[0];

  const resultData = {
    status: "success",
    name: "Live Channels",
    owner: "Ahammad Ali",
    channels_amount: finalResponse.length,
    last_update: todayDate,
    response: finalResponse
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json matching your format.`);
}

main();
