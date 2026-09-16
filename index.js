const fs = require('fs');
const axios = require('axios');

// API Endpoints
const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

async function generatePlaylists() {
    try {
        console.log('Fetching channel data from API...');
        const response = await axios.get(API_URL);
        
        // API স্ট্রাকচার অনুযায়ী চ্যানেল লিস্ট এক্সট্র্যাক্ট করা
        const channels = response.data.data || response.data.channels || response.data;

        if (!Array.isArray(channels)) {
            throw new Error('Invalid API response format.');
        }

        let m3uContent = '#EXTM3U\n\n';
        const jsonChannels = [];

        channels.forEach(channel => {
            const id = channel._id || channel.id || '';
            const name = channel.name || channel.title || 'Unknown Channel';
            const logo = channel.logo || channel.icon || channel.image || '';
            const category = channel.category?.name || channel.category || 'General';
            const streamUrl = channel.streamUrl || channel.url || channel.link || channel.stream;

            if (streamUrl) {
                // ১. M3U ফরম্যাট
                m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${category}",${name}\n`;
                m3uContent += `${streamUrl}\n\n`;

                // ২. JSON ফরম্যাট
                jsonChannels.push({
                    id: id,
                    name: name,
                    logo: logo,
                    category: category,
                    url: streamUrl
                });
            }
        });

        // M3U ফাইল সেভ করা
        fs.writeFileSync('playlist.m3u', m3uContent, 'utf8');
        console.log('Successfully generated: playlist.m3u');

        // JSON ফাইল সেভ করা
        const jsonContent = JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: jsonChannels.length,
            channels: jsonChannels
        }, null, 2);

        fs.writeFileSync('playlist.json', jsonContent, 'utf8');
        console.log('Successfully generated: playlist.json');

    } catch (error) {
        console.error('Error generating playlists:', error.message);
    }
}

generatePlaylists();
