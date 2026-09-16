const fs = require('fs');
const { execSync } = require('child_process');

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

function getBrowserData() {
    console.log('Fetching API response using Chrome TLS Impersonation...');
    
    // curl-impersonate ব্যবহার করে হুবহু আসল Chrome ব্রাউজারের ফঙ্গারপ্রিন্ট তৈরি
    const command = `curl-impersonate-chrome \
        -s "${API_URL}" \
        -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \
        -H "Accept: application/json, text/plain, */*" \
        -H "Referer: https://cirkletv.com/" \
        --compressed`;

    const response = execSync(command).toString();
    return JSON.parse(response);
}

function generatePlaylists() {
    try {
        const responseData = getBrowserData();
        const channels = responseData.data || responseData.channels || responseData;

        if (!Array.isArray(channels)) {
            throw new Error('Could not parse channel array from response.');
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

        console.log(`Successfully generated circle.m3u & circle.json with ${jsonChannels.length} channels!`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    }
}

generatePlaylists();
