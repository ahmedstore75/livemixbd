const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

// রেসপন্স থেকে সঠিক লোগো বের করার ফাংশন
function getChannelLogo(channel) {
    if (!channel) return '';
    return channel.poster || channel.thumbnail || channel.logo || channel.icon || channel.image || '';
}

// স্পেস বা একাধিক URL যুক্ত স্ট্রিং থেকে আলাদা লিংক বের করার ফাংশন
function extractUrls(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.flatMap(item => extractUrls(item));
    }
    if (typeof input === 'string') {
        const matches = input.match(/https?:\/\/[^\s,\n"']+/g);
        return matches || [];
    }
    return [];
}

async function generatePlaylists() {
    let browser;
    try {
        console.log('Launching Headless Browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        console.log('Navigating to API URL...');
        await page.goto(API_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const content = await page.evaluate(() => document.body.innerText || document.body.textContent);
        const responseData = JSON.parse(content);

        // API ডাটা অ্যারে স্ট্রাকচার চেক
        let channels = null;
        if (responseData && responseData.data && Array.isArray(responseData.data.data)) {
            channels = responseData.data.data;
        } else if (responseData && Array.isArray(responseData.data)) {
            channels = responseData.data;
        } else if (Array.isArray(responseData)) {
            channels = responseData;
        }

        if (!channels || !Array.isArray(channels) || channels.length === 0) {
            throw new Error('Could not parse channel array from response.');
        }

        let m3uContent = '#EXTM3U\n\n';
        const jsonChannels = [];

        channels.forEach(channel => {
            const id = channel._id || channel.id || '';
            const name = channel.title || channel.name || 'Unknown Channel';
            
            // লোগো এক্সট্রাকশন (poster / thumbnail)
            const logo = getChannelLogo(channel);
            
            // ক্যাটাগরি এক্সট্রাকশন
            const category = typeof channel.category === 'object' ? (channel.category?.name || 'Sports') : (channel.category || 'Sports');

            // একাধিক স্ট্রিমিং URL ফিল্টার করা
            const rawStream = channel.url || channel.streamUrl || channel.stream || '';
            const streamUrls = extractUrls(rawStream);

            if (streamUrls.length > 0) {
                m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${category}",${name}\n`;

                // প্রথম লিংকটি সরাসরি
                m3uContent += `${streamUrls[0]}\n`;

                // ২য়, ৩য় বা অতিরিক্ত লিংকগুলোর শুরুতে '#' (হ্যাশ)
                for (let i = 1; i < streamUrls.length; i++) {
                    m3uContent += `#${streamUrls[i]}\n`;
                }

                m3uContent += `\n`;

                jsonChannels.push({ id, name, logo, category, urls: streamUrls });
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
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
