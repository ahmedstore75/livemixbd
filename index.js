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
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Referer': 'https://cirkletv.com/',
            'Origin': 'https://cirkletv.com'
        });

        console.log('Fetching API Data via Puppeteer...');
        await page.goto(API_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const content = await page.evaluate(() => document.body.innerText);
        const responseData = JSON.parse(content);

        let channels = [];
        if (Array.isArray(responseData)) {
            channels = responseData;
        } else if (Array.isArray(responseData.data)) {
            channels = responseData.data;
        } else if (Array.isArray(responseData.channels)) {
            channels = responseData.channels;
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
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
