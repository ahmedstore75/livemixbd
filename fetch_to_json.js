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
        // ১. লোগো এক্সট্রাক্ট
        const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

        // ২. ক্যাটাগরি/গ্রুপ এক্সট্রাক্ট
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : '';

        // ৩. অরিজিনাল চ্যানেলের আসল নাম পার্সিং (কমা , এর পরের অংশ)
        let channelName = '';
        const lastCommaIndex = line.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
          channelName = line.substring(lastCommaIndex + 1).trim();
        }

        // কমা থেকে নাম না পাওয়া গেলে tvg-name ব্যাকআপ হিসেবে নেবে
        if (!channelName) {
          const nameMatch = line.match(/tvg-name="([^"]+)"/i);
          channelName = nameMatch ? nameMatch[1] : '';
        }

        currentAttributes = {
          name: channelName,
          logo: logo,
          group: group,
          raw_extinf: line
        };
      } else if (line.startsWith('#')) {
        // অতিরিক্ত হেডার বা সিকিউরিটি টোকেন
        currentHeaders.push(line);
      } else {
        // স্ট্রিম URL
        if (currentAttributes.name) {
          items.push({
            name: currentAttributes.name,
            logo: currentAttributes.logo,
            group: currentAttributes.group,
            stream_url: line,
            headers: [...currentHeaders]
          });
        }
        
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

  const totalChannels = toffeeData.length + akashData.length;

  const resultData = {
    playlist_owner: "আহমদ আলী",
    updated_at: new Date().toISOString(),
    total_channels: totalChannels,
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
  console.log(`Successfully updated playlist.json with ${totalChannels} channels.`);
}

main();
