const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_API_URL = 'https://api.cirkletv.com/api/live-tv?limit=100&page=';

// পপুলার চ্যানেলগুলোর কি-ওয়ার্ড বা নামের তালিকা
const POPULAR_KEYWORDS = [
    // News Channels
    'somoy', 'jamuna', 'independent', 'ekattor', '71', 'channel 24', 'dbclearning', 'dbc', 'news24', 'atn news', 'bvnews',
    // Entertainment & Movies (BD & India)
    'star plus', 'star jalsha', 'zee bangla', 'zee tv', 'colors', 'sony tv', 'sony sab', 'star gold', 'zee cinema', 'sony max',
    'atn bangla', 'channel i', 'ntv', 'rtv', 'banglavision', 'boishakhi', 'deepto', 'nagorik', 'duronto', 'maasranga', 'gazi', 'gtv',
    // Sports
    't sports', 'sports', 'cricket', 'football', 'star sports', 'sony ten', 'ten 1', 'ten 2', 'ten 3', 'willow', 'ptv sports', 'astro',
    // Infotainment & Kids
    'discovery', 'national geographic', 'nat geo', 'animal planet', 'nick', 'pogo', 'cartoon network', 'hungama', 'disney'
];

function isPopularChannel(channelName) {
    if (!channelName) return false;
    const nameLower = channelName.toLowerCase().trim();
    
    // চেক করবে চ্যানেল নাম পপুলার লিস্টের কোনো কি-ওয়ার্ডের সাথে মেলে কিনা
    return POPULAR_KEYWORDS.some(keyword => nameLower.includes(keyword));
}

function getChannelLogo(channel) {
    if (!channel) return '';
    return channel.poster || channel.thumbnail || channel.logo || channel.icon || channel.image || '';
}

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

        let allChannels = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const url = `${BASE_API_URL}${currentPage}`;
            console.log(`Fetching Page ${currentPage} of ${totalPages}...`);
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            const content = await page.evaluate(() => document.body.innerText || document.body.textContent);
            const responseData = JSON.parse(content);

            let pageChannels = [];
            if (responseData && responseData.data && Array.isArray(responseData.data.data)) {
                pageChannels = responseData.data.data;
                if (responseData.data.pagination && responseData.data.pagination.totalPages) {
                    totalPages = responseData.data.pagination.totalPages;
                }
            } else if (responseData && Array.isArray(responseData.data)) {
                pageChannels = responseData.data;
            } else if (Array.isArray(responseData)) {
                pageChannels = responseData;
            }

            if (pageChannels && pageChannels.length > 0) {
                allChannels = allChannels.concat(pageChannels);
            } else {
                console.log(`No channels found on page ${currentPage}, stopping pagination.`);
                break;
            }

            currentPage++;
        } while (currentPage <= totalPages);

        console.log(`Total raw channels fetched: ${allChannels.length}`);

        if (allChannels.length === 0) {
            throw new Error('Could not parse any channels from the API response.');
        }

        let m3uContent = '#EXTM3U\n\n';
        const jsonChannels = [];

        allChannels.forEach(channel => {
            const name = channel.title || channel.name || '';

            // পপুলার চ্যানেল ফিল্টারিং শর্ত
            if (!isPopularChannel(name)) {
                return; // লিস্টে না মিললে চ্যানেলটি বাদ যাবে
            }

            const id = channel._id || channel.id || '';
            const logo = getChannelLogo(channel);
            const category = typeof channel.category === 'object' ? (channel.category?.name || 'General') : (channel.category || 'General');

            const rawStream = channel.url || channel.streamUrl || channel.stream || '';
            const streamUrls = extractUrls(rawStream);

            if (streamUrls.length > 0) {
                m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${category}",${name}\n`;

                m3uContent += `${streamUrls[0]}\n`;

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

        console.log(`Success! Generated circle.m3u & circle.json with ${jsonChannels.length} popular channels.`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
