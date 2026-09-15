const fs = require("fs");
const https = require("https");

const urls = [
  "https://web.aynaott.com/live-tvs?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019dd930-8c78-702b-8c44-4cc1bf4b7bc7?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019efa5d-2eb7-7ac1-a880-647e38ba7141?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd26-0e1d-7212-b13d-5e263d906bf2?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd26-d667-7b2d-b873-1ee2ddba42df?_rsc=d6u12"
];

const options = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "RSC": "1",
    "Accept": "*/*"
  }
};

const fetchData = (url) => new Promise((resolve) => {
  https.get(url, options, (res) => {
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => resolve(data));
  }).on("error", () => resolve(""));
});

const categoryOrder = [
  "Bangla", "Sports", "Kolkata", "Indian", "News", 
  "Movies", "Music", "Islamic", "Kids", "Documentary", "Entertainment"
];

const priorityMap = {
  "Bangla": [
    "btv national", "btv", "channel i", "somoy tv", "jamuna tv", 
    "channel 24", "news 24", "news24", "atn news", "ntv", "rtv", 
    "ekushey tv", "etv", "independent tv", "bangla vision", 
    "atn bangla", "deepto tv", "ekattor tv", "dbc news", "gtv", 
    "gazi tv", "t sports", "maasranga tv", "ekhon tv", "bangla tv"
  ],
  "Sports": [
    "t sports", "star sports 1", "star sports 2", "star sports hindi", 
    "sony sports 1", "sony sports 2", "sony sports 5", "ten sports"
  ]
};

function resolveCategory(title) {
  const clean = title.toLowerCase().trim();
  if (/btv|channel i|somoy|jamuna|channel 24|news 24|news24|atn news|ntv|rtv|ekushey|etv|independent|bangla vision|atn bangla|deepto|ekattor|dbc news|gtv|gazi tv|maasranga|ekhon|bangla tv|ananda tv|bijoy tv|asian tv|boishakhi|desh tv|mohona|nexus|my tv|sa tv|channel 9|channel 52|52|drama 24|global tv|thikana/i.test(clean)) return "Bangla";
  if (/kolkata|r plus|zee 24 ghanta|24 ghanta|sony aath|aath|jalsha|zee bangla|colors bangla|sangeet bangla|akash ath|ruposhi bangla|calcuttatv|enter 10 bangla|dd bangla|news18 bangla|tv9 bangla/i.test(clean)) return "Kolkata";
  if (/sport|tsn|espn|nfl|bein|cricket|football|willow|bleav|fifa|ten|eurosport|golf|sky|fishing|ktv/i.test(clean)) return "Sports";
  if (/star plus|zee tv|colors hindi|colors|sony tv|sab tv|star bharat|dangal|b4u|bindass|sahara|and pictures|&pictures|star gold|zee cinema|sony max|goldmine|tv9 bharatvarsh/i.test(clean)) return "Indian";
  if (/madani|islam|peace|makkah|madinah|quran|sunnah|iqra|deen|huda/i.test(clean)) return "Islamic";
  if (/news|samachar|khabar|bbc|cnn|jazeera|republic|ndtv|times|reuters|dw|cp24|fox news|business|aaj tak|bulletin|tv9/i.test(clean)) return "News";
  if (/movie|cinema|cine|gold|hbo|action|picture|filmy|flix|popcorn/i.test(clean)) return "Movies";
  if (/music|mtv|zoom|9xm|9x|sangeet|vh1|club|b4u hitz|zing|musiq|beat|sound/i.test(clean)) return "Music";
  if (/kid|cartoon|nick|pogo|disney|sonic|hungama|duronto|baby|junior|toon|anime/i.test(clean)) return "Kids";
  if (/discovery|nat geo|national geographic|history|animal planet|investigation|science|planet|earth|docu/i.test(clean)) return "Documentary";
  return "Entertainment";
}

function getPriorityIndex(category, title) {
  const list = priorityMap[category];
  if (!list) return 999;
  const clean = title.toLowerCase().trim();
  const index = list.findIndex(item => clean.includes(item));
  return index === -1 ? 999 : index;
}

