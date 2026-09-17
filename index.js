const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const https = require('https');
const http = require('http');

puppeteer.use(StealthPlugin());

const BASE_API_URL = 'https://api.cirkletv.com/api/live-tv?limit=100&page=';

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

// লিংক সচল আছে কিনা (Active/Working) তা পরীক্ষা করার হেল্পার ফাংশন
function isUrlWorking(url, timeoutMs = 5000) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                method: 'HEAD',
                host: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                timeout: timeoutMs,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            };

            const req = client.request(options, (res) => {
                // স্ট্যাটাস কোড ২০০ থেকে ৩৯৯ এর মধ্যে হলে অ্যাক্টিভ হিসেবে ধরা হবে
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        } catch (e) {
            resolve(false);
        }
    });
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

        // পেজিনেশন লুপ - সব পেজ ফেচ করা
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
                break;
            }

            currentPage++;
        } while (currentPage <= totalPages);

        console.log(`Total channels fetched from API: ${allChannels.length}`);
        console.log('Checking for active/working stream links...');

        let m3uContent = '#EXTM3U\n\n';
        const jsonChannels = [];

        // প্রতিটি চ্যানেল ভ্যালিডেশন লুপ
        for (const channel of allChannels) {
            const id = channel._id || channel.id || '';
            const name = channel.title || channel.name || 'Unknown Channel';
            const logo = getChannelLogo(channel);
            const category = typeof channel.category === 'object' ? (channel.category?.name || 'General') : (channel.category || 'General');

            const rawStream = channel.url || channel.streamUrl || channel.stream || '';
            const streamUrls = extractUrls(rawStream);

            // শুধু কার্যকর (Active) লিংকগুলোর জন্য ফিল্টার
            const activeStreamUrls = [];
            for (const streamUrl of streamUrls) {
                const isValid = await isUrlWorking(streamUrl);
                if (isValid) {
                    activeStreamUrls.push(streamUrl);
                }
            }

            // চ্যানেলটিতে যদি অন্তত একটি অ্যাক্টিভ লিংক পাওয়া যায়
            if (activeStreamUrls.length > 0) {
                m3uContent += `#EXTINF:-1 tvg-id="${id}" tvg-logo="${logo}" group-title="${category}",${name}\n`;

                // প্রথম লিংক সাধারণ
                m3uContent += `${activeStreamUrls[0]}\n`;

                // অতিরিক্ত একটিভ লিংকের শুরুতে '#' (হ্যাশ)
                for (let i = 1; i < activeStreamUrls.length; i++) {
                    m3uContent += `#${activeStreamUrls[i]}\n`;
                }

                m3uContent += `\n`;

                jsonChannels.push({ id, name, logo, category, urls: activeStreamUrls });
            }
        }

        fs.writeFileSync('circle.m3u', m3uContent, 'utf8');
        fs.writeFileSync('circle.json', JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: jsonChannels.length,
            channels: jsonChannels
        }, null, 2), 'utf8');

        console.log(`Success! Generated circle.m3u & circle.json with ONLY ${jsonChannels.length} ACTIVE channels.`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
