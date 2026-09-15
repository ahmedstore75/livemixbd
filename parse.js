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
    "btv national", "btv ctg", "btv world", "somoy tv", "jamuna tv", 
    "channel 24", "news 24", "atn news", "ntv", "rtv", 
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
  if (/btv|channel i|somoy|jamuna|channel 24|news 24|news24|atn news|ntv|rtv|ekushey|etv|independent|bangla vision|atn bangla|deepto|ekattor|dbc news|gtv|gazi tv|maasranga|ekhon|bangla tv|ananda tv|bijoy tv|asian tv|boishakhi|desh tv|mohona|nexus|my tv|sa tv|channel 9|channel 52|drama 24|global tv|thikana/i.test(clean)) return "Bangla";
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

function cleanString(str) {
  if (!str) return "";
  return str
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/[\r\n\t]/g, "")
    .trim();
}

async function processData() {
  let rawData = "";
  for (const url of urls) {
    rawData += await fetchData(url) + "\n";
  }

  let extractedChannels = [];
  const seenUrls = new Set();

  // RSC এর আসল চ্যানেল অবজেক্ট ধরার নিখুঁত Regex Pattern (যেখানে নাম, লোগো এবং লিঙ্ক একসাথে থাকে)
  const channelBlockRegex = /\{[^{}]*?"title"\s*:\s*"([^"]+)"[^{}]*?\}/gi;
  
  // ব্যাকআপ ফিল্টারিং
  const m3u8Regex = /(https?:[^\s"\\]+\.m3u8[^\s"\\]*)/gi;
  let m3u8Matches = [];
  let m;

  while ((m = m3u8Regex.exec(rawData)) !== null) {
    m3u8Matches.push({ url: cleanString(m[1]), index: m.index });
  }

  for (const item of m3u8Matches) {
    const streamUrl = item.url;
    if (seenUrls.has(streamUrl)) continue;

    // স্ট্রিমিং লিঙ্কের আশেপাশে নির্দিষ্ট JSON অবজেক্ট থেকে আসল তথ্য বের করা
    const start = Math.max(0, item.index - 3000);
    const end = Math.min(rawData.length, item.index + 1000);
    const snippet = rawData.substring(start, end);

    // ১. আসল চ্যানেল টাইটেল (গ্রুপ নাম বাদ দেওয়া হয়েছে)
    let title = "";
    const titleMatches = [...snippet.matchAll(/"title"\s*:\s*"([^"]+)"/gi)];
    
    // অনাকাঙ্ক্ষিত ক্যাটাগরি ও গ্রুপ টাইটেল ফিল্টার
    const groupTitles = ["sports", "news", "entertainment", "kolkata", "indian", "bangla", "movies", "kids", "music", "islamic", "documentary", "subscribe", "viewport", "channels", "live tvs", "cricket", "football"];

    for (let i = titleMatches.length - 1; i >= 0; i--) {
      let cand = cleanString(titleMatches[i][1]);
      if (cand && !groupTitles.includes(cand.toLowerCase()) && cand.length > 1) {
        title = cand;
        break;
      }
    }

    // ২. অরিজিনাল লোগো লিঙ্ক (Ayna OTT CDN URL)
    let logoUrl = "";
    const logoMatch = snippet.match(/"(?:logo|image|thumbnail|poster|icon)"\s*:\s*"([^"]+)"/i) ||
                      snippet.match(/(https?:[^\s"\\]+\.(?:png|jpg|jpeg|webp)[^\s"\\]*)/i);

    if (logoMatch) {
      let ext = cleanString(logoMatch[1] || logoMatch[0]);
      if (ext.startsWith("/")) ext = "https://web.aynaott.com" + ext;
      if (!ext.includes("placeholder") && !ext.includes("default")) {
        logoUrl = ext;
      }
    }

    // ৩. ব্যাকআপ নাম (যদি টেক্সট ফিল্ডে গ্রুপ টাইটেল ছাড়া কিছু না পাওয়া যায়)
    if (!title) {
      try {
        const urlObj = new URL(streamUrl);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        for (let p of parts.reverse()) {
          let cleanP = p.replace(/\.m3u8$/i, '').replace(/[-_]/g, ' ').trim();
          if (cleanP && !["index", "playlist", "live", "hls", "master"].includes(cleanP.toLowerCase())) {
            title = cleanP.toUpperCase();
            break;
          }
        }
      } catch (e) {}
    }

    if (!title) title = "Live Channel";

    // ৪. যদি ওয়েবসাইট লোগো মিসিং থাকে তবে অরিজিনাল GitHub CDN থেকে লোগো লিঙ্ক তৈরি
    if (!logoUrl) {
      const safeName = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      logoUrl = `https://raw.githubusercontent.com/iptv-org/iptv/master/logos/${safeName}.png`;
    }

    seenUrls.add(streamUrl);
    const category = resolveCategory(title);

    extractedChannels.push({
      name: title,
      logo: logoUrl,
      url: streamUrl,
      category: category,
      priority: getPriorityIndex(category, title)
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

  // M3U ফরম্যাটিং
  let m3uContent = '#EXTM3U url-tvg="" x-tvg-url=""\n';
  for (const ch of extractedChannels) {
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n${ch.url}\n`;
  }

  fs.writeFileSync("ayna_ott.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("ayna_ott.m3u", m3uContent);
  console.log(`Successfully generated playlist with ${extractedChannels.length} channels.`);
}

processData();
