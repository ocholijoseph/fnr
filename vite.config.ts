import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';

// Load .env file for server-side API keys
dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
const supabaseServer = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

async function readLocalJson<T>(filePath: string, fallback: T): Promise<T> {
    const fs = await import('fs/promises');
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch {
        return fallback;
    }
}

async function writeLocalJson(filePath: string, value: any): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function readTable<T>(table: string, filePath: string, fallback: T[]): Promise<T[]> {
    if (supabaseServer) {
        const { data, error } = await supabaseServer.from<T>(table).select('*');
        if (!error && data) {
            return data;
        }
        console.warn(`[Supabase] read ${table} fallback:`, error?.message);
    }
    return readLocalJson<T[]>(filePath, fallback);
}

async function saveTableRows<T>(table: string, filePath: string, rows: T[]): Promise<T[]> {
    if (supabaseServer) {
        const { data, error } = await supabaseServer.from<T>(table).upsert(rows, { onConflict: 'id' });
        if (!error && data) {
            return data;
        }
        console.warn(`[Supabase] upsert ${table} fallback:`, error?.message);
    }
    await writeLocalJson(filePath, rows);
    return rows;
}

async function deleteRowFromStorage(table: string, filePath: string, id: string): Promise<boolean> {
    if (supabaseServer) {
        const { error } = await supabaseServer.from(table).delete().eq('id', id);
        if (!error) return true;
        console.warn(`[Supabase] delete ${table} id=${id} fallback:`, error?.message);
    }
    const rows = await readLocalJson<any[]>(filePath, []);
    const filtered = rows.filter(item => item.id !== id);
    if (filtered.length === rows.length) return false;
    await writeLocalJson(filePath, filtered);
    return true;
}

async function upsertRowInStorage<T extends { id: string }>(table: string, filePath: string, row: T): Promise<T | null> {
    if (supabaseServer) {
        const { data, error } = await supabaseServer.from<T>(table).upsert([row], { onConflict: 'id', returning: 'representation' });
        if (!error && data && data.length > 0) {
            return data[0];
        }
        console.warn(`[Supabase] upsert row ${table} fallback:`, error?.message);
    }
    const rows = await readLocalJson<T[]>(filePath, []);
    const nextRows = rows.some(item => item.id === row.id) ? rows.map(item => item.id === row.id ? row : item) : [...rows, row];
    await writeLocalJson(filePath, nextRows);
    return row;
}

async function syncHeadlinesToSupabase(headlines: NormalizedHeadline[]): Promise<void> {
    if (!supabaseServer) return;
    try {
        // Transform camelCase to snake_case for Supabase
        const transformedHeadlines = headlines.map(h => ({
            id: h.id,
            title: h.title,
            source: h.source,
            summary: h.summary,
            url: h.url,
            timestamp: h.timestamp,
            provider: h.provider,
            region: h.region,
            fetched_at: h.fetchedAt
        }));

        const result = await supabaseServer.from('news_headlines').upsert(transformedHeadlines, { onConflict: 'id' });
        if (result.error) {
            console.error('[Supabase] sync headlines failed:', result.error.message);
        }
    } catch (error: any) {
        console.error('[Supabase] sync headlines exception:', error.message || error);
    }
}

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

// ─── Daily Rate Limiting ───────────────────────────────────────────
interface DailyStats {
    date: string;
    requests: { [provider: string]: number };
    articles: { [provider: string]: number };
}

let dailyStats: DailyStats = {
    date: new Date().toDateString(),
    requests: { newsapi: 0, newsdata: 0, gnews: 0 },
    articles: { newsapi: 0, newsdata: 0, gnews: 0 }
};

const API_LIMITS = {
    newsapi: { requests: 100, articles: 500 },
    newsdata: { requests: 100, articles: 200 },
    gnews: { requests: 100, articles: 50 }
};

