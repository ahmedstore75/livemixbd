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

// সুপারফাস্ট লিংক চেকার (টাইমাউট ২০০০ms)
function isUrlWorking(url, timeoutMs = 2000) {
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
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            const req = client.request(options, (res) => {
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

// একসাথে অনেকগুলো লিংক প্যারালালে চেক করা
async function filterActiveUrls(streamUrls) {
    const results = await Promise.all(
        streamUrls.map(async (url) => {
            const active = await isUrlWorking(url);
            return active ? url : null;
        })
    );
    return results.filter(Boolean);
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
            console.log(`Fetching Page ${currentPage}...`);
            
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
        console.log('Fast parallel checking active stream links...');

        // প্যারালাল প্রসেসিং (৩০টি চ্যানেল একসাথে ফিল্টার হবে)
        const BATCH_SIZE = 30;
        const validChannels = [];

        for (let i = 0; i < allChannels.length; i += BATCH_SIZE) {
            const batch = allChannels.slice(i, i + BATCH_SIZE);
            const processedBatch = await Promise.all(
                batch.map(async (channel) => {
                    const rawStream = channel.url || channel.streamUrl || channel.stream || '';
                    const streamUrls = extractUrls(rawStream);
                    const activeStreamUrls = await filterActiveUrls(streamUrls);

                    if (activeStreamUrls.length > 0) {
                        return {
                            id: channel._id || channel.id || '',
                            name: channel.title || channel.name || 'Unknown Channel',
                            logo: getChannelLogo(channel),
                            category: typeof channel.category === 'object' ? (channel.category?.name || 'General') : (channel.category || 'General'),
                            urls: activeStreamUrls
                        };
                    }
                    return null;
                })
            );

            validChannels.push(...processedBatch.filter(Boolean));
        }

        let m3uContent = '#EXTM3U\n\n';
        validChannels.forEach(channel => {
            m3uContent += `#EXTINF:-1 tvg-id="${channel.id}" tvg-logo="${channel.logo}" group-title="${channel.category}",${channel.name}\n`;
            m3uContent += `${channel.urls[0]}\n`;

            for (let i = 1; i < channel.urls.length; i++) {
                m3uContent += `#${channel.urls[i]}\n`;
            }
            m3uContent += `\n`;
        });

        fs.writeFileSync('circle.m3u', m3uContent, 'utf8');
        fs.writeFileSync('circle.json', JSON.stringify({
            updated_at: new Date().toISOString(),
            total_channels: validChannels.length,
            channels: validChannels
        }, null, 2), 'utf8');

        console.log(`Success! Generated circle.m3u & circle.json with ONLY ${validChannels.length} ACTIVE channels in fast speed.`);

    } catch (error) {
        console.error('Execution Failed:', error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

generatePlaylists();
