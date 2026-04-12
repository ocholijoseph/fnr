import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || process.argv[2] || 3001;
const HEADLINES_CACHE_FILE = path.join(__dirname, 'headlines_cache.json');
const SCROLL_FILE = path.join(__dirname, 'scroll.json');
const NEWS_FILE_PATH = path.join(__dirname, 'news.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kfmx-admin-2024';
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

// Enhanced Supabase client for backend with auto-refresh and retry
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false
    },
    global: {
        headers: { 'x-application-name': 'fnr-api-server' },
    },
}) : null;

const PROVIDERS = ['newsapi', 'newsdata', 'gnews'];

const API_LIMITS = {
    newsapi: { requests: 100, articles: 500 },
    newsdata: { requests: 100, articles: 200 },
    gnews: { requests: 100, articles: 50 }
};

let dailyStats = {
    date: new Date().toDateString(),
    requests: { newsapi: 0, newsdata: 0, gnews: 0 },
    articles: { newsapi: 0, newsdata: 0, gnews: 0 }
};

const DEFAULT_SOCIALS = [
    { id: "1", platform: "instagram", url: "https://instagram.com/freedomnaijaradio", enabled: true },
    { id: "2", platform: "facebook", url: "https://facebook.com/freedomnaijaradio", enabled: true },
    { id: "3", platform: "twitter", url: "https://twitter.com/freedomnaijaradio", enabled: true },
    { id: "4", platform: "whatsapp", url: "https://wa.me/2348000000000", enabled: true }
];

const AFRICA_COUNTRIES = ['nigeria', 'ghana', 'kenya', 'south africa', 'egypt', 'ethiopia', 'tanzania', 'uganda', 'cameroon', 'senegal', 'algeria', 'morocco', 'tunisia', 'angola', 'mozambique', 'zambia', 'zimbabwe', 'malawi', 'mali', 'niger', 'chad', 'sudan', 'libya', 'congo', 'rwanda', 'ivory coast', 'benin', 'togo', 'burkina faso', 'guinea', 'sierra leone', 'liberia', 'gambia', 'gabon', 'namibia', 'botswana', 'lesotho', 'eswatini', 'mauritius', 'madagascar', 'somalia', 'eritrea', 'djibouti'];
const NIGERIA_KEYWORDS = ['nigeria', 'nigerian', 'lagos', 'abuja', 'naira', 'buhari', 'tinubu', 'inec', 'nollywood', 'afcon', 'super eagles', 'efcc', 'nnpc', 'nafdac'];