function resetDailyStatsIfNeeded() {
    const today = new Date().toDateString();
    if (dailyStats.date !== today) {
        console.log('[NewsAggregator] 📅 Resetting daily stats for new day');
        dailyStats = {
            date: today,
            requests: { newsapi: 0, newsdata: 0, gnews: 0 },
            articles: { newsapi: 0, newsdata: 0, gnews: 0 }
        };
    }
}

function canFetchFromProvider(provider: string): boolean {
    resetDailyStatsIfNeeded();
    const limits = API_LIMITS[provider as keyof typeof API_LIMITS];
    return dailyStats.requests[provider] < limits.requests &&
           dailyStats.articles[provider] < limits.articles;
}

function recordFetch(provider: string, articleCount: number) {
    dailyStats.requests[provider]++;
    dailyStats.articles[provider] += articleCount;
    console.log(`[NewsAggregator] 📊 ${provider}: ${dailyStats.requests[provider]}/${API_LIMITS[provider as keyof typeof API_LIMITS].requests} requests, ${dailyStats.articles[provider]}/${API_LIMITS[provider as keyof typeof API_LIMITS].articles} articles`);
}
async function fetchNewsAPI(apiKey: string): Promise<NormalizedHeadline[]> {
    if (!canFetchFromProvider('newsapi')) {
        console.log('[NewsAggregator] 🚫 NewsAPI daily limit reached, skipping');
        return [];
    }

    // Reduced from 15 to 5 articles per call to stay within daily limits
    const endpoints = [
        `https://newsapi.org/v2/top-headlines?country=ng&category=general&pageSize=3&apiKey=${apiKey}`,
        `https://newsapi.org/v2/top-headlines?category=general&pageSize=2&apiKey=${apiKey}`,
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

    recordFetch('newsapi', headlines.length);
    return headlines;
}

async function fetchNewsData(apiKey: string): Promise<NormalizedHeadline[]> {
    if (!canFetchFromProvider('newsdata')) {
        console.log('[NewsAggregator] 🚫 NewsData daily limit reached, skipping');
        return [];
    }

    // Reduced from default 10 to 5 articles per call
    const endpoints = [
        `https://newsdata.io/api/1/news?country=ng&language=en&size=3&apikey=${apiKey}`,
        `https://newsdata.io/api/1/news?language=en&category=top&size=2&apikey=${apiKey}`,
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

    recordFetch('newsdata', headlines.length);
    return headlines;
}

async function fetchGNews(apiKey: string): Promise<NormalizedHeadline[]> {
    if (!canFetchFromProvider('gnews')) {
        console.log('[NewsAggregator] 🚫 GNews daily limit reached, skipping');
        return [];
    }

    // Reduced from 15 to 5 articles per call to stay well within 50 article daily limit
    const endpoints = [
        `https://gnews.io/api/v4/top-headlines?country=ng&lang=en&max=3&apikey=${apiKey}`,
        `https://gnews.io/api/v4/top-headlines?lang=en&max=2&apikey=${apiKey}`,
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

    recordFetch('gnews', headlines.length);
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

function prioritizeAndLimit(headlines: NormalizedHeadline[], max = 120): NormalizedHeadline[] {
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
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
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
                        const requestedProvider = forceProvider === 'auto' ? undefined : forceProvider;
                        const nextIndex = requestedProvider
                            ? PROVIDERS.indexOf(requestedProvider as any)
                            : (cache.providerIndex + 1) % PROVIDERS.length;
                        const provider = requestedProvider || PROVIDERS[nextIndex >= 0 ? nextIndex : 0];

                        const NEWSAPI_KEY = process.env.NEWSAPI_KEY || env.NEWSAPI_KEY || '';
                        const NEWSDATA_KEY = process.env.NEWSDATA_API_KEY || env.NEWSDATA_API_KEY || '';
                        const GNEWS_KEY = process.env.GNEWS_API_KEY || env.GNEWS_API_KEY || '';

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
                        const prioritized = prioritizeAndLimit(deduped, 120);
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
                        await syncHeadlinesToSupabase(updatedCache.headlines).catch(console.error);
                        return { provider, fetched: newHeadlines.length, error: fetchError || undefined };
                    };

                    // Start background rotation timer (60 minutes - much more conservative)
                    if (aggregatorInterval) clearInterval(aggregatorInterval);
                    console.log('[NewsAggregator] 🚀 Starting background aggregator (60-min rotation: NewsAPI → NewsData → GNews)');
                    setTimeout(() => runFetchCycle().catch(console.error), 5000);
                    aggregatorInterval = setInterval(() => runFetchCycle().catch(console.error), 60 * 60 * 1000);

                    // ── Middleware ──
                    server.middlewares.use(async (req: any, res: any, next: any) => {
                        if (req.url?.startsWith('/api/social') || req.url?.startsWith('/api/scroll') || req.url?.startsWith('/api/prayer-request') || req.url?.startsWith('/api/testimonies') || req.url?.startsWith('/api/donations') || req.url?.startsWith('/api/news-headlines') || req.url?.startsWith('/api/news')) {
                            const fs = await import('fs/promises');
                            const url = req.url.split('?')[0];

                            const adminPassword = (process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
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
                                // Try Supabase first, fallback to JSON cache
                                if (supabaseServer) {
                                    try {
                                        const { data: headlines, error } = await supabaseServer.from('news_headlines').select('*');
                                        if (!error && headlines && headlines.length > 0) {
                                            // Transform snake_case to camelCase for frontend compatibility
                                            const transformedHeadlines = headlines.map((h: any) => ({
                                                id: h.id,
                                                title: h.title,
                                                source: h.source,
                                                summary: h.summary,
                                                url: h.url,
                                                timestamp: h.timestamp,
                                                provider: h.provider,
                                                region: h.region,
                                                fetchedAt: h.fetched_at
                                            }));

                                            // Generate scroll lines from headlines
                                            const scrollLines = transformedHeadlines.map((h: any) => `${h.title} - ${h.source}`).slice(0, 20);

                                            // Calculate stats
                                            const stats = transformedHeadlines.reduce((acc: any, h: any) => {
                                                acc[h.region] = (acc[h.region] || 0) + 1;
                                                acc.total++;
                                                return acc;
                                            }, { nigeria: 0, africa: 0, world: 0, total: 0 });

                                            res.setHeader('Content-Type', 'application/json');
                                            res.setHeader('Cache-Control', 'public, max-age=600');
                                            res.end(JSON.stringify({
                                                headlines: scrollLines,
                                                fullHeadlines: transformedHeadlines,
                                                lastUpdated: transformedHeadlines.length > 0 ? transformedHeadlines[0].fetchedAt : '',
                                                lastProvider: transformedHeadlines.length > 0 ? transformedHeadlines[0].provider : '',
                                                stats: stats,
                                            }));
                                            return;
                                        }
                                    } catch (error: any) {
                                        console.warn('[Vite] Supabase headlines fetch failed:', error.message);
                                    }
                                }

                                // Fallback to JSON cache
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

                            // ── /api/news-headlines/:id ── DELETE headline
                            {
                                const match = url.match(/^\/api\/news-headlines\/([^\/]+)$/);
                                if (match && req.method === 'DELETE') {
                                    const id = decodeURIComponent(match[1]);
                                    const cache = await loadCache();
                                    const foundInCache = cache.headlines.some(h => h.id === id);
                                    let deletedInSupabase = false;

                                    if (supabaseServer) {
                                        const { data: existingRows, error } = await supabaseServer.from('news_headlines').select('id').eq('id', id).limit(1);
                                        if (!error && existingRows && existingRows.length > 0) {
                                            const { error: deleteError } = await supabaseServer.from('news_headlines').delete().eq('id', id);
                                            if (!deleteError) deletedInSupabase = true;
                                            else console.error('[Supabase] delete headline error:', deleteError);
                                        }
                                    }

                                    const nextHeadlines = cache.headlines.filter(h => h.id !== id);
                                    if (!foundInCache && !(supabaseServer && deletedInSupabase)) {
                                        res.statusCode = 404;
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify({ error: 'Headline not found' }));
                                        return;
                                    }

                                    cache.headlines = nextHeadlines;
                                    cache.scrollLines = buildScrollLines(cache.headlines);
                                    cache.stats = {
                                        nigeria: cache.headlines.filter(h => h.region === 'nigeria').length,
                                        africa: cache.headlines.filter(h => h.region === 'africa').length,
                                        world: cache.headlines.filter(h => h.region === 'world').length,
                                        total: cache.headlines.length,
                                    };
                                    await saveCache(cache);
                                    await deleteRowFromStorage('news_headlines', headlinesCachePath, id).catch(console.error);
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ success: true }));
                                    return;
                                }
                            }

                            // ── /api/news-headlines/:id ── PUT headline edit
                            {
                                const match = url.match(/^\/api\/news-headlines\/([^\/]+)$/);
                                if (match && req.method === 'PUT') {
                                    let body = '';
                                    req.on('data', (chunk: any) => { body += chunk.toString(); });
                                    req.on('end', async () => {
                                        try {
                                            const id = decodeURIComponent(match[1]);
                                            const bodyData = body ? JSON.parse(body) : {};
                                            const cache = await loadCache();
                                            let existing = cache.headlines.find(h => h.id === id);

                                            if (!existing && supabaseServer) {
                                                const { data: existingRows, error } = await supabaseServer.from('news_headlines').select('*').eq('id', id).limit(1);
                                                if (!error && existingRows && existingRows.length > 0) {
                                                    const row: any = existingRows[0];
                                                    existing = {
                                                        id: row.id,
                                                        title: row.title,
                                                        source: row.source,
                                                        summary: row.summary,
                                                        url: row.url,
                                                        timestamp: row.timestamp,
                                                        provider: row.provider,
                                                        region: row.region,
                                                        fetchedAt: row.fetched_at ?? row.fetchedAt,
                                                    };
                                                }
                                            }

                                            if (!existing) {
                                                res.statusCode = 404;
                                                res.setHeader('Content-Type', 'application/json');
                                                res.end(JSON.stringify({ error: 'Headline not found' }));
                                                return;
                                            }
                                            const updatedHeadline = {
                                                ...existing,
                                                title: bodyData.title ?? existing.title,
                                                summary: bodyData.summary ?? existing.summary,
                                                source: bodyData.source ?? existing.source,
                                                region: detectRegion(bodyData.title ?? existing.title, bodyData.summary ?? existing.summary),
                                            };
                                            cache.headlines = cache.headlines.map(h => h.id === id ? updatedHeadline : h);
                                            if (!cache.headlines.some(h => h.id === id)) {
                                                cache.headlines.push(updatedHeadline);
                                            }
                                            cache.scrollLines = buildScrollLines(cache.headlines);
                                            cache.stats = {
                                                nigeria: cache.headlines.filter(h => h.region === 'nigeria').length,
                                                africa: cache.headlines.filter(h => h.region === 'africa').length,
                                                world: cache.headlines.filter(h => h.region === 'world').length,
                                                total: cache.headlines.length,
                                            };
                                            await saveCache(cache);

                                            // Transform camelCase to snake_case for Supabase
                                            const transformedHeadline = {
                                                id: updatedHeadline.id,
                                                title: updatedHeadline.title,
                                                source: updatedHeadline.source,
                                                summary: updatedHeadline.summary,
                                                url: updatedHeadline.url,
                                                timestamp: updatedHeadline.timestamp,
                                                provider: updatedHeadline.provider,
                                                region: updatedHeadline.region,
                                                fetched_at: updatedHeadline.fetchedAt
                                            };

                                            if (supabaseServer) {
                                                const { error } = await supabaseServer.from('news_headlines').upsert([transformedHeadline], { onConflict: 'id' });
                                                if (error) {
                                                    console.error('[Supabase] update headline error:', error);
                                                }
                                            }

                                            await upsertRowInStorage('news_headlines', headlinesCachePath, updatedHeadline).catch(console.error);
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify(updatedHeadline));
                                        } catch (error: any) {
                                            res.statusCode = 500;
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify({ error: error.message }));
                                        }
                                    });
                                    return;
                                }
                            }

                            // ── /api/news-headlines/status ── GET aggregator status
                            if (url === '/api/news-headlines/status' && req.method === 'GET') {
                                const cache = await loadCache();
                                const nextIndex = (cache.providerIndex + 1) % PROVIDERS.length;
                                resetDailyStatsIfNeeded();
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
                                        newsapi: !!(process.env.NEWSAPI_KEY || env.NEWSAPI_KEY),
                                        newsdata: !!(process.env.NEWSDATA_API_KEY || env.NEWSDATA_API_KEY),
                                        gnews: !!(process.env.GNEWS_API_KEY || env.GNEWS_API_KEY),
                                    },
                                    dailyUsage: {
                                        date: dailyStats.date,
                                        requests: dailyStats.requests,
                                        articles: dailyStats.articles,
                                        limits: API_LIMITS
                                    }
                                }));
                                return;
                            }

                            // ── /api/socials ──
                            if (url === '/api/socials') {
                                const socialsPath = path.resolve(__dirname, 'socials.json');
                                const defaultSocials = [
                                    { id: "1", platform: "instagram", url: "https://instagram.com/freedomnaijaradio", enabled: true },
                                    { id: "2", platform: "facebook", url: "https://facebook.com/freedomnaijaradio", enabled: true },
                                    { id: "3", platform: "twitter", url: "https://twitter.com/freedomnaijaradio", enabled: true },
                                    { id: "4", platform: "whatsapp", url: "https://wa.me/2348000000000", enabled: true }
                                ];
                                if (req.method === 'GET') {
                                    try {
                                        const socials = await readTable<any>('socials', socialsPath, defaultSocials);
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify(socials));
                                    } catch {
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify(defaultSocials));
                                    }
                                    return;
                                }
                                if (req.method === 'POST') {
                                    if (!verifyAuthHeader(req)) {
                                        res.statusCode = 401;
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                                        return;
                                    }
                                    let body = '';
                                    req.on('data', (chunk: any) => { body += chunk.toString(); });
                                    req.on('end', async () => {
                                        try {
                                            const rows = JSON.parse(body);
                                            await saveTableRows('socials', socialsPath, rows);
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify({ success: true }));
                                        } catch (error: any) {
                                            res.statusCode = 400;
                                            res.end(JSON.stringify({ error: error.message }));
                                        }
                                    });
                                    return;
                                }
                            }

                            // ── /api/scroll ──
                            if (url === '/api/scroll' && req.method === 'GET') {
                                const scrollPath = path.resolve(__dirname, 'scroll.json');
                                const scrollConfig = await readTable<any>('scroll', scrollPath, [{ id: 'scroll-config', overrideEnabled: false, overrideMessage: '', scrollType: 'information' }]);
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify(scrollConfig[0] || { id: 'scroll-config', overrideEnabled: false, overrideMessage: '', scrollType: 'information' }));
                                return;
                            }

                            if (url === '/api/scroll' && req.method === 'POST') {
                                if (!verifyAuthHeader(req)) {
                                    res.statusCode = 401;
                                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                                    return;
                                }
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const scrollData = JSON.parse(body);
                                        const scrollPath = path.resolve(__dirname, 'scroll.json');
                                        await upsertRowInStorage('scroll', scrollPath, { id: 'scroll-config', ...scrollData });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify({ success: true }));
                                    } catch (error: any) {
                                        res.statusCode = 400;
                                        res.end(JSON.stringify({ error: error.message }));
                                    }
                                });
                                return;
                            }

                            // ── /api/prayer-request, /api/testimonies, /api/donations ──
                            if (url === '/api/prayer-request' || url === '/api/testimonies' || url === '/api/donations') {
                                const table = url === '/api/prayer-request' ? 'prayer_requests' : (url === '/api/donations' ? 'donations' : 'testimonies');
                                const filePath = path.resolve(__dirname, `${table}.json`);

                                if (req.method === 'GET') {
                                    if (!verifyAuthHeader(req)) {
                                        res.statusCode = 401;
                                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                                        return;
                                    }
                                    const rows = await readTable(table, filePath, []);
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
                                            const id = Date.now().toString();
                                            await upsertRowInStorage(table, filePath, { ...data, id, createdAt: new Date().toISOString() });
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify({ success: true }));
                                        } catch (error: any) {
                                            res.statusCode = 400;
                                            res.end(JSON.stringify({ error: error.message }));
                                        }
                                    });
                                    return;
                                }
                            }

                            // ── /api/news ──
                            if (url === '/api/news') {
                                const newsPath = path.resolve(__dirname, 'news.json');
                                if (req.method === 'GET') {
                                    try {
                                        let news = await readTable('news', newsPath, []);
                                        if (!verifyAuthHeader(req)) {
                                            news = news.filter((item: any) => item.status === 'Published');
                                        }
                                        news.sort((a: any, b: any) => {
                                            if (a.pinned && !b.pinned) return -1;
                                            if (!a.pinned && b.pinned) return 1;
                                            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                        });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify(news));
                                    } catch {
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify([]));
                                    }
                                    return;
                                }
                                if (req.method === 'POST') {
                                    if (!verifyAuthHeader(req)) {
                                        res.statusCode = 401;
                                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                                        return;
                                    }
                                    let body = '';
                                    req.on('data', chunk => { body += chunk.toString(); });
                                    req.on('end', async () => {
                                        try {
                                            const bd = JSON.parse(body);
                                            const newItem = { id: Date.now().toString(), title: bd.title, content: bd.content, status: bd.status || 'Draft', pinned: !!bd.pinned, createdAt: new Date().toISOString() };
                                            await upsertRowInStorage('news', newsPath, newItem);
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify(newItem));
                                        } catch (error: any) {
                                            res.statusCode = 400;
                                            res.end(JSON.stringify({ error: error.message }));
                                        }
                                    });
                                    return;
                                }
                                if (req.method === 'PUT') {
                                    if (!verifyAuthHeader(req)) {
                                        res.statusCode = 401;
                                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                                        return;
                                    }
                                    let body = '';
                                    req.on('data', chunk => { body += chunk.toString(); });
                                    req.on('end', async () => {
                                        try {
                                            const bd = JSON.parse(body);
                                            const existing = await readTable('news', newsPath, []);
                                            const item = existing.find((i: any) => i.id === bd.id);
                                            if (!item) {
                                                res.statusCode = 404;
                                                res.end(JSON.stringify({ error: 'News not found' }));
                                                return;
                                            }
                                            const updated = { ...item, title: bd.title, content: bd.content, status: bd.status, pinned: !!bd.pinned, updatedAt: new Date().toISOString() };
                                            await upsertRowInStorage('news', newsPath, updated);
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify(updated));
                                        } catch (error: any) {
                                            res.statusCode = 400;
                                            res.end(JSON.stringify({ error: error.message }));
                                        }
                                    });
                                    return;
                                }
                                if (req.method === 'DELETE') {
                                    if (!verifyAuthHeader(req)) {
                                        res.statusCode = 401;
                                        res.end(JSON.stringify({ error: 'Unauthorized' }));
                                        return;
                                    }
                                    const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
                                    const id = urlObj.searchParams.get('id');
                                    if (!id) {
                                        res.statusCode = 400;
                                        res.end(JSON.stringify({ error: 'ID required' }));
                                        return;
                                    }
                                    await deleteRowFromStorage('news', newsPath, id);
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ success: true }));
                                    return;
                                }
                            }
                        }
                        next();
                    });
                }
            }
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    };
});
