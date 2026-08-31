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

        // ২. ক্যাটাগরি এক্সট্রাক্ট
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        const group = groupMatch ? groupMatch[1] : '';

        // ৩. অরিজিনাল চ্যানেলের নাম পার্সিং (কমা `,` এর পরের অংশ)
        let originalName = '';
        const lastCommaIndex = line.lastIndexOf(',');
        if (lastCommaIndex !== -1) {
          originalName = line.substring(lastCommaIndex + 1).trim();
        }

        // যদি কোনো কারণে নাম খালি থাকে বা 'Channel' থেকে যায়
        if (!originalName || originalName.toLowerCase() === 'channel') {
          const nameMatch = line.match(/tvg-name="([^"]+)"/i);
          originalName = nameMatch ? nameMatch[1] : 'Unknown Channel';
        }

        // চ্যানেলের নাম কাস্টমাইজেশন
        const finalName = `${originalName} - আহমদ আলী`;

        currentAttributes = {
          name: finalName,
          channel_name: finalName,
          original_name: originalName,
          logo: logo,
          group: group,
          raw_extinf: line.substring(0, lastCommaIndex + 1) + ' ' + finalName
        };
      } else if (line.startsWith('#')) {
        // সিকিউরিটি হেডার বা কুকি
        currentHeaders.push(line);
      } else {
        // স্ট্রিম URL
        if (currentAttributes.name) {
          items.push({
            ...currentAttributes,
            stream_url: line,
            headers: [...currentHeaders]
          });
        }
        
        // তথ্য রিসেট
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
  console.log(`Successfully generated JSON with total ${resultData.total_channels} channels.`);
}

main();
