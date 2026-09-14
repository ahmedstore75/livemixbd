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

// ক্যাটাগরি আইডেন্টিফাই করার ফাংশন (শুধু ২ নম্বর লিংকের জন্য)
function getCategoryPriority(name) {
  const n = name.toLowerCase();

  // ১. বাংলাদেশ চ্যানেল
  const bdKeywords = [
    'somoy', 'ekattor', 'jamuna', 'independent', 'channel 24', 'dbc', 'news24', 
    'atn bangla', 'atn news', 'channel i', 'ntv', 'rtv', 'boishakhi', 'banglavision', 
    'desh tv', 'maasranga', 'gazi tv', 'gtv', 'nagorik', 'bijoy tv', 
    'my tv', 'asian tv', 'saampratik', 'ananda', 'deepto', 'duronto', 'btv', 'bangla tv'
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
    'ten 2', 'ten 3', 'sports18', 'astro sports', 'willow', 'ptv sports', 'eurosport', 
    't sports', 'tapmad', 'dazn', 'bein sports', 'super sport'
  ];
  if (sportsKeywords.some(key => n.includes(key))) return 3;

  // ৪. মুভি চ্যানেল
  const movieKeywords = [
    'movie', 'movies', 'cinema', 'hbo', 'star movies', 'sony pix', 'mnx', 'flix', 
    'cineplex', 'action', 'zee cinema', 'star gold', 'sony max', 'colors cineplex'
  ];
  if (movieKeywords.some(key => n.includes(key))) return 4;

  // ৫. সাধারণ বিনোদন ও ড্রামা
  const dramaKeywords = [
    'star plus', 'zee tv', 'sony tv', 'colors tv', 'sab tv', 'star bharat', 
    'dangal', 'bindass', 'tlc', 'e!', 'axn'
  ];
  if (dramaKeywords.some(key => n.includes(key))) return 5;

  // ৬. ইনফোটেইনমেন্ট ও ডকুমেন্টারি
  const docKeywords = [
    'discovery', 'national geographic', 'nat geo', 'animal planet', 
    'history', 'investigation', 'natgeo', 'science', 'bbc earth'
  ];
  if (docKeywords.some(key => n.includes(key))) return 6;

  // ৭. কিডস / শিশুদের চ্যানেল
  const kidsKeywords = [
    'cartoon', 'nick', 'pogo', 'disney', 'hungama', 'sonic', 'kids', 'baby'
  ];
  if (kidsKeywords.some(key => n.includes(key))) return 7;

  // ৮. মিউজিক চ্যানেল
  const musicKeywords = [
    'music', 'song', 'mtv', 'sangeet', '9xm', 'zoOm', 'vh1'
  ];
  if (musicKeywords.some(key => n.includes(key))) return 8;

  // ৯. আন্তর্জাতিক ও সাধারণ সংবাদ
  const newsKeywords = [
    'bbc news', 'cnn', 'al jazeera', 'ndtv', 'india today', 'aaj tak', 'republic', 'dw', 'news'
  ];
  if (newsKeywords.some(key => n.includes(key))) return 9;

  // ১০. ধর্মীয়
  const religiousKeywords = [
    'islam', 'makkah', 'madinah', 'peace tv', 'quran', 'peacetv', 'bhakti'
  ];
  if (religiousKeywords.some(key => n.includes(key))) return 10;

  // ১১. অন্যান্য চ্যানেল
  return 11;
}

// সাধারণ ফিল্টারিং (সর্ট ছাড়া - ১ ও ৩ নম্বর লিংকের জন্য)
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

// ২ নম্বর লিংকের ফিল্টার এবং সর্টিং ফাংশন
function processAndSortLink2(channels, seenUrls) {
  const filtered = filterChannelsOnly(channels, seenUrls);

  // শুধু ২ নম্বর লিংকের চ্যানেল ক্যাটাগরি ও ১, ২, ৩ ডিজিট সিকোয়েন্স অনুযায়ী সাজানো হবে
  filtered.sort((a, b) => {
    const catA = getCategoryPriority(a.name);
    const catB = getCategoryPriority(b.name);

    if (catA !== catB) {
      return catA - catB;
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return filtered;
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

  const seenUrls = new Set();

  // ১. প্রথম লিংক (অরিজিনাল অর্ডারে থাকবে)
  const tapmadChannels = filterChannelsOnly(tapmadData, seenUrls);

  // ২. দ্বিতীয় লিংক (ক্যাটাগরি অনুযায়ী সাজানো হবে)
  const sortedToffeeChannels = processAndSortLink2(toffeeData, seenUrls);

  // ৩. তৃতীয় লিংক (অরিজিনাল অর্ডারে থাকবে)
  const fastIptvChannels = filterChannelsOnly(fastIptvData, seenUrls);

  // সব চ্যানেল একত্রে (Link 1 -> Sorted Link 2 -> Link 3)
  const allFinalChannels = [...tapmadChannels, ...sortedToffeeChannels, ...fastIptvChannels];

  // আইডি নম্বর নতুন করে দেওয়া
  const finalResponse = allFinalChannels.map((ch, index) => ({
    id: index + 1,
    ...ch
  }));

  const resultData = {
    status: "success",
    name: "Live Channels",
    owner: "Ahammad Ali",
    channels_amount: finalResponse.length,
    last_update: new Date().toISOString().split('T')[0],
    response: finalResponse
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json with ${finalResponse.length} channels.`);
}

main();
