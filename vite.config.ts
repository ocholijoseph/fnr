import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dotenv from "dotenv";

// Load .env file for server-side API keys
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ─── News Aggregator Types & Helpers ────────────────────────────────
interface NormalizedHeadline {
    id: string;
    title: string;
    source: string;
    summary: string;
    url: string;
    timestamp: string;
    provider: 'newsapi' | 'newsdata' | 'gnews';
    region: 'nigeria' | 'africa' | 'world';
    fetchedAt: string;
}

interface HeadlineCache {
    headlines: NormalizedHeadline[];
    scrollLines: string[];
    lastUpdated: string;
    lastProvider: string;
    providerIndex: number;
    providerErrors: Record<string, string>;
    stats: {
        nigeria: number;
        africa: number;
        world: number;
        total: number;
    };
}

// Strip HTML tags from text
function stripHtml(text: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

// Normalize a title for fuzzy dedup comparison
function normalizeForComparison(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Fuzzy title similarity check (Jaccard similarity on word sets)
function areTitlesSimilar(a: string, b: string, threshold = 0.6): boolean {
    const wordsA = new Set(normalizeForComparison(a).split(' ').filter(w => w.length > 2));
    const wordsB = new Set(normalizeForComparison(b).split(' ').filter(w => w.length > 2));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size >= threshold;
}

// Africa-related keywords for region detection
const AFRICA_COUNTRIES = ['nigeria', 'ghana', 'kenya', 'south africa', 'egypt', 'ethiopia', 'tanzania', 'uganda', 'cameroon', 'senegal', 'algeria', 'morocco', 'tunisia', 'angola', 'mozambique', 'zambia', 'zimbabwe', 'malawi', 'mali', 'niger', 'chad', 'sudan', 'libya', 'congo', 'rwanda', 'ivory coast', 'benin', 'togo', 'burkina faso', 'guinea', 'sierra leone', 'liberia', 'gambia', 'gabon', 'namibia', 'botswana', 'lesotho', 'eswatini', 'mauritius', 'madagascar', 'somalia', 'eritrea', 'djibouti'];
const NIGERIA_KEYWORDS = ['nigeria', 'nigerian', 'lagos', 'abuja', 'naira', 'buhari', 'tinubu', 'inec', 'nollywood', 'afcon', 'super eagles', 'efcc', 'nnpc', 'nafdac'];

function detectRegion(title: string, summary: string): 'nigeria' | 'africa' | 'world' {
    const combined = `${title} ${summary}`.toLowerCase();
    if (NIGERIA_KEYWORDS.some(kw => combined.includes(kw))) return 'nigeria';
    if (AFRICA_COUNTRIES.some(c => combined.includes(c)) || combined.includes('africa')) return 'africa';
    return 'world';
}

// Fetch with retry and backoff
async function fetchWithRetry(url: string, opts: any = {}, maxRetries = 2): Promise<Response> {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
            return response;
        } catch (error: any) {
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }
        }
    }
    throw lastError;
}

// ─── Provider Fetchers ──────────────────────────────────────────────
async function fetchNewsAPI(apiKey: string): Promise<NormalizedHeadline[]> {
    const endpoints = [
        `https://newsapi.org/v2/top-headlines?country=ng&category=general&pageSize=10&apiKey=${apiKey}`,
        `https://newsapi.org/v2/top-headlines?category=general&pageSize=5&apiKey=${apiKey}`,
    ];
    const headlines: NormalizedHeadline[] = [];

    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data: any = await res.json();
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
                    fetchedAt: new Date().toISOString(),
                });
            }
        } catch (e) {
            console.error('[NewsAggregator] NewsAPI fetch error:', e);
        }
    }
    return headlines;
}

