const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

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

        // পেজের কন্টেন্ট নেওয়া
        const content = await page.evaluate(() => document.body.innerText || document.body.textContent);
        
        console.log('--- API RESPONSE START ---');
        console.log(content.substring(0, 500)); // প্রথম ৫০০ ক্যারেক্টার লগে দেখাবে
        console.log('--- API RESPONSE END ---');

        let responseData;
        try {
            responseData = JSON.parse(content);
        } catch (e) {
            throw new Error('API Response is not JSON. Cloudflare Challenge page detected.');
        }

        // বিভিন্ন সম্ভাব্য স্ট্রাকচার থেকে ডাটা খোঁজা
        let channels = null;
        if (Array.isArray(responseData)) {
            channels = responseData;
        } else if (Array.isArray(responseData.data)) {
            channels = responseData.data;
        } else if (Array.isArray(responseData.channels)) {
            channels = responseData.channels;
        } else if (responseData.data && Array.isArray(responseData.data.channels)) {
            channels = responseData.data.channels;
        } else if (responseData.data && Array.isArray(responseData.data.data)) {
            channels = responseData.data.data;
        } else if (typeof responseData === 'object') {
            // যদি অন্য কোনো কি (key) এর মধ্যে অ্যারে থাকে
            for (const key in responseData) {
                if (Array.isArray(responseData[key])) {
                    channels = responseData[key];
                    break;
                }
            }
        }

        if (!channels || !Array.isArray(channels) || channels.length === 0) {
            throw new Error('Could not parse channel array. Structure received: ' + JSON.stringify(responseData).substring(0, 200));
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
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
