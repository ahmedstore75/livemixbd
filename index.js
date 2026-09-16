const fs = require('fs');

async function generatePlaylists() {
    try {
        console.log('Fetching channel data...');

        // Cloudflare & Geo-block bypassing target
        const targetUrl = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';
        
        // Backup mirror API endpoints
        const urlsToTry = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            targetUrl
        ];

        let rawData = null;

        for (const url of urlsToTry) {
            try {
                console.log(`Trying endpoint: ${url.substring(0, 45)}...`);
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                    }
                });
                
                if (response.ok) {
                    const text = await response.text();
                    // Check if valid JSON returned
                    if (text.startsWith('{') || text.startsWith('[')) {
                        rawData = JSON.parse(text);
                        console.log('Data successfully fetched!');
                        break;
                    }
                }
            } catch (e) {
                console.log('Failed this route, trying next...');
            }
        }

        if (!rawData) {
            throw new Error('All fetching routes failed due to Cloudflare Geo-blocking on GitHub Runners.');
        }

        const channels = rawData.data || rawData.channels || rawData;

        if (!Array.isArray(channels)) {
            throw new Error('Invalid channel structure received.');
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

        console.log(`Successfully generated playlists with ${jsonChannels.length} channels!`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

generatePlaylists();