async function fetchNewsData(apiKey: string): Promise<NormalizedHeadline[]> {
    const endpoints = [
        `https://newsdata.io/api/1/news?country=ng&language=en&apikey=${apiKey}`,
        `https://newsdata.io/api/1/news?language=en&category=top&apikey=${apiKey}`,
    ];
    const headlines: NormalizedHeadline[] = [];

    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data: any = await res.json();
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
                    fetchedAt: new Date().toISOString(),
                });
            }
        } catch (e) {
            console.error('[NewsAggregator] NewsData fetch error:', e);
        }
    }
    return headlines;
}

async function fetchGNews(apiKey: string): Promise<NormalizedHeadline[]> {
    const endpoints = [
        `https://gnews.io/api/v4/top-headlines?country=ng&lang=en&max=10&apikey=${apiKey}`,
        `https://gnews.io/api/v4/top-headlines?lang=en&max=5&apikey=${apiKey}`,
    ];
    const headlines: NormalizedHeadline[] = [];

    for (const url of endpoints) {
        try {
            const res = await fetchWithRetry(url);
            if (!res.ok) continue;
            const data: any = await res.json();
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
                    fetchedAt: new Date().toISOString(),
                });
            }
        } catch (e) {
            console.error('[NewsAggregator] GNews fetch error:', e);
        }
    }
    return headlines;
}

// ─── Dedup & Prioritize ─────────────────────────────────────────────
function deduplicateHeadlines(headlines: NormalizedHeadline[]): NormalizedHeadline[] {
    const unique: NormalizedHeadline[] = [];
    const seenUrls = new Set<string>();

    for (const h of headlines) {
        if (h.url && seenUrls.has(h.url)) continue;
        if (unique.some(existing => areTitlesSimilar(existing.title, h.title))) continue;
        unique.push(h);
        if (h.url) seenUrls.add(h.url);
    }
    return unique;
}

function prioritizeAndLimit(headlines: NormalizedHeadline[], max = 20): NormalizedHeadline[] {
    const nigeria = headlines.filter(h => h.region === 'nigeria');
    const africa = headlines.filter(h => h.region === 'africa');
    const world = headlines.filter(h => h.region === 'world');

    const result: NormalizedHeadline[] = [];
    result.push(...nigeria.slice(0, 10));
    const africaSlots = Math.max(0, 15 - result.length);
    result.push(...africa.slice(0, africaSlots));
    const worldSlots = Math.max(0, max - result.length);
    result.push(...world.slice(0, worldSlots));

    return result.slice(0, max);
}

function buildScrollLines(headlines: NormalizedHeadline[]): string[] {
    return headlines.map(h => {
        const prefix = h.region === 'nigeria' ? 'Nigeria' : h.region === 'africa' ? 'Africa' : 'World';
        return `${prefix}: ${h.title} — ${h.source}`;
    });
}

