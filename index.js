const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Cloudflare Protection বাইপাস করার জন্য Stealth Plugin
puppeteer.use(StealthPlugin());

const API_URL = 'https://api.cirkletv.com/api/live-tv?page=1&limit=200';

async function generatePlaylists() {
    console.log('Launching headless browser to bypass Cloudflare...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const page = await browser.newPage();

        // ব্রাউজার ইউজার এজেন্ট সেট করা
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log('Navigating to API URL...');
        await page.goto(API_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Cloudflare Challenge পার হওয়ার জন্য কিছুক্ষণ অপেক্ষা
        await new Promise(r => setTimeout(r, 5000));

        // পেজের ভেতরের JSON রেসপন্স টেক্সট নেওয়া
        const content = await page.evaluate(() => document.body.innerText);
        
        const responseData = JSON.parse(content);
        const channels = responseData.data || responseData.channels || responseData;

        if (!Array.isArray(channels)) {
            throw new Error('Response is not an array. Cloudflare challenge might have failed.');
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

        // ফাইল দুটি তৈরি করা
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
    } finally {
        await browser.close();
    }
}

generatePlaylists();
