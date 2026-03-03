import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3300;
const SCROLL_FILE = path.join(__dirname, 'scroll.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kfmx-admin-2024'; // Default password

const verifyAuth = (req) => {
    const authHeader = req.headers['authorization'] || req.headers['x-admin-password'];
    const expected = (process.env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
    let provided = (authHeader || '').trim();
    if (provided.startsWith('Bearer ')) {
        provided = provided.substring(7).trim();
    }

    if (provided !== expected) {
        console.log(`[AUTH] Failed attempt. Provided length: ${provided.length}, Expected length: ${expected.length}`);
        return false;
    }
    return true;
};

const server = http.createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.url === '/api/scroll' || req.url === '/scroll') {
        if (req.method === 'GET') {
            try {
                const data = await fs.readFile(SCROLL_FILE, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                // If file doesn't exist, return a default config instead of 404
                const defaultConfig = { overrideEnabled: false, overrideMessage: "" };
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(defaultConfig));
            }
            return;
        }

        if (req.method === 'POST') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    // Basic validation
                    JSON.parse(body);
                    await fs.writeFile(SCROLL_FILE, body, 'utf-8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Invalid JSON or failed to write' }));
                }
            });
            return;
        }
    }

    const urlPathPrayer = req.url.split('?')[0].replace(/\/$/, '');
    if (urlPathPrayer === '/api/prayer-request' || urlPathPrayer === '/prayer-request') {
        if (req.method === 'GET') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            try {
                const filePath = path.join(__dirname, 'prayer_requests.json');
                const data = await fs.readFile(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const submission = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'prayer_requests.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(submission);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process submission' }));
                }
            });
            return;
        }
    }

    const urlPathTestimonies = req.url.split('?')[0].replace(/\/$/, '');
    if (urlPathTestimonies === '/api/testimonies' || urlPathTestimonies === '/testimonies') {
        if (req.method === 'GET') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            try {
                const filePath = path.join(__dirname, 'testimonies.json');
                const data = await fs.readFile(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const submission = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'testimonies.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(submission);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process submission' }));
                }
            });
            return;
        }
    }

    const urlPathDonations = req.url.split('?')[0].replace(/\/$/, '');
    if (urlPathDonations === '/api/donations' || urlPathDonations === '/donations') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const donation = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'donations.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(donation);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process donation log' }));
                }
            });
            return;
        }
    }


    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
    console.log(`API Server running at http://localhost:${PORT}`);
    console.log(`Handling /api/scroll -> ${SCROLL_FILE}`);
});

const fetchDailyNews = async () => {
    try {
        const LAST_FETCH_FILE = path.join(__dirname, 'last_news_fetch.json');
        let lastFetch = 0;
        try {
            const data = await fs.readFile(LAST_FETCH_FILE, 'utf-8');
            lastFetch = JSON.parse(data).timestamp || 0;
        } catch (e) { }

        const now = Date.now();
        const newsApiKey = process.env.NEWS_API_KEY || "6a2264d7f14a47229a9c14610194ab70";
        let url = `https://newsapi.org/v2/top-headlines?country=ng&pageSize=5&apiKey=${encodeURIComponent(newsApiKey)}`;

        console.log(`[NEWSAPI] Fetching daily news...`);
        let response = await fetch(url);
        let json = await response.json();

        // Fallback to global english news if Nigeria-specific query returns 0 results
        if (json.status === 'ok' && (!json.articles || json.articles.length === 0)) {
            console.log(`[NEWSAPI] No Nigerian news found, falling back to general English news...`);
            url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&apiKey=${encodeURIComponent(newsApiKey)}`;
            response = await fetch(url);
            json = await response.json();
        }

        if (json.status !== 'ok') {
            console.error('[NEWSAPI] Failed to fetch:', json);
            return;
        }

        const NEWS_FILE = path.join(__dirname, 'news.json');
        let existing = [];
        try {
            const fileData = await fs.readFile(NEWS_FILE, 'utf-8');
            existing = JSON.parse(fileData);
        } catch (e) { }

        let addedCount = 0;
        const newItems = [];

        for (const article of json.articles || []) {
            const title = `${article.title || 'Breaking News'} - ${article.source?.name || 'NewsAPI'}`;
            const content = article.url || article.description || 'Read more';

            // Check to avoid exact duplicates
            if (!existing.some(item => item.title === title || item.content === content)) {
                newItems.push({
                    id: Date.now().toString() + Math.random().toString().slice(2, 8),
                    title: title,
                    content: content,
                    status: 'Published',
                    pinned: false,
                    createdAt: new Date().toISOString()
                });
                addedCount++;
            }
        }

        if (newItems.length > 0) {
            existing = [...newItems, ...existing];
            await fs.writeFile(NEWS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
        }

        await fs.writeFile(LAST_FETCH_FILE, JSON.stringify({ timestamp: now }), 'utf-8');
        console.log(`[NEWSAPI] Successfully added ${addedCount} news items.`);

    } catch (error) {
        console.error('[NEWSAPI] Error fetching daily news:', error);
    }
};

const scheduleNextFetch = () => {
    const now = new Date();
    // Default fetch time is 6:00 AM local time daily
    const fetchTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0);

    // If it's already past 6:00 AM today, schedule for 6:00 AM tomorrow
    if (now > fetchTime) {
        fetchTime.setDate(fetchTime.getDate() + 1);
    }

    const msUntilFetch = fetchTime.getTime() - now.getTime();
    console.log(`[NEWSAPI] Next news fetch scheduled for ${fetchTime.toLocaleString()} (in ${Math.round(msUntilFetch / 60000)} minutes)`);

    setTimeout(() => {
        fetchDailyNews();
        // Once executed, schedule the next one
        scheduleNextFetch();
    }, msUntilFetch);
};

const checkInitialFetch = async () => {
    try {
        const LAST_FETCH_FILE = path.join(__dirname, 'last_news_fetch.json');
        let lastFetch = 0;
        try {
            const data = await fs.readFile(LAST_FETCH_FILE, 'utf-8');
            lastFetch = JSON.parse(data).timestamp || 0;
        } catch (e) { }

        // If we haven't fetched in the last 20 hours, do it now regardless of what time it is
        if (Date.now() - lastFetch > 20 * 60 * 60 * 1000) {
            console.log(`[NEWSAPI] Catching up on missed daily news fetch...`);
            await fetchDailyNews();
        }
    } catch (e) { }

    scheduleNextFetch();
};

checkInitialFetch();
