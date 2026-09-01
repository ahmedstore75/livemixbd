const fs = require('fs');

const BASE_URL = 'https://web.aynaott.com';
const API_BLOCKS = [
  '019dd930-8c78-702b-8c44-4cc1bf4b7bc7',
  '019efa5d-2eb7-7ac1-a880-647e38ba7141'
];

async function generateFiles() {
  let allChannels = [];

  for (const blockId of API_BLOCKS) {
    try {
      const response = await fetch(`${BASE_URL}/live-tvs/blocks/${blockId}?_rsc=d6u12`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': '*/*'
        }
      });

      if (!response.ok) continue;

      const rawData = await response.text();

      const logoMatches = rawData.match(/https:\/\/web\.aynaott\.com\/storage\/[^\s"']+/g) || [];
      const titleMatches = rawData.match(/"title":"([^"]+)"/g) || [];

      logoMatches.forEach((logoUrl, index) => {
        let title = titleMatches[index] ? titleMatches[index].replace(/"title":"|"/g, '') : `Channel ${index + 1}`;
        let cleanLogo = logoUrl.replace(/&amp;/g, '&');
        
        allChannels.push({
          id: `ch_${index + 1}`,
          name: title,
          logo: cleanLogo
        });
      });

    } catch (error) {
      console.error(`Error fetching block ${blockId}:`, error.message);
    }
  }

  // Duplicate channels filter based on logo URL
  const uniqueChannels = Array.from(new Set(allChannels.map(a => a.logo)))
    .map(logo => allChannels.find(a => a.logo === logo));

  // 1. JSON ফাইল সেভ
  fs.writeFileSync('channels.json', JSON.stringify(uniqueChannels, null, 2), 'utf8');
  console.log(`JSON file updated with ${uniqueChannels.length} channels.`);

  // 2. M3U Playlist তৈরি ও সেভ
  let m3uContent = '#EXTM3U\n';
  uniqueChannels.forEach(ch => {
    m3uContent += `#EXTINF:-1 tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n`;
    m3uContent += `https://web.aynaott.com/live-tvs/${ch.id}\n`;
  });

  fs.writeFileSync('playlist.m3u', m3uContent, 'utf8');
  console.log('M3U playlist generated successfully.');
}

generateFiles();
