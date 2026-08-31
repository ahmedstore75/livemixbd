const fs = require('fs');

async function fetchAndConvertM3U(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const playlist = [];
    let currentItem = {};

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#EXTINF:')) {
        currentItem = {};
        // চ্যানেলের নাম এক্সট্রাক্ট করা
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) currentItem.name = nameMatch[1].trim();

        // লোগো এক্সট্রাক্ট করা
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) currentItem.logo = logoMatch[1];

        // গ্রুপ/ক্যাটাগরি এক্সট্রাক্ট করা
        const groupMatch = line.match(/group-title="([^"]+)"/);
        if (groupMatch) currentItem.group = groupMatch[1];
      } else if (line && !line.startsWith('#')) {
        currentItem.url = line;
        if (currentItem.name && currentItem.url) {
          playlist.push(currentItem);
        }
      }
    }
    return playlist;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return [];
  }
}

async function main() {
  const url1 = 'https://raw.githubusercontent.com/sm-monirulislam/Toffee-Auto-Update/refs/heads/main/toffee_playlist.m3u';
  const url2 = 'https://raw.githubusercontent.com/sm-monirulislam/SM-IPTV/refs/heads/main/akash_go.m3u';

  const [toffeeData, akashData] = await Promise.all([
    fetchAndConvertM3U(url1),
    fetchAndConvertM3U(url2)
  ]);

  const combinedData = {
    updated_at: new Date().toISOString(),
    toffee: toffeeData,
    akash_go: akashData
  };

  fs.writeFileSync('playlist.json', JSON.stringify(combinedData, null, 2));
  console.log('playlist.json successfully updated!');
}

main();