// ─── Aggregator State ───────────────────────────────────────────────
const PROVIDERS = ['newsapi', 'newsdata', 'gnews'] as const;
let aggregatorInterval: ReturnType<typeof setInterval> | null = null;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 1500,
    },
    plugins: [
        react(),
        mode === "development" && componentTagger(),
        {
            name: 'api-scroll',
            configureServer(server: any) {
                // ── News Aggregator Background Timer ──
                const headlinesCachePath = path.resolve(__dirname, 'headlines_cache.json');

                const loadCache = async (): Promise<HeadlineCache> => {
                    const fs = await import('fs/promises');
                    try {
                        const raw = await fs.readFile(headlinesCachePath, 'utf-8');
                        return JSON.parse(raw);
                    } catch {
                        return {
                            headlines: [], scrollLines: [], lastUpdated: '', lastProvider: '',
                            providerIndex: -1, providerErrors: {},
                            stats: { nigeria: 0, africa: 0, world: 0, total: 0 },
                        };
                    }
                };

                const saveCache = async (cache: HeadlineCache) => {
                    const fs = await import('fs/promises');
                    await fs.writeFile(headlinesCachePath, JSON.stringify(cache, null, 2), 'utf-8');
                };

                const runFetchCycle = async (forceProvider?: string): Promise<{ provider: string; fetched: number; error?: string }> => {
                    const cache = await loadCache();
                    const nextIndex = forceProvider
                        ? PROVIDERS.indexOf(forceProvider as any)
                        : (cache.providerIndex + 1) % PROVIDERS.length;
                    const provider = forceProvider || PROVIDERS[nextIndex >= 0 ? nextIndex : 0];

                    const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
                    const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || '';
                    const GNEWS_KEY = process.env.GNEWS_API_KEY || '';

                    let newHeadlines: NormalizedHeadline[] = [];
                    let fetchError = '';

                    try {
                        switch (provider) {
                            case 'newsapi':
                                if (!NEWSAPI_KEY) throw new Error('NEWSAPI_KEY not set in .env');
                                newHeadlines = await fetchNewsAPI(NEWSAPI_KEY);
                                break;
                            case 'newsdata':
                                if (!NEWSDATA_KEY) throw new Error('NEWSDATA_API_KEY not set in .env');
                                newHeadlines = await fetchNewsData(NEWSDATA_KEY);
                                break;
                            case 'gnews':
                                if (!GNEWS_KEY) throw new Error('GNEWS_API_KEY not set in .env');
                                newHeadlines = await fetchGNews(GNEWS_KEY);
                                break;
                        }
                        console.log(`[NewsAggregator] ✓ Fetched ${newHeadlines.length} headlines from ${provider}`);
                    } catch (e: any) {
                        fetchError = e.message || 'Unknown error';
                        console.error(`[NewsAggregator] ✗ ${provider} error:`, fetchError);
                    }

                    // Merge with existing (keep headlines from last 2 hours from other providers)
                    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
                    const existingRecent = cache.headlines.filter(h =>
                        h.fetchedAt > twoHoursAgo && h.provider !== provider
                    );

                    const combined = [...newHeadlines, ...existingRecent];
                    const deduped = deduplicateHeadlines(combined);
                    const prioritized = prioritizeAndLimit(deduped, 20);
                    const scrollLines = buildScrollLines(prioritized);

                    const updatedCache: HeadlineCache = {
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
                            total: prioritized.length,
                        },
                    };

                    await saveCache(updatedCache);
                    return { provider, fetched: newHeadlines.length, error: fetchError || undefined };
                };

                // Start background rotation timer (10 minutes)
                if (aggregatorInterval) clearInterval(aggregatorInterval);
                console.log('[NewsAggregator] 🚀 Starting background aggregator (10-min rotation: NewsAPI → NewsData → GNews)');
                setTimeout(() => runFetchCycle().catch(console.error), 5000);
                aggregatorInterval = setInterval(() => runFetchCycle().catch(console.error), 10 * 60 * 1000);

                // ── Middleware ──
                server.middlewares.use(async (req: any, res: any, next: any) => {
                    if (req.url?.startsWith('/api/scroll') || req.url?.startsWith('/api/prayer-request') || req.url?.startsWith('/api/testimonies') || req.url?.startsWith('/api/donations') || req.url?.startsWith('/api/news-headlines') || req.url?.startsWith('/api/news')) {
                        const fs = await import('fs/promises');
                        const url = req.url.split('?')[0];

                        const adminPassword = (process.env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
                        const verifyAuthHeader = (req: any) => {
                            const authHeader = req.headers['authorization'] || req.headers['x-admin-password'] || '';
                            let provided = authHeader.trim();
                            if (provided.startsWith('Bearer ')) provided = provided.substring(7).trim();
                            return provided === adminPassword;
                        };

                        if (req.method === 'OPTIONS') {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
                            res.statusCode = 204;
                            res.end();
                            return;
                        }

                        // ── /api/news-headlines ── GET cached scroll headlines
                        if (url === '/api/news-headlines' && req.method === 'GET') {
                            const cache = await loadCache();
                            res.setHeader('Content-Type', 'application/json');
                            res.setHeader('Cache-Control', 'public, max-age=600');
                            res.end(JSON.stringify({
                                headlines: cache.scrollLines,
                                fullHeadlines: cache.headlines,
                                lastUpdated: cache.lastUpdated,
                                lastProvider: cache.lastProvider,
                                stats: cache.stats,
                            }));
                            return;
                        }

                        // ── /api/news-headlines/fetch ── POST manual trigger
                        if (url === '/api/news-headlines/fetch' && req.method === 'POST') {
                            let body = '';
                            req.on('data', (chunk: any) => { body += chunk.toString(); });
                            req.on('end', async () => {
                                try {
                                    const bodyData = body ? JSON.parse(body) : {};
                                    const result = await runFetchCycle(bodyData.provider);
                                    const cache = await loadCache();
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ success: true, ...result, stats: cache.stats, totalHeadlines: cache.headlines.length }));
                                } catch (error: any) {
                                    res.statusCode = 500;
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ error: error.message }));
                                }
                            });
                            return;
                        }

                        // ── /api/news-headlines/status ── GET aggregator status
                        if (url === '/api/news-headlines/status' && req.method === 'GET') {
                            const cache = await loadCache();
                            const nextIndex = (cache.providerIndex + 1) % PROVIDERS.length;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({
                                lastUpdated: cache.lastUpdated,
                                lastProvider: cache.lastProvider,
                                nextProvider: PROVIDERS[nextIndex],
                                providerErrors: cache.providerErrors,
                                stats: cache.stats,
                                totalCached: cache.headlines.length,
                                providerRotation: PROVIDERS.map((p, i) => ({
                                    name: p, isCurrent: i === cache.providerIndex, isNext: i === nextIndex,
                                    lastError: cache.providerErrors[p] || null,
                                })),
                                keysConfigured: {
                                    newsapi: !!process.env.NEWSAPI_KEY,
                                    newsdata: !!process.env.NEWSDATA_API_KEY,
                                    gnews: !!process.env.GNEWS_API_KEY,
                                },
                            }));
                            return;
                        }

                        // ── /api/scroll ──
                        if (url === '/api/scroll') {
                            const scrollPath = path.resolve(__dirname, 'scroll.json');
                            if (req.method === 'GET') {
                                try { const data = await fs.readFile(scrollPath, 'utf-8'); res.setHeader('Content-Type', 'application/json'); res.end(data); }
                                catch { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); }
                                return;
                            }
                            if (req.method === 'POST') {
                                if (!verifyAuthHeader(req)) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try { await fs.writeFile(scrollPath, body, 'utf-8'); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true })); }
                                    catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to write' })); }
                                });
                                return;
                            }
                        }

                        // ── /api/prayer-request, /api/testimonies, /api/donations ──
                        if (url === '/api/prayer-request' || url === '/api/testimonies' || url === '/api/donations') {
                            const fileName = url === '/api/prayer-request' ? 'prayer_requests.json' : url === '/api/donations' ? 'donations.json' : 'testimonies.json';
                            const filePath = path.resolve(__dirname, fileName);

                            if (req.method === 'GET') {
                                if (!verifyAuthHeader(req)) { res.statusCode = 401; res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
                                try { const data = await fs.readFile(filePath, 'utf-8'); res.setHeader('Content-Type', 'application/json'); res.end(data); }
                                catch { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([])); }
                                return;
                            }
                            if (req.method === 'POST') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const data = JSON.parse(body);
                                        const submission = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };
                                        let existing: any[] = [];
                                        try { const fd = await fs.readFile(filePath, 'utf-8'); existing = JSON.parse(fd); } catch { }
                                        existing.push(submission);
                                        await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
                                        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true }));
                                    } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed' })); }
                                });
                                return;
                            }
                            if (req.method === 'PUT') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const data = JSON.parse(body);
                                        let existing: any[] = [];
                                        try { const fd = await fs.readFile(filePath, 'utf-8'); existing = JSON.parse(fd); } catch { }
                                        const index = existing.findIndex((item: any) => item.id.toString() === data.id.toString());
                                        if (index !== -1) {
                                            existing[index] = { ...existing[index], ...data, updatedAt: new Date().toISOString() };
                                            await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
                                            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(existing[index]));
                                        } else { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); }
                                    } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed' })); }
                                });
                                return;
                            }
                            if (req.method === 'DELETE') {
                                const id = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('id');
                                if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: 'ID required' })); return; }
                                try {
                                    const fd = await fs.readFile(filePath, 'utf-8');
                                    let existing: any[] = []; try { existing = JSON.parse(fd); } catch { }
                                    const filtered = existing.filter((item: any) => item.id.toString() !== id.toString());
                                    await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
                                    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true }));
                                } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed' })); }
                                return;
                            }
                        }

                        // ── /api/news (manual news CRUD) ──
                        if (url === '/api/news') {
                            const newsPath = path.resolve(__dirname, 'news.json');
                            if (req.method === 'GET') {
                                try {
                                    const dataRaw = await fs.readFile(newsPath, 'utf-8');
                                    let news = JSON.parse(dataRaw);
                                    if (!verifyAuthHeader(req)) news = news.filter((item: any) => item.status === 'Published');
                                    news.sort((a: any, b: any) => {
                                        if (a.pinned && !b.pinned) return -1;
                                        if (!a.pinned && b.pinned) return 1;
                                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                    });
                                    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(news));
                                } catch { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([])); }
                                return;
                            }
                            if (!verifyAuthHeader(req)) { res.statusCode = 401; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
                            if (req.method === 'POST') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const bd = JSON.parse(body);
                                        const newItem = { id: Date.now().toString(), title: bd.title, content: bd.content, status: bd.status || "Draft", pinned: !!bd.pinned, createdAt: new Date().toISOString() };
                                        let news: any[] = []; try { const dr = await fs.readFile(newsPath, 'utf-8'); news = JSON.parse(dr); } catch { }
                                        news.push(newItem);
                                        await fs.writeFile(newsPath, JSON.stringify(news, null, 2), 'utf-8');
                                        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(newItem));
                                    } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to create news' })); }
                                });
                                return;
                            }
                            if (req.method === 'PUT') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const bd = JSON.parse(body);
                                        const dr = await fs.readFile(newsPath, 'utf-8');
                                        let news: any[] = []; try { news = JSON.parse(dr); } catch { }
                                        const index = news.findIndex((item: any) => item.id === bd.id);
                                        if (index === -1) { res.statusCode = 404; res.end(JSON.stringify({ error: 'News not found' })); return; }
                                        news[index] = { ...news[index], title: bd.title, content: bd.content, status: bd.status, pinned: !!bd.pinned, updatedAt: new Date().toISOString() };
                                        await fs.writeFile(newsPath, JSON.stringify(news, null, 2), 'utf-8');
                                        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(news[index]));
                                    } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to update news' })); }
                                });
                                return;
                            }
                            if (req.method === 'DELETE') {
                                const urlObj = new URL(req.url!, `http://${req.headers.host}`);
                                const id = urlObj.searchParams.get("id");
                                if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: 'ID required' })); return; }
                                try {
                                    const dr = await fs.readFile(newsPath, 'utf-8');
                                    let news: any[] = []; try { news = JSON.parse(dr); } catch { }
                                    const filtered = news.filter((item: any) => item.id !== id);
                                    await fs.writeFile(newsPath, JSON.stringify(filtered, null, 2), 'utf-8');
                                    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true }));
                                } catch { res.statusCode = 500; res.end(JSON.stringify({ error: 'Failed to delete news' })); }
                                return;
                            }
                        }
                    }
                    next();
                });
            }
        }
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    base: "./",
    build: {
        outDir: "dist",
        sourcemap: mode === "development",
        minify: "terser",
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom"],
                    ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "lucide-react"],
                },
            },
        },
    },
}));
