const fs = require('fs');
const axios = require('axios');

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

async function generatePlaylists() {
    try {
        console.log('Fetching channel data...');
        const response = await axios.get(API_URL);
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
                m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${category}",${name}\n`;
                m3uContent += `${streamUrl}\n\n`;

                jsonChannels.push({ id, name, logo, category, url: streamUrl });
            }
        });

        // ফাইল নেম 'circle.m3u' এবং 'circle.json'
        fs.writeFileSync('circle.m3u', m3uContent, 'utf8');
        fs.writeFileSync('circle.json', JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: jsonChannels.length,
            channels: jsonChannels
        }, null, 2), 'utf8');

        console.log('Files generated successfully!');
    } catch (error) {
        console.error('Error generating playlists:', error.message);
        process.exit(1); // ভুল হলে প্রসেস যেন ফেল হয়
    }
}

generatePlaylists();
