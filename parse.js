const fs = require("fs");
const https = require("https");

// ১৩০+ সব চ্যানেল ফেচ করার জন্য Ayna OTT-র সকল ব্লক লিঙ্ক
const urls = [
  "https://web.aynaott.com/live-tvs?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019dd930-8c78-702b-8c44-4cc1bf4b7bc7?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019efa5d-2eb7-7ac1-a880-647e38ba7141?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd26-0e1d-7212-b13d-5e263d906bf2?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd26-d667-7b2d-b873-1ee2ddba42df?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd27-4a0b-741c-8e4a-382a9b4991aa?_rsc=d6u12",
  "https://web.aynaott.com/live-tvs/blocks/019edd27-8a4a-71dd-932f-7634f3b60c91?_rsc=d6u12"
];

const options = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "RSC": "1"
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
  "Bangla": ["btv national", "btv", "channel i", "somoy tv", "jamuna tv", "channel 24", "news 24", "atn news", "ntv", "rtv", "ekushey tv", "independent tv", "bangla vision", "atn bangla", "deepto tv", "ekattor tv", "dbc news", "gtv", "t sports", "maasranga tv", "ekhon tv", "bangla tv", "ananda tv", "bijoy tv", "asian tv", "boishakhi", "desh tv", "mohona", "nexus", "my tv", "sa tv", "channel 9", "channel 52", "drama 24", "global tv", "thikana"],
  "Sports": ["t sports", "star sports 1", "star sports 2", "star sports hindi", "sony sports 1", "sony sports 2", "sony sports 5", "ten sports", "willow tv", "bein sports", "ptv sports", "eurosport"]
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

async function processData() {
  let rawData = "";
  for (const url of urls) rawData += await fetchData(url) + "\n";

  // RSC এস্কেপ ক্যারেক্টার ক্লিন করা
  const cleanedData = rawData
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "/")
    .replace(/\\u0026/g, "&");

  let extractedChannels = [];
  const seenUrls = new Set();
  const categoryNames = ["cricket", "football", "sports", "news", "bangla", "kolkata", "indian", "movies", "music", "islamic", "kids", "documentary", "entertainment", "channels", "live-tvs", "ayna ott", "default", "noir", "viewport", "description", "next_locale"];

  // .m3u8 স্ট্রিমিং লিঙ্কগুলো খুঁজে বের করা
  const matches = [...cleanedData.matchAll(/(https?:[^\s"\\]+\.m3u8[^\s"\\]*)/gi)];

  for (const m of matches) {
    const streamUrl = m[1];
    if (seenUrls.has(streamUrl)) continue;

    // লিঙ্কের আগের ১০০০ ক্যারেক্টার ফিল্টার করা নাম ও লোগো খোঁজার জন্য
    const startPos = Math.max(0, m.index - 1000);
    const snippet = cleanedData.substring(startPos, m.index);

    let title = "";

    // চ্যানেল টাইটেল / নেম ফিল্টার
    const nameMatches = [...snippet.matchAll(/"(?:name|title|tvName|label|channelName)"\s*:\s*"([^"]+)"/gi)];
    for (let i = nameMatches.length - 1; i >= 0; i--) {
      let cand = nameMatches[i][1].replace(/[\r\n\t]/g, "").trim();
      if (cand && !categoryNames.includes(cand.toLowerCase()) && !/^[a-f0-9-]{10,}$/i.test(cand)) {
        title = cand;
        break;
      }
    }

    if (!title) continue;

    // লোগো এক্সট্র্যাক্ট
    let logoUrl = "";
    const logoMatches = snippet.match(/"(?:logo|image|poster|thumbnail|icon|src)"\s*:\s*"([^"]+)"/i) || 
                        snippet.match(/(https?:[^\s"\\]+\.(?:png|jpg|jpeg|webp)[^\s"\\]*)/i);

    if (logoMatches) {
      let ext = logoMatches[1].trim();
      if (ext.startsWith("/")) ext = "https://web.aynaott.com" + ext;
      if (!ext.includes("avatar") && !ext.includes("default") && !ext.includes("placeholder")) logoUrl = ext;
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

  let m3uContent = "#EXTM3U\n";
  for (const ch of extractedChannels) {
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n${ch.url}\n`;
  }

  fs.writeFileSync("channels.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("playlist.m3u", m3uContent);
  console.log(`Success: Found ${extractedChannels.length} channels.`);
}

processData();
