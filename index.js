const fs = require('fs');
const https = require('https');

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

function fetchApiData(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://cirkletv.com/',
                'Origin': 'https://cirkletv.com'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            
            // ডাটা রিসিভ করা
            res.on('data', chunk => { data += chunk; });
            
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    return reject(new Error(`HTTP Server Error Code: ${res.statusCode}`));
                }
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    console.error('Server returned Non-JSON response (possibly blocked HTML):', data.substring(0, 150));
                    reject(new Error('Failed to parse response as JSON.'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function generatePlaylists() {
    try {
        console.log('Fetching API response...');
        const responseData = await fetchApiData(API_URL);

        // API স্ট্রাকচার প্রিন্ট করে দেখা (ডিবাগ করার জন্য)
        console.log('API Response Sample Keys:', Object.keys(responseData));

        // অ্যারে খুঁজে বের করা
        let channels = [];
        if (Array.isArray(responseData)) {
            channels = responseData;
        } else if (Array.isArray(responseData.data)) {
            channels = responseData.data;
        } else if (Array.isArray(responseData.channels)) {
            channels = responseData.channels;
        } else if (responseData.data && Array.isArray(responseData.data.channels)) {
            channels = responseData.data.channels;
        }

        if (!channels || channels.length === 0) {
            throw new Error('Could not find a valid channels array in the response.');
        }

        let m3uContent = '#EXTM3U\n\n';
        const jsonChannels = [];

        channels.forEach(channel => {
            const id = channel._id || channel.id || '';
            const name = channel.name || channel.title || 'Unknown Channel';
            const logo = channel.logo || channel.icon || channel.image || '';
            const category = typeof channel.category === 'object' ? channel.category?.name : (channel.category || 'General');
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

        console.log(`Success! Generated circle.m3u & circle.json with ${jsonChannels.length} channels.`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    }
}

generatePlaylists();
