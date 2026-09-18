const fs = require("fs");
const https = require("https");

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

const invalidNames = ["none", "viewport", "g", "description", "default", "noir", "ayna ott", "null", "undefined"];

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
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://web.aynaott.com/"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", () => resolve(""));
  });
}

async function processData() {
  console.log("Fetching Ayna OTT main database payload...");
  
  // মোট পেজ একযোগে রিকোয়েস্ট
  let pagePromises = [];
  for (let i = 1; i <= 15; i++) {
    pagePromises.push(fetchData(`https://web.aynaott.com/live-tvs?page=${i}&_rsc=1`));
  }
  
  const pageResults = await Promise.all(pagePromises);
  const rawData = pageResults.join("\n");

  let extractedChannels = [];
  const seenUrls = new Set();

  // JSON অবজেক্ট ব্লক বাই ব্লক পার্স করা
  const regex = /\{[^{}]*?"id"\s*:\s*\d+[^{}]*?"stream_url"\s*:\s*"([^"]+)"[^{}]*?\}/gi;
  const matches = rawData.match(/\{[^{}]*?"stream_url"\s*:\s*"https?:[^\s"]+\.m3u8[^\s"]*"[^{}]*?\}/gi) || [];

  for (const block of matches) {
    try {
      const cleanBlock = block.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      
      const streamMatch = cleanBlock.match(/"stream_url"\s*:\s*"([^"]+)"/i);
      const nameMatch = cleanBlock.match(/"(?:name|title|tvName)"\s*:\s*"([^"]+)"/i);
      const logoMatch = cleanBlock.match(/"(?:poster|logo|image)"\s*:\s*"([^"]+)"/i);

      if (streamMatch && streamMatch[1]) {
        const streamUrl = streamMatch[1].replace(/\\/g, "").trim();
        let name = nameMatch && nameMatch[1] ? nameMatch[1].replace(/\\/g, "").trim() : "";

        if (seenUrls.has(streamUrl) || !name || invalidNames.includes(name.toLowerCase())) continue;
        seenUrls.add(streamUrl);

        let logo = logoMatch && logoMatch[1] ? logoMatch[1].replace(/\\/g, "").trim() : "";
        if (logo.startsWith("/")) {
          logo = "https://s3.aynaott.com" + logo;
        } else if (logo && !logo.startsWith("http")) {
          logo = "https://s3.aynaott.com/storage/" + logo;
        }

        const category = resolveCategory(name);

        extractedChannels.push({
          name: name,
          logo: logo,
          url: streamUrl,
          category: category,
          priority: getPriorityIndex(category, name)
        });
      }
    } catch (e) {}
  }

  // যদি পেজ পার্সিং ব্যর্থ হয় তবে রিজিড ফলব্যাক টেক্সট ম্যাচ
  if (extractedChannels.length < 20) {
    const rawChunks = rawData.split(/(?=\{"id":)/g);
    for (const chunk of rawChunks) {
      const urlM = chunk.match(/"stream_url"\s*:\s*"([^"]+\.m3u8[^"]*)"/i);
      const nameM = chunk.match(/"name"\s*:\s*"([^"]+)"/i) || chunk.match(/"title"\s*:\s*"([^"]+)"/i);
      const logoM = chunk.match(/"poster"\s*:\s*"([^"]+)"/i);

      if (urlM && nameM) {
        const url = urlM[1].replace(/\\/g, "");
        const name = nameM[1].replace(/\\/g, "").trim();
        if (!seenUrls.has(url) && name && !invalidNames.includes(name.toLowerCase())) {
          seenUrls.add(url);
          let logo = logoM ? logoM[1].replace(/\\/g, "") : "";
          if (logo.startsWith("/")) logo = "https://s3.aynaott.com" + logo;
          
          const category = resolveCategory(name);
          extractedChannels.push({
            name: name,
            logo: logo,
            url: url,
            category: category,
            priority: getPriorityIndex(category, name)
          });
        }
      }
    }
  }

  // সাজানো
  extractedChannels.sort((a, b) => {
    const catIndexA = categoryOrder.indexOf(a.category);
    const catIndexB = categoryOrder.indexOf(b.category);
    const indexA = catIndexA === -1 ? 99 : catIndexA;
    const indexB = catIndexB === -1 ? 99 : catIndexB;

    if (indexA !== indexB) return indexA - indexB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });

  // M3U ফাইল তৈরি
  let m3uContent = '#EXTM3U url-tvg="" x-tvg-url=""\n';
  for (const ch of extractedChannels) {
    m3uContent += `#EXTINF:-1 group-title="${ch.category}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n`;
    m3uContent += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)\n`;
    m3uContent += `#EXTVLCOPT:http-referrer=https://web.aynaott.com/\n`;
    m3uContent += `${ch.url}\n`;
  }

  fs.writeFileSync("ayna_ott.json", JSON.stringify(extractedChannels, null, 2));
  fs.writeFileSync("ayna_ott.m3u", m3uContent);
  console.log(`Successfully extracted ${extractedChannels.length} channels with valid names and S3 logos!`);
}

processData();
