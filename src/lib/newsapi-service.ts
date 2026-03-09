/**
 * News Aggregator Client Service
 * 
 * Connects to the backend news aggregator that rotates through
 * NewsAPI.org, NewsData.io, and GNews.io every 10 minutes.
 * 
 * Provides functions for the Admin panel to:
 * - Fetch current headline data
 * - Manually trigger a fetch cycle
 * - Get aggregator status
 */

export interface HeadlineItem {
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

export interface HeadlinesResponse {
    headlines: string[];           // Formatted scroll lines
    fullHeadlines: HeadlineItem[]; // Full headline objects
    lastUpdated: string;
    lastProvider: string;
    stats: {
        nigeria: number;
        africa: number;
        world: number;
        total: number;
    };
}

export interface AggregatorStatus {
    lastUpdated: string;
    lastProvider: string;
    nextProvider: string;
    providerErrors: Record<string, string>;
    stats: {
        nigeria: number;
        africa: number;
        world: number;
        total: number;
    };
    totalCached: number;
    providerRotation: {
        name: string;
        isCurrent: boolean;
        isNext: boolean;
        lastError: string | null;
    }[];
    keysConfigured: {
        newsapi: boolean;
        newsdata: boolean;
        gnews: boolean;
    };
}

export interface FetchResult {
    success: boolean;
    provider: string;
    fetched: number;
    error?: string;
    stats: {
        nigeria: number;
        africa: number;
        world: number;
        total: number;
    };
    totalHeadlines: number;
}

/**
 * Get current cached headlines for the scroll ticker
 */
export async function getHeadlines(): Promise<HeadlinesResponse> {
    const res = await fetch('/api/news-headlines');
    if (!res.ok) throw new Error(`Failed to fetch headlines: ${res.status}`);
    return res.json();
}

/**
 * Manually trigger a fetch cycle from a specific provider (or next in rotation)
 */
export async function triggerFetch(provider?: string): Promise<FetchResult> {
    const res = await fetch('/api/news-headlines/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider ? { provider } : {}),
    });
    if (!res.ok) throw new Error(`Fetch trigger failed: ${res.status}`);
    return res.json();
}

/**
 * Get aggregator status (rotation state, provider health, key config)
 */
export async function getAggregatorStatus(): Promise<AggregatorStatus> {
    const res = await fetch('/api/news-headlines/status');
    if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
    return res.json();
}