function sanitizeUrl(str) {
  if (!str) return "";
  let clean = str.replace(/\\"/g, '"').replace(/\\\\/g, "/").replace(/\\u0026/g, "&");
  if (clean.startsWith("/")) clean = "https://web.aynaott.com" + clean;
  return clean;
}

async function processData() {
  let rawData = "";
  for (const url of urls) {
    rawData += await fetchData(url) + "\n";
  }

  // RSC এস্কেপিং ক্লিয়ার করা
  const cleanedData = rawData
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "/")
    .replace(/\\u0026/g, "&");

  let extractedChannels = [];
  const seenUrls = new Set();

  // RSC এর ডাটা ব্লকগুলোকে আলাদা অবজেক্ট হিসেবে ফিল্টার করা
  // অবজেক্টের মধ্যে name/title, logo/image এবং m3u8 লিংক একসাথে জোড়া লাগানো
  const objectRegex = /\{[^{}]*"(?:streamUrl|url|src)"\s*:\s*"(https?:[^\s"\\]+\.m3u8[^\s"\\]*)"[^{}]*\}/gi;
  let match;

  // প্রথম পদ্ধতি: স্ট্রাকচার্ড অবজেক্ট সার্চ
  while ((match = objectRegex.exec(cleanedData)) !== null) {
    const block = match[0];
    const streamUrl = sanitizeUrl(match[1]);

    if (seenUrls.has(streamUrl)) continue;

    // চ্যানেল টাইটেল
    const titleMatch = block.match(/"(?:title|name|channelName|tvName|label)"\s*:\s*"([^"]+)"/i);
    let title = titleMatch ? titleMatch[1].trim() : "";

    // চ্যানেল লোগো
    const logoMatch = block.match(/"(?:logo|image|poster|thumbnail|icon|cover)"\s*:\s*"([^"]+)"/i);
    let logoUrl = logoMatch ? sanitizeUrl(logoMatch[1]) : "";

    if (title && !["sports", "news", "cricket", "football"].includes(title.toLowerCase())) {
      seenUrls.add(streamUrl);
      extractedChannels.push({
        name: title,
        logo: logoUrl,
        url: streamUrl,
        category: resolveCategory(title),
        priority: getPriorityIndex(resolveCategory(title), title)
      });
    }
  }

  // দ্বিতীয় পদ্ধতি: ব্যাকআপ (যাতে কোনো চ্যানেল বাদ না পড়ে কিন্তু সঠিক অরিজিনাল নেম বের হয়)
  const fallbackRegex = /(https?:[^\s"\\]+\.m3u8[^\s"\\]*)/gi;
  while ((match = fallbackRegex.exec(cleanedData)) !== null) {
    const streamUrl = sanitizeUrl(match[1]);
    if (seenUrls.has(streamUrl)) continue;

    const startPos = Math.max(0, match.index - 3000);
    const endPos = Math.min(cleanedData.length, match.index + 1000);
    const snippet = cleanedData.substring(startPos, endPos);

    // অরিজিনাল নাম পাওয়ার জন্য কি-ওয়ার্ড সার্চ
    let title = "";
    const nameMatches = [...snippet.matchAll(/"(?:title|name|channelName|tvName)"\s*:\s*"([^"]+)"/gi)];
    
    for (let i = nameMatches.length - 1; i >= 0; i--) {
      let cand = nameMatches[i][1].trim();
      if (cand && !["sports", "news", "cricket", "football", "subscribe", "live-tvs"].includes(cand.toLowerCase())) {
        title = cand;
        break;
      }
    }

    // অরিজিনাল লোগো লিঙ্ক বের করার চেইন সার্চ
    let logoUrl = "";
    const logoMatch = snippet.match(/"(?:logo|image|poster|thumbnail|icon|cover)"\s*:\s*"([^"]+)"/i);
    if (logoMatch) {
      logoUrl = sanitizeUrl(logoMatch[1]);
    }

    if (!title) continue; // জেন্যারিক নাম বাদ দেওয়া হচ্ছে

    seenUrls.add(streamUrl);
    extractedChannels.push({
      name: title,
      logo: logoUrl,
      url: streamUrl,
      category: resolveCategory(title),
      priority: getPriorityIndex(resolveCategory(title), title)
    });
  }

  // সর্টিং
  extractedChannels.sort((a, b) => {
    const catIndexA = categoryOrder.indexOf(a.category);
    const catIndexB = categoryOrder.indexOf(b.category);
    const indexA = catIndexA === -1 ? 99 : catIndexA;
    const indexB = catIndexB === -1 ? 99 : catIndexB;

    if (indexA !== indexB) return indexA - indexB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });

  let m3uContent = '#EXTM3U url-tvg="" x-tvg-url=""\n';
  for (const ch of extractedChannels) {
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n${ch.url}\n`;
  }

  fs.writeFileSync("ayna_ott.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("ayna_ott.m3u", m3uContent);
  console.log(`Successfully generated playlist with ${extractedChannels.length} channels.`);
}

processData();
