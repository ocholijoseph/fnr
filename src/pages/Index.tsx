import { useState, useEffect, useRef, useCallback } from "react";
import { RadioPlayer } from "@/components/RadioPlayer";
import { Footer } from "@/components/Footer";
import { NewsAccordion } from "@/components/NewsAccordion";
import NewsTicker from "@/components/NewsTicker";
import { isSupabaseEnabled, subscribeToTable } from "@/lib/supabase";
import { Newspaper, ChevronDown } from "lucide-react";

interface TrackInfo {
    title: string;
    artist: string;
    thumbnail?: string;
}

interface HistoryItem extends TrackInfo {
    id: string;
    playedAt: string;
}

const Index = () => {
    const [currentTrack, setCurrentTrack] = useState<TrackInfo | undefined>(undefined);
    const [currentTrackId, setCurrentTrackId] = useState<string>("");
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const lastTrackRef = useRef<string>("");
    const metadataErrorCount = useRef<number>(0);
    const [listenerCount, setListenerCount] = useState<number>(0);
    const [bitrate, setBitrate] = useState<number>(128); // Default to 128kbps
    const [scrollConfig, setScrollConfig] = useState<{ overrideEnabled: boolean; overrideMessage: string; scrollType?: "information" | "news" }>({ overrideEnabled: false, overrideMessage: "", scrollType: "information" });
    const [newsMessage, setNewsMessage] = useState("");

    // Load playback history from localStorage on mount
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('playbackHistory');
            if (savedHistory) {
                const parsedHistory = JSON.parse(savedHistory);
                setHistory(parsedHistory);
            }
        } catch (error) {
            console.error('Error loading playback history:', error);
        }
    }, []);

    // Clear playback history
    const clearHistory = () => {
        setHistory([]);
        try {
            localStorage.removeItem('playbackHistory');
        } catch (error) {
            console.error('Error clearing playback history:', error);
        }
    };
    const station = {
        title: "Freedom Naija Radio",
        // Using local proxy to fix playback and avoid mixed content/404 issues
        streamUrl: "https://player.dreamcode.ng/api/icecast/live",
        thumbnail: "/fulllogo.png",
        isLive: true,
    };

    const fetchArtwork = async (artist: string, title: string) => {
        try {
            console.log(`Fetching artwork for: ${artist} - ${title}`);
            const query = encodeURIComponent(`${artist} ${title}`);
            const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&limit=1`);
            const data = await response.json();
            console.log("iTunes response:", data);
            if (data.results && data.results.length > 0) {
                // Request 200x200 for minimum data usage instead of 600x600
                const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '200x200');
                console.log("Found artwork:", artworkUrl);
                return artworkUrl;
            }
            console.log("No artwork found on iTunes");
        } catch (error) {
            console.error("Error fetching artwork:", error);
        }
        return "/fulllogo.png";
    };

    const fetchMetadata = useCallback(async () => {
        try {
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            console.log("Fetching metadata from Icecast...");
            const timestamp = new Date().getTime();
            const response = await fetch(
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent("http://69.197.134.188:8000/status-json.xsl")}&dummy=${timestamp}`,
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Handle different proxy response formats
            let icecastData;
            if (data.contents) {
                // allorigins format
                icecastData = JSON.parse(data.contents);
            } else {
                // Direct JSON from other proxies like codetabs
                icecastData = data;
            }
            console.log("Icecast data:", icecastData);

            const source = icecastData.icestats?.source;

            // Handle multiple sources - find the best one
            let activeSource = null;
            if (Array.isArray(source)) {
                // Filter for sources that likely match our station
                const candidates = source.filter((s: { listenurl?: string; server_name?: string }) =>
                    s.listenurl?.includes('/live') ||
                    s.server_name?.toLowerCase().includes('freedom') ||
                    s.server_name?.toLowerCase().includes('fnr')
                );

                if (candidates.length > 0) {
                    // Pick the candidate with the highest listener count
                    activeSource = candidates.reduce((prev, current) => {
                        const prevListeners = parseInt(prev.listeners || '0', 10);
                        const currListeners = parseInt(current.listeners || '0', 10);
                        return (prevListeners > currListeners) ? prev : current;
                    });
                } else {
                    // Fallback to highest listener count overall if no specific match
                    activeSource = source.reduce((prev, current) => {
                        const prevListeners = parseInt(prev.listeners || '0', 10);
                        const currListeners = parseInt(current.listeners || '0', 10);
                        return (prevListeners > currListeners) ? prev : current;
                    });
                }
                console.log("Selected source:", activeSource?.listenurl || activeSource?.server_name, "Listeners:", activeSource?.listeners);
            } else {
                activeSource = source;
            }

            if (!activeSource) {
                console.error("No active source found");
                metadataErrorCount.current++;
                return;
            }

            let artist = "Unknown Artist";
            let title = "Unknown Title";

            if (activeSource.title) {
                const parts = activeSource.title.split(' - ');
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                } else {
                    title = activeSource.title.trim();
                }
            } else if (activeSource.artist && activeSource.song) {
                artist = activeSource.artist.trim();
                title = activeSource.song.trim();
            }

            console.log(`Parsed track: ${artist} - ${title}`);
            const trackKey = `${artist}-${title}`;

            // Reset error count on successful fetch
            metadataErrorCount.current = 0;

            // Update listener count and bitrate
            if (activeSource.listeners) {
                // Add fixed offset of 27 as requested
                setListenerCount(parseInt(activeSource.listeners, 10) + 27);
            }
            if (activeSource.bitrate) {
                // Determine if bitrate is likely in bps or kbps
                let newBitrate = parseInt(activeSource.bitrate, 10);
                if (newBitrate > 1000) {
                    newBitrate = Math.round(newBitrate / 1000);
                }
                setBitrate(newBitrate);
            }

            if (trackKey !== lastTrackRef.current) {
                console.log("Track changed! Updating...");
                const thumbnail = await fetchArtwork(artist, title);

                const newTrack = {
                    title,
                    artist,
                    thumbnail
                };
                const newTrackId = Date.now().toString();

                console.log("New track:", newTrack);

                // Add previous track to history if it exists
                if (currentTrack) {
                    const historyItem: HistoryItem = {
                        ...currentTrack,
                        id: currentTrackId || Date.now().toString(),
                        playedAt: new Date().toISOString()
                    };
                    setHistory(prev => [historyItem, ...prev].slice(0, 20)); // Keep last 20 tracks
                }

                setCurrentTrack(newTrack);
                setCurrentTrackId(newTrackId);
                lastTrackRef.current = trackKey;
            } else {
                console.log("Same track, no update");
            }
        } catch (error) {
            metadataErrorCount.current++;
            console.error(`Error fetching metadata (${metadataErrorCount.current}/3):`, error);
        }
    }, [currentTrack, currentTrackId]);

    const fetchScrollConfig = useCallback(async () => {
        try {
            const response = await fetch('/api/scroll');
            if (response.ok) {
                const rawData = await response.json();
                const config = Array.isArray(rawData) ? rawData[0] : rawData;
                const data = {
                    overrideEnabled: config.override_enabled ?? config.overrideEnabled ?? false,
                    overrideMessage: config.override_message ?? config.overrideMessage ?? "",
                    scrollType: config.scroll_type ?? config.scrollType ?? "information"
                };
                setScrollConfig(data);

                // Always fetch news headlines if scroll type is news
                if (data.scrollType === "news") {
                    const allTitles: string[] = [];

                    // 1. Fetch aggregated headlines
                    try {
                        const headlinesRes = await fetch('/api/news-headlines');
                        if (headlinesRes.ok) {
                            const hData = await headlinesRes.json();
                            if (hData.headlines && Array.isArray(hData.headlines)) {
                                allTitles.push(...hData.headlines);
                            }
                        }
                    } catch (err) {
                        console.error("Error fetching aggregated headlines:", err);
                    }

                    // 2. Fetch manual news items
                    try {
                        const newsRes = await fetch('/api/news');
                        if (newsRes.ok) {
                            const newsData = await newsRes.json();
                            const publishedNews = newsData
                                .filter((item: any) => item.status === "Published")
                                .map((item: any) => item.title);
                            allTitles.push(...publishedNews);
                        }
                    } catch (err) {
                        console.error("Error fetching manual news:", err);
                    }

                    if (allTitles.length > 0) {
                        const message = "📰 NEWS UPDATE 📰  " + allTitles.join("  🔸  ") + "  🔄  ";
                        console.log("[Index] News message updated:", message.substring(0, 50) + "...");
                        setNewsMessage(message);
                    } else {
                        setNewsMessage("📰 NEWS UPDATE: No recent headlines found. Stay tuned! 📰");
                    }
                } else {
                    setNewsMessage("");
                }
            }
        } catch (error) {
            console.error("[Index] Error fetching scroll config:", error);
        }
    }, []);

    useEffect(() => {
        // Scroll config is logged in fetchScrollConfig if needed
    }, [scrollConfig]);

    useEffect(() => {
        const fetchDataAndSchedule = () => {
            fetchMetadata();

            const getPollingInterval = () => {
                if (metadataErrorCount.current === 0) return 15000;
                if (metadataErrorCount.current <= 2) return 20000;
                if (metadataErrorCount.current <= 4) return 30000;
                return 60000;
            };

            const intervalId = setTimeout(() => {
                fetchDataAndSchedule();
            }, getPollingInterval());

            return intervalId;
        };

        const intervalId = fetchDataAndSchedule();

        return () => {
            clearTimeout(intervalId);
        };
    }, [fetchMetadata]);

    useEffect(() => {
        fetchScrollConfig();
        const intervalId = setInterval(fetchScrollConfig, 20000); // Poll every 20 seconds

        let unsubscribe: (() => Promise<void>) | undefined;
        if (isSupabaseEnabled()) {
            subscribeToTable<any>('scroll', () => {
                fetchScrollConfig();
            }).then((cleanup) => {
                unsubscribe = cleanup;
            }).catch((error) => {
                console.warn('Supabase realtime scroll subscription failed:', error);
            });
        }

        return () => {
            clearInterval(intervalId);
            if (unsubscribe) unsubscribe();
        };
    }, [fetchScrollConfig]);

    const scrollToNews = () => {
        const newsSection = document.getElementById('news-section');
        if (newsSection) {
            newsSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0c] text-white flex flex-col font-sans selection:bg-primary/30">
            {/* News Ticker Bar */}
            <NewsTicker 
                message={
                    (scrollConfig.overrideEnabled && scrollConfig.overrideMessage.trim())
                        ? scrollConfig.overrideMessage
                        : (scrollConfig.scrollType === "news" ? newsMessage : "")
                }
                visible={scrollConfig.overrideEnabled || scrollConfig.scrollType === "news"}
            />

            {/* Main Player Section */}
            <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700">
                <RadioPlayer
                    station={station}
                    currentTrack={currentTrack}
                    currentTrackId={currentTrackId}
                    history={history}
                    listenerCount={listenerCount}
                    bitrate={bitrate}
                    overrideMessage={
                        (scrollConfig.overrideEnabled && scrollConfig.overrideMessage.trim())
                            ? scrollConfig.overrideMessage
                            : (scrollConfig.scrollType === "news" ? (newsMessage || "📰 Loading latest news updates... 📰") : undefined)
                    }
                    scrollType={scrollConfig.scrollType}
                    onClearHistory={clearHistory}
                />
                
                {/* Scroll Indicator */}
                <button 
                    onClick={scrollToNews}
                    className="mt-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors group animate-bounce"
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest">Explore News</span>
                    <ChevronDown className="w-4 h-4" />
                </button>
            </main>

            {/* News & Information Hub */}
            <section id="news-section" className="w-full bg-black/40 backdrop-blur-xl border-t border-white/5 py-12 px-4 shadow-2xl">
                <div className="max-w-7xl mx-auto">
                    <NewsAccordion />
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Index;