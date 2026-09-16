const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const FRONTEND_URL = 'https://cirkletv.com/live-tv';

async function generatePlaylists() {
    try {
        console.log('Fetching HTML page from frontend...');

        // ফ্রন্টএন্ড পেজ থেকে ডেটা স্ক্র্যাপ করা
        const response = await axios.get(FRONTEND_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Next.js-এর হাইড্রেশন ডেটা (__NEXT_DATA__) থেকে চ্যানেলের সব তথ্য বের করা
        const nextDataScript = $('#__NEXT_DATA__').html();

        let channels = [];

        if (nextDataScript) {
            const parsedData = JSON.parse(nextDataScript);
            // Next.js এর পেজ প্রপস থেকে চ্যানেল ডেটা এক্সট্র্যাক্ট
            const pageProps = parsedData?.props?.pageProps || {};
            channels = pageProps.channels || pageProps.data || pageProps.initialState?.channels || [];
        }

        // যদি __NEXT_DATA__ তে না পাওয়া যায়, তবে ব্যাকআপ হিসেবে সাধারণ রিকোয়েস্ট পাঠানো
        if (!channels || channels.length === 0) {
            console.log('Trying direct API fallback with custom headers...');
            const apiRes = await axios.get('https://api.cirkletv.com/api/live-tv?page=1&limit=200', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://cirkletv.com/'
                }
            });
            channels = apiRes.data?.data || apiRes.data || [];
        }

        if (!Array.isArray(channels) || channels.length === 0) {
            throw new Error('No channels found or failed to parse data.');
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

        // ফাইল সেভ করা
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
