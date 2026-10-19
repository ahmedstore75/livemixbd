const fs = require('fs');

async function fetchAndParseM3U(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const items = [];
    
    let currentAttributes = {};
    let currentHeaders = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        // লোগো এক্সট্রাক্ট
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const logo = logoMatch ? logoMatch[1] : '';

        // গ্রুপ/ক্যাটাগরি এক্সট্রাক্ট
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1] : '';

        // মূল চ্যানেল নাম এক্সট্রাক্ট
        const nameMatch = line.match(/,(.+)$/);
        const originalName = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

        currentAttributes = {
          channel_name: `${originalName} - আহমদ আলী`,
          original_name: originalName,
          logo: logo,
          group: group,
          raw_extinf: line.replace(/,.*$/, `,${originalName} - আহমদ আলী`)
        };
      } else if (line.startsWith('#')) {
        // KODI PROP বা অতিরিক্ত সিকিউরিটি হেডার (যেমন Cookie, License, User-Agent ইত্যাদি)
        currentHeaders.push(line);
      } else {
        // স্ট্রিম URL
        items.push({
          ...currentAttributes,
          stream_url: line,
          headers: [...currentHeaders]
        });
        
        // রিসেট
        currentAttributes = {};
        currentHeaders = [];
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

  const resultData = {
    updated_at: new Date().toISOString(),
    total_channels: toffeeData.length + akashData.length,
    playlists: {
      toffee: {
        total_channels: toffeeData.length,
        channels: toffeeData
      },
      akash_go: {
        total_channels: akashData.length,
        channels: akashData
      }
    }
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully saved playlist.json with total ${resultData.total_channels} channels.`);
}

main();
