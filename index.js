const fs = require('fs');
const axios = require('axios');
const https = require('https');

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

async function generatePlaylists() {
    try {
        console.log('Fetching channel data...');

        const agent = new https.Agent({  
            rejectUnauthorized: false
        });

        const response = await axios.get(API_URL, {
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://cirkletv.com/',
                'Origin': 'https://cirkletv.com',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'Connection': 'keep-alive'
            },
            timeout: 15000
        });

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

        fs.writeFileSync('circle.m3u', m3uContent, 'utf8');
        fs.writeFileSync('circle.json', JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: jsonChannels.length,
            channels: jsonChannels
        }, null, 2), 'utf8');

        console.log('circle.m3u and circle.json generated successfully!');
    } catch (error) {
        console.error('Error generating playlists:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
            console.error('Response Status:', error.response.status);
        }
        process.exit(1);
    }
}

generatePlaylists();
