import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3300;
const SCROLL_FILE = path.join(__dirname, 'scroll.json');
const NEWS_FILE_PATH = path.join(__dirname, 'news.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kfmx-admin-2024'; // Default password
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

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

    const urlPathNewsFetch = req.url.split('?')[0].replace(/\/$/, '');
    if (urlPathNewsFetch === '/api/news/fetch' || urlPathNewsFetch === '/news/fetch') {
        if (req.method === 'POST') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            try {
                console.log(`[NEWS] Manual fetch triggered...`);
                await fetchDailyNews();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, message: 'News fetch completed' }));
            } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to fetch news manually' }));
            }
            return;
        }
    }

    const urlPathNews = req.url.split('?')[0].replace(/\/$/, '');
    if (urlPathNews === '/api/news' || urlPathNews === '/news') {
        const NEWS_FILE = NEWS_FILE_PATH;

        if (req.method === 'GET') {
            try {
                // Run cleanup of old unpinned news on each GET request
                await cleanupOldNews();
                const data = await fs.readFile(NEWS_FILE, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
            return;
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    let existing = [];
                    try {
                        const fileData = await fs.readFile(NEWS_FILE, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    if (req.method === 'POST') {
                        const newsItem = {
                            ...data,
                            id: Date.now().toString(),
                            createdAt: new Date().toISOString()
                        };
                        existing.unshift(newsItem);
                    } else { // PUT
                        const index = existing.findIndex(item => item.id === (data.id || '').toString());
                        if (index === -1) {
                            res.statusCode = 404;
                            res.end(JSON.stringify({ error: 'News item not found' }));
                            return;
                        }
                        existing[index] = {
                            ...existing[index],
                            ...data,
                            updatedAt: new Date().toISOString()
                        };
                    }

                    await fs.writeFile(NEWS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process news item' }));
                }
            });
            return;
        }

        if (req.method === 'DELETE') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            const query = new URL(req.url, 'http://localhost').searchParams;
            const id = query.get('id');

            if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'ID is required' }));
                return;
            }

            try {
                const fileData = await fs.readFile(NEWS_FILE, 'utf-8');
                let existing = JSON.parse(fileData);
                const filtered = existing.filter(item => item.id !== id.toString());

                await fs.writeFile(NEWS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to delete news item' }));
            }
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

// ---- Auto-delete unpinned news older than 3 days ----
const cleanupOldNews = async () => {
    try {
        const fileData = await fs.readFile(NEWS_FILE_PATH, 'utf-8');
        const allNews = JSON.parse(fileData);
        const now = Date.now();

        const filtered = allNews.filter(item => {
            // Always keep pinned news
            if (item.pinned) return true;
            // Remove unpinned news older than 3 days
            const createdAt = new Date(item.createdAt).getTime();
            return (now - createdAt) < THREE_DAYS_MS;
        });

        const removedCount = allNews.length - filtered.length;
        if (removedCount > 0) {
            await fs.writeFile(NEWS_FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
            console.log(`[NEWS CLEANUP] Removed ${removedCount} unpinned news item(s) older than 3 days.`);
        }
    } catch (error) {
        // File might not exist yet, that's fine
        if (error.code !== 'ENOENT') {
            console.error('[NEWS CLEANUP] Error cleaning up old news:', error);
        }
    }
};

// Run cleanup on server startup
cleanupOldNews();

// Run cleanup every 6 hours
setInterval(cleanupOldNews, 6 * 60 * 60 * 1000);

const fetchDailyNews = async () => {
    try {
        const LAST_FETCH_FILE = path.join(__dirname, 'last_news_fetch.json');
        let lastFetch = 0;
        try {
            const data = await fs.readFile(LAST_FETCH_FILE, 'utf-8');
            lastFetch = JSON.parse(data).timestamp || 0;
        } catch (e) { }

        const now = Date.now();
        const NEWS_FILE = path.join(__dirname, 'news.json');
        let existing = [];
        try {
            const fileData = await fs.readFile(NEWS_FILE, 'utf-8');
            existing = JSON.parse(fileData);
        } catch (e) { }

        const fetchedArticles = [];

        // 1. NewsAPI.org
        const newsApiKey = process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY;
        if (newsApiKey) {
            try {
                console.log(`[NEWS] Fetching from NewsAPI.org...`);
                let url = `https://newsapi.org/v2/top-headlines?country=ng&pageSize=10&apiKey=${encodeURIComponent(newsApiKey)}`;
                let response = await fetch(url);
                let json = await response.json();

                if (json.status === 'ok' && json.articles) {
                    json.articles.forEach(a => fetchedArticles.push({
                        title: `${a.title} - ${a.source?.name || 'NewsAPI'}`,
                        content: a.url || a.description || 'Read more',
                        source: 'NewsAPI'
                    }));
                }
            } catch (e) { console.error('[NEWS] NewsAPI error:', e); }
        }

        // 2. NewsData.io
        const newsDataKey = process.env.NEWSDATA_API_KEY;
        if (newsDataKey) {
            try {
                console.log(`[NEWS] Fetching from NewsData.io...`);
                let url = `https://newsdata.io/api/1/news?apikey=${encodeURIComponent(newsDataKey)}&country=ng&language=en`;
                let response = await fetch(url);
                let json = await response.json();

                if (json.status === 'success' && json.results) {
                    json.results.forEach(a => fetchedArticles.push({
                        title: a.title,
                        content: a.link || a.description || 'Read more',
                        source: 'NewsData.io'
                    }));
                }
            } catch (e) { console.error('[NEWS] NewsData error:', e); }
        }

        // 3. GNews.io
        const gnewsKey = process.env.GNEWS_API_KEY;
        if (gnewsKey) {
            try {
                console.log(`[NEWS] Fetching from GNews.io...`);
                let url = `https://gnews.io/api/v4/top-headlines?category=general&lang=en&country=ng&max=10&apikey=${encodeURIComponent(gnewsKey)}`;
                let response = await fetch(url);
                let json = await response.json();

                if (json.articles) {
                    json.articles.forEach(a => fetchedArticles.push({
                        title: `${a.title} - ${a.source?.name || 'GNews'}`,
                        content: a.url || a.description || 'Read more',
                        source: 'GNews'
                    }));
                }
            } catch (e) { console.error('[NEWS] GNews error:', e); }
        }

        let addedCount = 0;
        const newItems = [];

        for (const article of fetchedArticles) {
            // Check to avoid exact duplicates
            if (!existing.some(item => item.title === article.title || item.content === article.content)) {
                newItems.push({
                    id: Date.now().toString() + Math.random().toString().slice(2, 8),
                    title: article.title,
                    content: article.content,
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
        console.log(`[NEWS] Successfully added ${addedCount} news items from multiple sources.`);

        // Clean up old unpinned news after each fetch
        await cleanupOldNews();

    } catch (error) {
        console.error('[NEWS] Error fetching daily news:', error);
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
