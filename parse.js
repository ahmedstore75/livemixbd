const fs = require("fs");
const https = require("https");

const BASE_URL = "https://web.aynaott.com";
const categories = [
  "all", "bangla", "sports", "kolkata", "indian", "news", 
  "movies", "music", "islamic", "kids", "documentary", "entertainment"
];

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
    "sony sports 1", "sony sports 2", "sony sports 5", "ten sports", 
    "willow tv", "bein sports", "ptv sports", "eurosport"
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

function generateAutoLogo(channelName) {
  let formattedName = channelName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "").trim();
  if (!formattedName) return "https://raw.githubusercontent.com/iptv-org/iptv/master/logos/IPTV.png";
  return `https://raw.githubusercontent.com/iptv-org/iptv/master/logos/${formattedName}.png`;
}

function fetchData(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "RSC": "1"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(""));
    req.setTimeout(10000, () => { req.destroy(); resolve(""); }); // ১০ সেকেন্ড টাইমআউট (নেটওয়ার্ক ফেইল এড়াতে)
  });
}

async function processData() {
  console.log("Fetching API responses in parallel...");

  const urls = [];
  for (const cat of categories) {
    for (let page = 1; page <= 5; page++) {
      urls.push(`${BASE_URL}/live-tvs?category=${cat}&page=${page}&_rsc=1`);
    }
  }

  const results = await Promise.all(urls.map(url => fetchData(url)));
  const rawData = results.join("\n");

  const cleanedData = rawData
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\u0026/g, "&");

  let extractedChannels = [];
  const seenUrls = new Set();
  
  // RSC ডাটার সম্পূর্ণ ব্লক আলাদা করা
  const rawBlocks = cleanedData.split(/(?=\{"id"|\{"title"|\{"name")/g);

  for (const block of rawBlocks) {
    if (!block.includes(".m3u8")) continue;

    const streamMatch = block.match(/(https?:[^\s"\\]+\.m3u8[^\s"\\]*)/i);
    if (!streamMatch) continue;

    const streamUrl = streamMatch[1];
    if (seenUrls.has(streamUrl)) continue;

    let title = "";
    // অরিজিনাল চ্যানেল নাম নিষ্কাশন
    const titleMatch = block.match(/"(?:title|name|channelName|tvName|label)"\s*:\s*"([^"]+)"/i);
    if (titleMatch) {
      let val = titleMatch[1].replace(/\\t|\\n|\\r/g, "").trim();
      const junk = ["viewport", "description", "Noir", "Default", "NEXT_LOCALE", "G", "Ayna OTT", "Bangla", "Channels", "Live-tvs", "icon", "theme-color"];
      if (!junk.includes(val) && !/^[a-zA-Z0-9]{12,}$/.test(val) && val.length > 1) {
        title = val;
      }
    }

    if (!title) continue;

    // S3 লোগো লিঙ্ক ফিক্স (s3.aynaott.com)
    let logoUrl = "";
    const logoMatch = block.match(/"(?:logo|image|poster|thumbnail|icon|src)"\s*:\s*"([^"]+)"/i) ||
                      block.match(/(\/storage\/[^\s"\\]+\.(?:png|jpg|jpeg|webp))/i);

    if (logoMatch) {
      let extracted = logoMatch[1].trim();
      if (extracted.startsWith("/")) {
        logoUrl = "https://s3.aynaott.com" + extracted;
      } else if (!extracted.startsWith("http")) {
        logoUrl = "https://s3.aynaott.com/storage/" + extracted;
      } else {
        logoUrl = extracted;
      }
    }

    if (!logoUrl) logoUrl = generateAutoLogo(title);

    const category = resolveCategory(title);
    seenUrls.add(streamUrl);

    extractedChannels.push({
      name: title,
      logo: logoUrl,
      url: streamUrl,
      category: category,
      priority: getPriorityIndex(category, title)
    });
  }

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
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n`;
    m3uContent += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)\n`;
    m3uContent += `#EXTVLCOPT:http-referrer=https://web.aynaott.com/\n`;
    m3uContent += `${ch.url}\n`;
  }

  fs.writeFileSync("ayna_ott.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("ayna_ott.m3u", m3uContent);
  console.log(`Successfully fetched total ${extractedChannels.length} channels!`);
}

processData();
