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
            const response = await fetch(
                "https://api.allorigins.win/get?url=" + encodeURIComponent("http://69.197.134.188:8000/status-json.xsl"),
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.contents) {
                console.error("No contents in response");
                metadataErrorCount.current++;
                return;
            }

            const icecastData = JSON.parse(data.contents);
            console.log("Icecast data:", icecastData);

            const source = icecastData.icestats?.source;

            // Handle multiple sources - find the one for Kingdom FM Xtra (radio2)
            let activeSource = null;
            if (Array.isArray(source)) {
                // Look for source that contains radio2 or has specific listenurl
                activeSource = source.find((s: { listenurl?: string; server_name?: string }) =>
                    s.listenurl?.includes('radio2') ||
                    s.server_name?.includes('Kingdom FM') ||
                    s.server_name?.includes('KFMX')
                ) || source[1] || source[0]; // Fallback to second source (radio2) or first
                console.log("Found source:", activeSource?.listenurl || activeSource?.server_name);
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

    return (
        <div className="min-h-screen bg-background py-6 px-4 max-w-xl mx-auto">
            <RadioPlayer
                station={station}
                currentTrack={currentTrack}
                currentTrackId={currentTrackId}
                history={history}
            />
            <Footer />
        </div>
    );
};

export default Index;