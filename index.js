const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const BASE_API_URL = 'https://api.cirkletv.com/api/live-tv?limit=100&page=';

// ক্যাটাগরি ম্যাপিং (Islamic একদম শেষে রাখা হয়েছে)
const CATEGORY_MAP = {
    'Sports': [
        'sports', 'cricket', 'football', 't sports', 'gtv', 'gazi', 'star sports', 'sony ten', 
        'ten 1', 'ten 2', 'ten 3', 'willow', 'ptv sports', 'astro', 'eurosport', 'a sports', 
        'beIN', 'supersport', 'premier sports', 'sports18'
    ],
    'News': [
        'news', 'somoy', 'jamuna', 'independent', 'ekattor', '71', 'channel 24', 'dbc', 
        'news24', 'atn news', 'bvnews', 'bbc', 'cnn', 'al jazeera', 'ndtv', 'republic', 'aaj tak'
    ],
    'Bangla Entertainment': [
        'star jalsha', 'zee bangla', 'colors bangla', 'atn bangla', 'channel i', 'ntv', 'rtv', 
        'banglavision', 'boishakhi', 'deepto', 'nagorik', 'maasranga', 'duronto', 'asian tv', 
        'bangla tv', 'sangeet bangla', 'sun bangla', 'enterr10 bangla'
    ],
    'Hindi Entertainment': [
        'star plus', 'zee tv', 'colors', 'sony tv', 'sony sab', 'star bharat', 'dangal', 
        'colors rishtey', 'zee anmol', 'star utsav'
    ],
    'Movies': [
        // বাংলা মুভি চ্যানেল
        'jalsha movies', 'zee bangla cinema', 'colors bangla cinema', 'khushboo',
        // হিন্দি ও সাউথ ইন্ডিয়ান ডাবড মুভি চ্যানেল
        'star gold', 'zee cinema', 'sony max', 'colors cineplex', 'goldmines', 'sony wah', 
        'star utsav movies', 'zee anmol cinema', 'b4u movies', 'enterr10 movies', 'cinema tv', 
        'manoranjan', 'rishtey cineplex', 'utv movies', 'utv action', 'and pictures', '&pictures',
        // হলিউড ও ইংরেজি মুভি চ্যানেল
        'hbo', 'star movies', 'sony pix', 'wb', 'warner bros', 'axn', 'fox movies', 
        'cinema world', 'movies now', 'mnx', 'romedy now'
    ],
    'Infotainment': [
        'discovery', 'national geographic', 'nat geo', 'animal planet', 'history tv', 
        'investigation discovery', 'nat geo wild', 'discovery science', 'turbo'
    ],
    'Kids': [
        'cartoon network', 'nick', 'nickelodeon', 'pogo', 'hungama', 'disney', 'duronto', 
        'sonic', 'discovery kids', 'baby tv'
    ],
    'Music': [
        'm tv', 'mtv', '9xm', 'zoom', 'sangeet bangla', 'mastiii', 'b4u music', 'm4u', 'music india'
    ],
    'Islamic': [
        'makkah', 'madinah', 'saudi quran', 'saudi sunnah', 'peace tv', 'peace tv bangla', 
        'peace tv urdu', 'islamic tv', 'quran tv', 'sunnah tv', 'guide us', 'iqraa', 
        'huda tv', 'madani channel', 'islam'
    ]
};

function detectCategory(channelName, rawCategory) {
    const nameLower = (channelName || '').toLowerCase().trim();
    const catLower = (rawCategory || '').toLowerCase().trim();

    for (const [categoryName, keywords] of Object.entries(CATEGORY_MAP)) {
        if (keywords.some(keyword => nameLower.includes(keyword) || catLower.includes(keyword))) {
            return categoryName;
        }
    }

    return null; // তালিকার বাইরে থাকা অকেজো চ্যানেল স্কিপ করবে
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

        console.log(`Total channels fetched from API: ${allChannels.length}`);

        const groupedChannels = {};
        Object.keys(CATEGORY_MAP).forEach(cat => {
            groupedChannels[cat] = [];
        });

        allChannels.forEach(channel => {
            const name = channel.title || channel.name || 'Unknown Channel';
            const rawCategory = typeof channel.category === 'object' ? (channel.category?.name || '') : (channel.category || '');
            
            const categoryName = detectCategory(name, rawCategory);

            if (!categoryName) return;

            const id = channel._id || channel.id || '';
            const logo = getChannelLogo(channel);
            const rawStream = channel.url || channel.streamUrl || channel.stream || '';
            const streamUrls = extractUrls(rawStream);

            if (streamUrls.length > 0) {
                groupedChannels[categoryName].push({
                    id,
                    name,
                    logo,
                    category: categoryName,
                    urls: streamUrls
                });
            }
        });

        let m3uContent = '#EXTM3U\n\n';
        const finalJsonChannels = [];

        Object.keys(CATEGORY_MAP).forEach(categoryName => {
            const channelList = groupedChannels[categoryName];

            if (channelList.length > 0) {
                m3uContent += `\n# ==========================================\n`;
                m3uContent += `# CATEGORY: ${categoryName.toUpperCase()}\n`;
                m3uContent += `# ==========================================\n\n`;

                channelList.forEach(channel => {
                    m3uContent += `#EXTINF:-1 tvg-id="${channel.id}" tvg-logo="${channel.logo}" group-title="${categoryName}",${channel.name}\n`;
                    m3uContent += `${channel.urls[0]}\n`;

                    for (let i = 1; i < channel.urls.length; i++) {
                        m3uContent += `#${channel.urls[i]}\n`;
                    }
                    m3uContent += `\n`;

                    finalJsonChannels.push(channel);
                });
            }
        });

        fs.writeFileSync('circle.m3u', m3uContent, 'utf8');
        fs.writeFileSync('circle.json', JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: finalJsonChannels.length,
            channels: finalJsonChannels
        }, null, 2), 'utf8');

        console.log(`Success! Generated circle.m3u & circle.json with Islamic category at the END.`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
