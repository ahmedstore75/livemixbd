const fs = require('fs');

async function fetchAndParseM3U(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lines = text.split('\n');
    const items = [];

    let currentAttributes = {};
    let currentHeaders = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

        const groupMatch = line.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : '';

        let channelName = '';
        const lastCommaIndex = line.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
          channelName = line.substring(lastCommaIndex + 1).trim();
        }

        if (!channelName) {
          const nameMatch = line.match(/tvg-name="([^"]+)"/i);
          channelName = nameMatch ? nameMatch[1] : 'Unknown Channel';
        }

        currentAttributes = {
          name: channelName,
          logo: logo,
          group: group
        };
      } else if (line.startsWith('#')) {
        // আকাশের টোকেন বা ডেভেলপার ক্রেডিট ব্যতীত সব প্রয়োজনীয় টেকনিক্যাল ট্যাগ ও হেডার ফিল্টার করা
        const isUnwantedComment = line.includes('Developed by:') || 
                                  line.includes('Telegram group') || 
                                  line.includes('Last Updated:') || 
                                  line.includes('All channel :') ||
                                  line.startsWith('#======');

        if (!isUnwantedComment) {
          currentHeaders.push(line);
        }
      } else {
        if (currentAttributes.name) {
          items.push({
            name: currentAttributes.name,
            logo: currentAttributes.logo,
            group: currentAttributes.group,
            stream_url: line,
            headers: [...currentHeaders]
          });
        }
        
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

  const allChannels = [...toffeeData, ...akashData];

  const resultData = {
    owner: "আহমদ আলী",
    updated_at: new Date().toISOString(),
    total_channels: allChannels.length,
    channels: allChannels
  };

  fs.writeFileSync('playlist.json', JSON.stringify(resultData, null, 2));
  console.log(`Successfully generated clean playlist.json with ${allChannels.length} channels.`);
}

main();
