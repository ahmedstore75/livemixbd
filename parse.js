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

// বাজে ও মেটাডাটা টেক্সট বাদ দেওয়ার তালিকা (Blacklist)
const invalidNames = new Set([
  "viewport", "g", "description", "default", "noir", "next_locale", 
  "ayna ott", "bangla", "channels", "live-tvs", "icon", "theme-color",
  "width=device-width", "initial-scale=1"
]);

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
    req.setTimeout(5000, () => { req.destroy(); resolve(""); });
  });
}

async function processData() {
  console.log("Fetching all pages in parallel...");

  const urls = [];
  for (const cat of categories) {
    for (let page = 1; page <= 6; page++) {
      urls.push(`${BASE_URL}/live-tvs?category=${cat}&page=${page}&_rsc=1`);
    }
  }

  const results = await Promise.all(urls.map(url => fetchData(url)));
  const combinedPayload = results.join("\n");

  let extractedChannels = [];
  const seenUrls = new Set();

  // JSON স্ট্রাকচার পার্সার
  const rawBlocks = combinedPayload.split(/\{\s*"id"\s*:\s*\d+/g);

  for (const block of rawBlocks) {
    if (!block.includes(".m3u8")) continue;

    // Stream URL
    const streamMatch = block.match(/"(https?:[^"\\]+\.m3u8[^"\\]*)"/i) || 
                        block.match(/(https?:[^\s"\\]+\.m3u8[^\s"\\]*)/i);
    if (!streamMatch) continue;

    let streamUrl = streamMatch[1].replace(/\\/g, "");
    if (seenUrls.has(streamUrl)) continue;

    // Channel Name (ভুল মেটাডাটা ফিল্টারিং সহ)
    let title = "";
    const nameMatches = block.matchAll(/"(?:name|title|tvName|channelName)"\s*:\s*"([^"]+)"/gi);
    
    for (const match of nameMatches) {
      let candidate = match[1].replace(/\\/g, "").trim();
      let lower = candidate.toLowerCase();
      
      if (candidate && !invalidNames.has(lower) && candidate.length > 1 && !candidate.startsWith("http")) {
        title = candidate;
        break;
      }
    }

    if (!title) continue;

    // Logo URL (S3 Support)
    let logoUrl = "";
    const logoMatch = block.match(/"(?:poster|logo|image|thumbnail|icon)"\s*:\s*"([^"]+)"/i) ||
                      block.match(/(\/storage\/[^\s"\\]+)/i);

    if (logoMatch) {
      let extractedLogo = logoMatch[1].replace(/\\/g, "").trim();
      if (extractedLogo.startsWith("/")) {
        logoUrl = "https://s3.aynaott.com" + extractedLogo;
      } else if (!extractedLogo.startsWith("http")) {
        logoUrl = "https://s3.aynaott.com/storage/" + extractedLogo;
      } else {
        logoUrl = extractedLogo;
      }
    }

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

  // Sorting
  extractedChannels.sort((a, b) => {
    const catIndexA = categoryOrder.indexOf(a.category);
    const catIndexB = categoryOrder.indexOf(b.category);
    const indexA = catIndexA === -1 ? 99 : catIndexA;
    const indexB = catIndexB === -1 ? 99 : catIndexB;

    if (indexA !== indexB) return indexA - indexB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });

  // M3U Generation
  let m3uContent = '#EXTM3U url-tvg="" x-tvg-url=""\n';
  for (const ch of extractedChannels) {
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n`;
    m3uContent += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)\n`;
    m3uContent += `#EXTVLCOPT:http-referrer=https://web.aynaott.com/\n`;
    m3uContent += `${ch.url}\n`;
  }

  fs.writeFileSync("ayna_ott.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("ayna_ott.m3u", m3uContent);
  console.log(`Successfully fetched ALL ${extractedChannels.length} channels with valid names and logos!`);
}

processData();
