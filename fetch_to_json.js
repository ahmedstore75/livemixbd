const fs = require('fs');

async function fetchAndParseM3U(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const items = [];
    let currentExtInf = '';

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // চ্যানেলের নাম পরিবর্তন করে 'আহমদ আলী' বসানো
        currentExtInf = line.replace(/,.*$/, ',আহমদ আলী');
      } else if (line.startsWith('#')) {
        // অন্য যেকোনো হেডার/ট্যাগ (যেমন #EXTVLCOPT, #KODIPROP) যা ডাটাতে যেভাবে আছে সেভাবেই রাখা
        items.push({ type: 'header', content: line });
      } else {
        // স্ট্রিম URL বা মিডিয়া লিংক
        items.push({
          extinf: currentExtInf,
          url: line
        });
        currentExtInf = '';
      }
    }
    return items;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return [];
  }
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';

  const [toffeeData, akashData] = await Promise.all([
    fetchAndParseM3U(url1),
    fetchAndParseM3U(url2)
  ]);

  // চ্যানেল সংখ্যা অটো গণনা (যেসব ডাটায় URL রয়েছে)
  const toffeeCount = toffeeData.filter(item => item.url).length;
  const akashCount = akashData.filter(item => item.url).length;

  const resultData = {
    last_updated: new Date().toISOString(),
    total_channels: toffeeCount + akashCount,
    playlists: {
      toffee: {
        total_channels: toffeeCount,
        data: toffeeData
      },
      akash_go: {
        total_channels: akashCount,
        data: akashData
      }
    }
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated playlist.json with total ${resultData.total_channels} channels.`);
}

main();
