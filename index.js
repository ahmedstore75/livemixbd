const fs = require('fs');

async function generatePlaylists() {
    try {
        console.log('Fetching channel data via proxy...');

        // বাংলাদেশী / Cloudflare-bypass CORS Proxy
        const targetUrl = encodeURIComponent('https://api.cirkletv.com/api/live-tv?page=1&limit=200');
        const proxyUrl = `https://api.allorigins.win/get?url=${targetUrl}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const parsedContents = JSON.parse(data.contents);
        const channels = parsedContents.data || parsedContents.channels || parsedContents;

        if (!Array.isArray(channels)) {
            throw new Error('Invalid channel data format received.');
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

        console.log('Successfully generated circle.m3u and circle.json!');

    } catch (error) {
        console.error('Error generating playlists:', error.message);
        process.exit(1);
    }
}

generatePlaylists();