function stripHtml(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function normalizeForComparison(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function areTitlesSimilar(a, b, threshold = 0.6) {
    const wordsA = new Set(normalizeForComparison(a).split(' ').filter(w => w.length > 2));
    const wordsB = new Set(normalizeForComparison(b).split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size >= threshold;
}

function detectRegion(title, summary) {
    const combined = `${title} ${summary}`.toLowerCase();
    if (NIGERIA_KEYWORDS.some(kw => combined.includes(kw))) return 'nigeria';
    if (AFRICA_COUNTRIES.some(c => combined.includes(c)) || combined.includes('africa')) return 'africa';
    return 'world';
}

async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function withRetry(fn, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    throw lastError;
}

async function supabaseSelect(table, select = '*') {
    if (!supabase) return null;
    try {
        const { data, error } = await withRetry(() => supabase.from(table).select(select));
        if (error) {
            console.warn(`[Supabase] select ${table} failed:`, error.message);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[Supabase] select ${table} exception:`, error.message || error);
        return null;
    }
}

async function supabaseUpsert(table, rows) {
    if (!supabase) return null;
    try {
        const { data, error } = await withRetry(() => supabase.from(table).upsert(rows, { onConflict: 'id' }).select());
        if (error) {
            console.warn(`[Supabase] upsert ${table} failed:`, error.message);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[Supabase] upsert ${table} exception:`, error.message || error);
        return null;
    }
}

async function supabaseInsert(table, row) {
    if (!supabase) return null;
    try {
        const { data, error } = await withRetry(() => supabase.from(table).insert([row]).select());
        if (error) {
            console.warn(`[Supabase] insert ${table} failed:`, error.message);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`[Supabase] insert ${table} exception:`, error.message || error);
        return null;
    }
}

async function supabaseDelete(table, id) {
    if (!supabase) return false;
    try {
        const { error } = await withRetry(() => supabase.from(table).delete().eq('id', id));
        if (error) {
            console.warn(`[Supabase] delete ${table} id=${id} failed:`, error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[Supabase] delete ${table} id=${id} exception:`, error.message || error);
        return false;
    }
}

async function readStorage(table, filePath, fallback) {
    const supabaseData = await supabaseSelect(table);
    if (supabaseData !== null && supabaseData.length > 0) {
        return supabaseData;
    }
    return await readJsonFile(filePath, fallback);
}

async function saveStorage(table, filePath, rows) {
    const supabaseData = await supabaseUpsert(table, rows);
    if (supabaseData !== null) {
        return supabaseData;
    }
    await writeJsonFile(filePath, rows);
    return rows;
}

async function insertStorage(table, filePath, row) {
    const supabaseData = await supabaseInsert(table, row);
    if (supabaseData !== null && supabaseData.length > 0) {
        return supabaseData[0];
    }
    const existing = await readJsonFile(filePath, []);
    const next = [...existing, row];
    await writeJsonFile(filePath, next);
    return row;
}

async function deleteStorage(table, filePath, id) {
    const supabaseResult = await supabaseDelete(table, id);
    const existing = await readJsonFile(filePath, []);
    const next = existing.filter(item => item.id.toString() !== id.toString());
    const fileUpdated = next.length !== existing.length;
    if (fileUpdated) {
        await writeJsonFile(filePath, next);
    }
    return supabaseResult || fileUpdated;
}

async function upsertStorage(table, filePath, row) {
    let dataToUpsert = row;
    if (table === 'scroll') {
        dataToUpsert = {
            id: 'scroll-config',
            override_enabled: row.override_enabled ?? row.overrideEnabled ?? false,
            override_message: row.override_message ?? row.overrideMessage ?? '',
            scroll_type: row.scroll_type ?? row.scrollType ?? 'information'
        };
    }

    const supabaseData = await supabaseUpsert(table, [dataToUpsert]);
    // Note: We ignore the return value of supabaseUpsert for returning to frontend
    // to ensure we always include our internal camelCase keys if they were provided.
    
    const existing = await readJsonFile(filePath, []);
    const updated = existing.some(item => item.id === row.id)
        ? existing.map(item => item.id === row.id ? row : item)
        : [...existing, row];
    await writeJsonFile(filePath, updated);
    return row;
}

async function fetchWithRetry(url, opts = {}, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { 
                ...opts, 
                headers: {
                    'User-Agent': 'FreedomNaijaRadio/1.0 (NewsAggregator; +http://freedomnaijaradio.com)',
                    'Accept': 'application/json',
                    ...opts.headers
                },
                signal: AbortSignal.timeout(10000) 
            });
            return response;
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    throw lastError;
}

const cleanupOldNews = async () => {
    try {
        const fileData = await fs.readFile(NEWS_FILE_PATH, 'utf-8');
        const allNews = JSON.parse(fileData);
        const now = Date.now();

        const filtered = allNews.filter(item => {
            if (item.pinned) return true;
            const createdAt = new Date(item.createdAt).getTime();
            return (now - createdAt) < TWO_DAYS_MS;
        });

        if (allNews.length !== filtered.length) {
            await fs.writeFile(NEWS_FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
            console.log(`[NEWS CLEANUP] Removed ${allNews.length - filtered.length} old items locally.`);
        }

        // Add Supabase database cleanup
        if (supabase) {
            const twoDaysAgo = new Date(Date.now() - TWO_DAYS_MS).toISOString();
            const { error: deleteError, count } = await supabase
                .from('news')
                .delete({ count: 'exact' })
                .lt('created_at', twoDaysAgo)
                .eq('pinned', false);
            
            if (!deleteError) {
                console.log(`[NEWS CLEANUP] Removed old items from Supabase 'news' table.`);
            } else {
                console.error(`[NEWS CLEANUP] Supabase 'news' cleanup error:`, deleteError);
            }

            // Also clean up aggregated headlines from news_headlines table
            const { error: headlinesError } = await supabase
                .from('news_headlines')
                .delete()
                .lt('fetched_at', twoDaysAgo);

            if (!headlinesError) {
                console.log(`[NEWS CLEANUP] Removed old items from Supabase 'news_headlines' table.`);
            }
        }
    } catch (e) {
        if (e.code !== 'ENOENT') console.error('[NEWS CLEANUP] Error:', e);
    }
};

function resetDailyStats() {
    const today = new Date().toDateString();
    if (dailyStats.date !== today) {
        dailyStats = {
            date: today,
            requests: { newsapi: 0, newsdata: 0, gnews: 0 },
            articles: { newsapi: 0, newsdata: 0, gnews: 0 }
        };
    }
}

function canFetch(provider) {
    resetDailyStats();
    const limit = API_LIMITS[provider];
    return dailyStats.requests[provider] < limit.requests && dailyStats.articles[provider] < limit.articles;
}

function recordFetch(provider, count) {
    dailyStats.requests[provider]++;
    dailyStats.articles[provider] += count;
}

async function fetchNewsAPI(apiKey) {
    if (!canFetch('newsapi')) return [];
    const endpoints = [
        `https://newsapi.org/v2/top-headlines?country=ng&category=general&pageSize=3&apiKey=${apiKey}`,
        `https://newsapi.org/v2/top-headlines?category=general&pageSize=2&apiKey=${apiKey}`
    ];
    const headlines = [];
    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.articles) continue;
            for (const a of data.articles) {
                const title = stripHtml(a.title || '');
                if (!title || title === '[Removed]') continue;
                const summary = stripHtml(a.description || a.content || '');
                headlines.push({
                    id: `newsapi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    title,
                    source: a.source?.name || 'Unknown',
                    summary,
                    url: a.url || '',
                    timestamp: a.publishedAt || new Date().toISOString(),
                    provider: 'newsapi',
                    region: detectRegion(title, summary),
                    fetchedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('[News Aggregator] NewsAPI fetch failed:', error);
        }
    }
    recordFetch('newsapi', headlines.length);
    return headlines;
}

async function fetchNewsData(apiKey) {
    if (!canFetch('newsdata')) return [];
    const endpoints = [
        `https://newsdata.io/api/1/news?country=ng&language=en&size=3&apikey=${apiKey}`,
        `https://newsdata.io/api/1/news?language=en&category=top&size=2&apikey=${apiKey}`
    ];
    const headlines = [];
    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.results) continue;
            for (const a of data.results) {
                const title = stripHtml(a.title || '');
                if (!title) continue;
                const summary = stripHtml(a.description || a.content || '');
                headlines.push({
                    id: `newsdata-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    title,
                    source: a.source_id || a.source_name || 'Unknown',
                    summary,
                    url: a.link || '',
                    timestamp: a.pubDate || new Date().toISOString(),
                    provider: 'newsdata',
                    region: detectRegion(title, summary),
                    fetchedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('[News Aggregator] NewsData fetch failed:', error);
        }
    }
    recordFetch('newsdata', headlines.length);
    return headlines;
}

async function fetchGNews(apiKey) {
    if (!canFetch('gnews')) return [];
    const endpoints = [
        `https://gnews.io/api/v4/top-headlines?country=ng&lang=en&max=3&apikey=${apiKey}`,
        `https://gnews.io/api/v4/top-headlines?lang=en&max=2&apikey=${apiKey}`
    ];
    const headlines = [];
    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data = await res.json();
            if (!data.articles) continue;
            for (const a of data.articles) {
                const title = stripHtml(a.title || '');
                if (!title) continue;
                const summary = stripHtml(a.description || a.content || '');
                headlines.push({
                    id: `gnews-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    title,
                    source: a.source?.name || 'Unknown',
                    summary,
                    url: a.url || '',
                    timestamp: a.publishedAt || new Date().toISOString(),
                    provider: 'gnews',
                    region: detectRegion(title, summary),
                    fetchedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('[News Aggregator] GNews fetch failed:', error);
        }
    }
    recordFetch('gnews', headlines.length);
    return headlines;
}

function deduplicateHeadlines(headlines) {
    const unique = [];
    const seenUrls = new Set();
    for (const headline of headlines) {
        if (headline.url && seenUrls.has(headline.url)) continue;
        if (unique.some(existing => areTitlesSimilar(existing.title, headline.title))) continue;
        unique.push(headline);
        if (headline.url) seenUrls.add(headline.url);
    }
    return unique;
}

function prioritizeAndLimit(headlines, max = 120) {
    const nigeria = headlines.filter(h => h.region === 'nigeria');
    const africa = headlines.filter(h => h.region === 'africa');
    const world = headlines.filter(h => h.region === 'world');
    const result = [];
    result.push(...nigeria.slice(0, 10));
    const africaSlots = Math.max(0, 15 - result.length);
    result.push(...africa.slice(0, africaSlots));
    const worldSlots = Math.max(0, max - result.length);
    result.push(...world.slice(0, worldSlots));
    return result.slice(0, max);
}

function buildScrollLines(headlines) {
    return headlines.map(h => {
        const prefix = h.region === 'nigeria' ? 'Nigeria' : h.region === 'africa' ? 'Africa' : 'World';
        return `${prefix}: ${h.title} — ${h.source}`;
    });
}

async function loadHeadlinesCache() {
    return await readJsonFile(HEADLINES_CACHE_FILE, {
        headlines: [],
        scrollLines: [],
        lastUpdated: '',
        lastProvider: '',
        providerIndex: -1,
        providerErrors: {},
        stats: { nigeria: 0, africa: 0, world: 0, total: 0 }
    });
}

async function saveHeadlinesCache(cache) {
    await writeJsonFile(HEADLINES_CACHE_FILE, cache);
}

async function syncHeadlines(headlines) {
    if (!supabase) return;
    await supabaseUpsert('news_headlines', headlines);
}

async function runFetchCycle(providerOverride) {
    const cache = await loadHeadlinesCache();
    const nextIndex = providerOverride ? PROVIDERS.indexOf(providerOverride) : (cache.providerIndex + 1) % PROVIDERS.length;
    const provider = providerOverride || PROVIDERS[nextIndex >= 0 ? nextIndex : 0];
    const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
    const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || '';
    const GNEWS_KEY = process.env.GNEWS_API_KEY || '';
    let newHeadlines = [];
    let fetchError = '';
    try {
        if (provider === 'newsapi') {
            if (!NEWSAPI_KEY) throw new Error('NEWSAPI_KEY not set');
            newHeadlines = await fetchNewsAPI(NEWSAPI_KEY);
        } else if (provider === 'newsdata') {
            if (!NEWSDATA_KEY) throw new Error('NEWSDATA_API_KEY not set');
            newHeadlines = await fetchNewsData(NEWSDATA_KEY);
        } else if (provider === 'gnews') {
            if (!GNEWS_KEY) throw new Error('GNEWS_API_KEY not set');
            newHeadlines = await fetchGNews(GNEWS_KEY);
        }
    } catch (error) {
        fetchError = error.message || 'Unknown error';
    }
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const existingRecent = cache.headlines.filter(h => h.fetchedAt > twoHoursAgo && h.provider !== provider);
    const combined = [...newHeadlines, ...existingRecent];
    const deduped = deduplicateHeadlines(combined);
    const prioritized = prioritizeAndLimit(deduped, 120);
    const scrollLines = buildScrollLines(prioritized);
    const updatedCache = {
        headlines: prioritized,
        scrollLines,
        lastUpdated: new Date().toISOString(),
        lastProvider: provider,
        providerIndex: nextIndex >= 0 ? nextIndex : 0,
        providerErrors: { ...cache.providerErrors, [provider]: fetchError || '' },
        stats: {
            nigeria: prioritized.filter(h => h.region === 'nigeria').length,
            africa: prioritized.filter(h => h.region === 'africa').length,
            world: prioritized.filter(h => h.region === 'world').length,
            total: prioritized.length
        }
    };
    await saveHeadlinesCache(updatedCache);
    await syncHeadlines(updatedCache.headlines);
    return { provider, fetched: newHeadlines.length, error: fetchError || undefined };
}

const verifyAuth = (req) => {
    const authHeader = req.headers['authorization'] || req.headers['x-admin-password'];
    const expected = ADMIN_PASSWORD.trim();
    let provided = (authHeader || '').trim();
    if (provided.startsWith('Bearer ')) provided = provided.substring(7).trim();
    if (provided !== expected) return false;
    return true;
};

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const url = req.url?.split('?')[0];

    if (url === '/api/scroll') {
        if (req.method === 'GET') {
            const rows = await readStorage('scroll', SCROLL_FILE, [{ id: 'scroll-config', overrideEnabled: false, overrideMessage: '', scrollType: 'information' }]);
            const scroll = rows.length > 0 ? rows[0] : { id: 'scroll-config', overrideEnabled: false, overrideMessage: '', scrollType: 'information' };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(scroll));
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
                    const scrollData = JSON.parse(body);
                    // Map to both snake_case (for Supabase) and camelCase (for local/legacy)
                    const mappedData = {
                        id: 'scroll-config',
                        override_enabled: scrollData.override_enabled ?? scrollData.overrideEnabled ?? false,
                        override_message: scrollData.override_message ?? scrollData.overrideMessage ?? '',
                        scroll_type: scrollData.scroll_type ?? scrollData.scrollType ?? 'information',
                        overrideEnabled: scrollData.override_enabled ?? scrollData.overrideEnabled ?? false,
                        overrideMessage: scrollData.override_message ?? scrollData.overrideMessage ?? '',
                        scrollType: scrollData.scroll_type ?? scrollData.scrollType ?? 'information'
                    };
                    const updated = await upsertStorage('scroll', SCROLL_FILE, mappedData);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, updated }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
    }

    if (url === '/api/socials') {
        if (req.method === 'GET') {
            const rows = await readStorage('socials', path.join(__dirname, 'socials.json'), DEFAULT_SOCIALS);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
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
                    const rows = JSON.parse(body);
                    await saveStorage('socials', path.join(__dirname, 'socials.json'), rows);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
    }

    if (url === '/api/prayer-request' || url === '/api/testimonies' || url === '/api/donations') {
        const fileName = url === '/api/prayer-request' ? 'prayer_requests.json' : url === '/api/donations' ? 'donations.json' : 'testimonies.json';
        const table = url === '/api/prayer-request' ? 'prayer_requests' : url === '/api/donations' ? 'donations' : 'testimonies';
        const filePath = path.join(__dirname, fileName);

        if (req.method === 'GET') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            const rows = await readStorage(table, filePath, []);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const submission = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
                    await insertStorage(table, filePath, submission);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
    }

    if (url === '/api/news') {
        if (req.method === 'GET') {
            try {
                let news = await readStorage('news', NEWS_FILE_PATH, []);
                if (!verifyAuth(req)) news = news.filter(item => item.status === 'Published');
                news.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(news));
            } catch {
                res.end(JSON.stringify([]));
            }
            return;
        }
        if (!verifyAuth(req)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const bd = JSON.parse(body);
                    const newItem = { id: Date.now().toString(), title: bd.title, content: bd.content, status: bd.status || 'Draft', pinned: !!bd.pinned, createdAt: new Date().toISOString() };
                    await insertStorage('news', NEWS_FILE_PATH, newItem);
                    res.end(JSON.stringify(newItem));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
        if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const bd = JSON.parse(body);
                    const existing = await readStorage('news', NEWS_FILE_PATH, []);
                    const item = existing.find(i => i.id === bd.id);
                    if (!item) {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Not found' }));
                        return;
                    }
                    const updated = { ...item, ...bd, updatedAt: new Date().toISOString() };
                    await upsertStorage('news', NEWS_FILE_PATH, updated);
                    res.end(JSON.stringify(updated));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            const id = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
            if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'ID required' }));
                return;
            }
            await deleteStorage('news', NEWS_FILE_PATH, id);
            res.end(JSON.stringify({ success: true }));
            return;
        }
    }

    if (url === '/api/news/fetch' && req.method === 'POST') {
        if (!verifyAuth(req)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }
        try {
            await fetchDailyNews();
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Failed' }));
        }
        return;
    }

    if (url === '/api/news-headlines') {
        if (req.method === 'GET') {
            const cache = await loadHeadlinesCache();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                headlines: cache.scrollLines,
                fullHeadlines: cache.headlines,
                lastUpdated: cache.lastUpdated,
                lastProvider: cache.lastProvider,
                stats: cache.stats
            }));
            return;
        }
    }

    if (url === '/api/news-headlines/fetch' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const bd = JSON.parse(body);
                const result = await runFetchCycle(bd.provider);
                const cache = await loadHeadlinesCache();
                res.end(JSON.stringify({ success: true, ...result, stats: cache.stats, totalHeadlines: cache.headlines.length }));
            } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (url && url.startsWith('/api/news-headlines/') && (req.method === 'DELETE' || req.method === 'PUT')) {
        const id = decodeURIComponent(url.replace('/api/news-headlines/', ''));
        
        if (req.method === 'DELETE') {
            await deleteStorage('news_headlines', HEADLINES_CACHE_FILE, id);
            res.end(JSON.stringify({ success: true }));
            return;
        }
        
        if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const bd = JSON.parse(body);
                    const cache = await loadHeadlinesCache();
                    const index = cache.headlines.findIndex(h => h.id === id);
                    
                    if (index === -1) {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: 'Headline not found' }));
                        return;
                    }
                    
                    const updatedHeadline = { ...cache.headlines[index], ...bd, updatedAt: new Date().toISOString() };
                    cache.headlines[index] = updatedHeadline;
                    
                    // Update scroll lines too
                    cache.scrollLines = buildScrollLines(cache.headlines);
                    
                    await saveHeadlinesCache(cache);
                    await syncHeadlines([updatedHeadline]);
                    
                    res.end(JSON.stringify(updatedHeadline));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed' }));
                }
            });
            return;
        }
    }

    if (url === '/api/news-headlines/status' && req.method === 'GET') {
        const cache = await loadHeadlinesCache();
        const nextIndex = (cache.providerIndex + 1) % PROVIDERS.length;
        resetDailyStats();
        res.end(JSON.stringify({
            lastUpdated: cache.lastUpdated,
            lastProvider: cache.lastProvider,
            nextProvider: PROVIDERS[nextIndex],
            providerErrors: cache.providerErrors,
            stats: cache.stats,
            totalCached: cache.headlines.length,
            providerRotation: PROVIDERS.map((p, i) => ({ name: p, isCurrent: i === cache.providerIndex, isNext: i === nextIndex, lastError: cache.providerErrors[p] || null })),
            dailyUsage: { date: dailyStats.date, requests: dailyStats.requests, articles: dailyStats.articles, limits: API_LIMITS }
        }));
        return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
    console.log(`API Server running at http://localhost:${PORT}`);
});

const fetchDailyNews = async () => {
    try {
        const newsApiKey = process.env.NEWSAPI_KEY || '';
        const newsDataKey = process.env.NEWSDATA_API_KEY || '';
        const gnewsKey = process.env.GNEWS_API_KEY || '';
        
        let articles = [];
        
        if (newsApiKey) {
            console.log(`[NEWS] Fetching from NewsAPI...`);
            try {
                const response = await fetchWithRetry(`https://newsapi.org/v2/top-headlines?country=ng&pageSize=10&apiKey=${newsApiKey}`);
                const json = await response.json();
                if (json.status === 'ok' && json.articles) {
                    articles = json.articles;
                }
            } catch (e) {
                console.warn('[NEWS] NewsAPI failed, trying fallbacks...');
            }
        }
        
        if (articles.length === 0 && newsDataKey) {
            console.log(`[NEWS] Fetching from NewsData...`);
            try {
                const response = await fetchWithRetry(`https://newsdata.io/api/1/news?country=ng&language=en&size=10&apikey=${newsDataKey}`);
                const json = await response.json();
                if (json.results) {
                    articles = json.results.map(r => ({ ...r, url: r.link }));
                }
            } catch (e) {
                console.warn('[NEWS] NewsData failed.');
            }
        }

        if (articles.length > 0) {
            const existing = await readStorage('news', NEWS_FILE_PATH, []);
            const newItems = articles
                .filter(a => a.title && !existing.some(item => item.title === a.title))
                .map(a => ({
                    id: Date.now().toString() + Math.random().toString().slice(2, 8),
                    title: a.title,
                    content: a.url || a.description || '',
                    status: 'Published',
                    pinned: false,
                    createdAt: new Date().toISOString()
                }));
            if (newItems.length > 0) {
                await saveStorage('news', NEWS_FILE_PATH, [...newItems, ...existing]);
                console.log(`[NEWS] Added ${newItems.length} new items.`);
            }
        }
        await cleanupOldNews();
    } catch (e) { console.error('[NEWS FETCH] Error:', e); }
};

cleanupOldNews();
setInterval(cleanupOldNews, 6 * 60 * 60 * 1000);
setInterval(fetchDailyNews, 24 * 60 * 60 * 1000);
setInterval(() => runFetchCycle(), 10 * 60 * 1000);
