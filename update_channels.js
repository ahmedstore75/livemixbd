const fs = require("fs");
const https = require("https");

const targetUrl = "https://web.aynaott.com/live-tvs?_rsc=d6u12";

const options = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "RSC": "1",
    "Accept": "*/*"
  }
};

https.get(targetUrl, options, (res) => {
  let rawData = "";
  res.on("data", chunk => rawData += chunk);
  res.on("end", () => {
    try {
      const cleaned = rawData.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

      const logos = [...cleaned.matchAll(/https:\/\/web\.aynaott\.com\/storage\/[^\s"']+/g)].map(m => m[0].replace(/&amp;/g, "&"));
      const names = [...cleaned.matchAll(/"title":"([^"]+)"|"name":"([^"]+)"/g)].map(m => m[1] || m[2]);

      const channels = [];
      let m3uContent = "#EXTM3U\n";

      const uniqueLogos = Array.from(new Set(logos));

      uniqueLogos.forEach((logoUrl, index) => {
        const title = names[index] || `Channel ${index + 1}`;
        const channelId = `ch_${index + 1}`;
        const playUrl = `https://web.aynaott.com/live-tvs/${channelId}`;

        channels.push({
          id: channelId,
          name: title,
          logo: logoUrl,
          url: playUrl
        });

        m3uContent += `#EXTINF:-1 tvg-id="${index + 1}" tvg-name="${title}" tvg-logo="${logoUrl}", ${title}\n${playUrl}\n`;
      });

      fs.writeFileSync("channels.json", JSON.stringify(channels, null, 2));
      fs.writeFileSync("playlist.m3u", m3uContent);
      console.log(`Successfully generated ${channels.length} channels.`);
    } catch (err) {
      console.error("Processing error:", err);
      process.exit(1);
    }
  });
}).on("error", (err) => {
  console.error("Fetch failed:", err);
  process.exit(1);
});
