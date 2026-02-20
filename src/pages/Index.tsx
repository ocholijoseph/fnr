import { useState, useEffect, useRef, useCallback } from "react";
import { RadioPlayer } from "@/components/RadioPlayer";
import { Footer } from "@/components/Footer";

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
    const station = {
        title: "Kingdom FM Xtra",
        streamUrl: "https://player2.dreamcode.ng/kfmx",
        thumbnail: "/placeholder.svg",
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
                const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
                console.log("Found artwork:", artworkUrl);
                return artworkUrl;
            }
            console.log("No artwork found on iTunes");
        } catch (error) {
            console.error("Error fetching artwork:", error);
        }
        return "/placeholder.svg";
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
                    s.listenurl?.includes('radio2') ||
                    s.server_name?.includes('Kingdom FM') ||
                    s.server_name?.includes('KFMX')
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
                // If bitrate > 1000, it's almost certainly bps (e.g. 128000)
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

                setCurrentTrack(prevTrack => {
                    if (prevTrack) {
                        setHistory(prev => [{
                            ...prevTrack,
                            id: currentTrackId || Date.now().toString(),
                            playedAt: new Date().toISOString()
                        }, ...prev].slice(0, 10));
                    }
                    return newTrack;
                });

                setCurrentTrackId(newTrackId);
                lastTrackRef.current = trackKey;
            } else {
                console.log("Same track, no update");
            }
        } catch (error) {
            metadataErrorCount.current++;
            console.error(`Error fetching metadata (${metadataErrorCount.current}/3):`, error);

            // If we've had 3 consecutive errors, implement exponential backoff
            if (metadataErrorCount.current >= 3) {
                console.log("Multiple consecutive errors, implementing backoff...");
                // The useEffect will handle the backoff by checking the error count
            }
        }
    }, []);

    const fetchScrollConfig = useCallback(async () => {
        try {
            const response = await fetch('/api/scroll');
            if (response.ok) {
                const data = await response.json();
                setScrollConfig(data);

                // If News is selected, fetch news items to build the message
                if (data.scrollType === "news") {
                    try {
                        const newsRes = await fetch('/api/news');
                        if (newsRes.ok) {
                            const newsData = await newsRes.json();
                            const publishedNews = newsData
                                .filter((item: any) => item.status === "Published")
                                .map((item: any) => item.title);

                            if (publishedNews.length > 0) {
                                // Add extra space at the end of the news message for better marquee separation
                                setNewsMessage("NEWS: " + publishedNews.join(" | ") + "          ");
                            } else {
                                setNewsMessage("Stay tuned for latest updates!");
                            }
                        }
                    } catch (err) {
                        console.error("Error fetching news for scroll:", err);
                    }
                } else {
                    setNewsMessage("");
                }
            }
        } catch (error) {
            console.error("Error fetching scroll config:", error);
        }
    }, []);

    useEffect(() => {
        const fetchDataAndSchedule = () => {
            fetchMetadata();

            // Set up dynamic polling interval based on error count
            const getPollingInterval = () => {
                if (metadataErrorCount.current === 0) return 3000; // 3 seconds
                if (metadataErrorCount.current <= 2) return 5000; // 5 seconds
                if (metadataErrorCount.current <= 4) return 10000; // 10 seconds
                return 30000; // 30 seconds for persistent issues
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
        return () => clearInterval(intervalId);
    }, [fetchScrollConfig]);

    return (
        <div className="h-full w-full bg-background flex flex-col py-4 px-4">
            <RadioPlayer
                station={station}
                currentTrack={currentTrack}
                currentTrackId={currentTrackId}
                history={history}
                listenerCount={listenerCount}
                bitrate={bitrate}
                overrideMessage={
                    scrollConfig.overrideEnabled
                        ? (scrollConfig.scrollType === "news" ? (newsMessage || "NEWS: Fetching latest updates...") : scrollConfig.overrideMessage)
                        : undefined
                }
                scrollType={scrollConfig.scrollType}
            />
            <Footer />
        </div>
    );
};

export default Index;