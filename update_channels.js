const fs = require('fs');

async function generateAllChannels() {
  try {
    // AynaOTT-এর মূল Live TVs পেজ থেকে RSC Payload ফেচ করা
    const targetUrl = 'https://web.aynaott.com/live-tvs?_rsc=d6u12';
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const rawData = await response.text();

    // Regex দিয়ে সব লোগো ইউআরএল এবং চ্যানেলের নাম এক্সট্র্যাক্ট করা
    const logoRegex = /https:\/\/web\.aynaott\.com\/storage\/[^\s"']+/g;
    const nameRegex = /"name":"([^"]+)"|"title":"([^"]+)"/g;

    const logoMatches = rawData.match(logoRegex) || [];
    
    let names = [];
    let match;
    while ((match = nameRegex.exec(rawData)) !== null) {
      names.push(match[1] || match[2]);
    }

    let allChannels = [];
    
    // লোগো লিংক ফিল্টার ও চ্যানেল অবজেক্ট তৈরি
    logoMatches.forEach((logoUrl, index) => {
      let cleanLogo = logoUrl.replace(/&amp;/g, '&');
      let channelName = names[index] || `Channel ${index + 1}`;

      allChannels.push({
        id: `ch_${index + 1}`,
        name: channelName,
        logo: cleanLogo
      });
    });

    // ডুপ্লিকেট চ্যানেল বাদ দেওয়া
    const uniqueChannels = Array.from(new Set(allChannels.map(a => a.logo)))
      .map(logo => allChannels.find(a => a.logo === logo));

    console.log(`Total Unique Channels Found: ${uniqueChannels.length}`);

    // ১. JSON সেভ
    fs.writeFileSync('channels.json', JSON.stringify(uniqueChannels, null, 2), 'utf8');

    // ২. M3U Playlist সেভ
    let m3uContent = '#EXTM3U\n';
    uniqueChannels.forEach((ch, i) => {
      m3uContent += `#EXTINF:-1 tvg-id="${i + 1}" tvg-name="${ch.name}" tvg-logo="${ch.logo}", ${ch.name}\n`;
      m3uContent += `https://web.aynaott.com/live-tvs/${ch.id}\n`;
    });

    fs.writeFileSync('playlist.m3u', m3uContent, 'utf8');
    console.log('Successfully updated channels.json & playlist.m3u!');

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

generateAllChannels();
