import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, History, Radio, Calendar, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlaybackHistory } from "./PlaybackHistory";
import { ScheduleView } from "./ScheduleView";

interface RadioPlayerProps {
    station: {
        title: string;
        streamUrl: string;
        thumbnail: string;
        isLive: boolean;
    };
    currentTrack?: {
        title: string;
        artist: string;
        thumbnail?: string;
    };
    currentTrackId?: string;
    history?: Array<{
        id: string;
        title: string;
        artist: string;
        playedAt: string;
    }>;
    listenerCount?: number;
    bitrate?: number;
    overrideMessage?: string;
}

export const RadioPlayer = ({ station, currentTrack, currentTrackId, history = [], listenerCount = 0, bitrate = 128, overrideMessage }: RadioPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(70);
    const [isMuted, setIsMuted] = useState(false);
    const [hasSignal, setHasSignal] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
    const audioRef = useRef<HTMLAudioElement>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastPlayAttemptRef = useRef<number>(0);
    const userInteractedRef = useRef<boolean>(false);
    const [dataUsage, setDataUsage] = useState<number>(0);
    const lastDataUpdateRef = useRef<number>(Date.now());

    useEffect(() => {
        if (audioRef.current) {
            const newVolume = volume / 100;
            audioRef.current.volume = newVolume;
        }
    }, [volume]);

    useEffect(() => {
        if (audioRef.current && isMuted) {
            audioRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const reconnectStream = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;

        console.log('Attempting to reconnect stream...');
        setConnectionStatus('reconnecting');
        setHasSignal(false);

        // Clear any existing timeouts
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        try {
            // Stop current playback
            audio.pause();
            audio.currentTime = 0;

            // Force reload with cache-busting
            const timestamp = Date.now();
            const separator = station.streamUrl.includes('?') ? '&' : '?';
            audio.src = `${station.streamUrl}${separator}_t=${timestamp}`;
            audio.load();

            // Wait a moment then attempt play
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (audio) {
                await audio.play();
                setConnectionStatus('connected');
                setHasSignal(true);
                setIsPlaying(true);
                console.log('Stream reconnected successfully');
            }
        } catch (error) {
            console.error('Reconnection failed:', error);
            setConnectionStatus('disconnected');
            setHasSignal(false);

            // Schedule another reconnection attempt
            reconnectTimeoutRef.current = setTimeout(() => {
                reconnectStream();
            }, 5000); // Try again in 5 seconds
        }
    }, [station.streamUrl]);

    const checkStreamHealth = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !isPlaying) return;

        const currentTime = Date.now();
        const timeSinceLastPlay = currentTime - lastPlayAttemptRef.current;

        // Check if stream is stalled (no progress for more than 30 seconds)
        if (audio.currentTime > 0 && !audio.paused) {
            const lastCurrentTime = audio.dataset.lastCurrentTime ? parseFloat(audio.dataset.lastCurrentTime) : 0;
            if (Math.abs(audio.currentTime - lastCurrentTime) < 1 && timeSinceLastPlay > 30000) {
                console.log('Stream appears to be stalled, reconnecting...');
                reconnectStream();
                return;
            }
        }

        // Store current time for next check
        audio.dataset.lastCurrentTime = audio.currentTime.toString();
    }, [isPlaying, reconnectStream]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handlePlay = () => {
            console.log('Audio playing');
            setHasSignal(true);
            setConnectionStatus('connected');
            audio.volume = volume / 100;
            lastPlayAttemptRef.current = Date.now();
        };

        const handlePause = () => {
            setHasSignal(false);
            setConnectionStatus('disconnected');
        };

        const handleError = (e: Event) => {
            console.error('Audio error:', e);
            setHasSignal(false);
            setConnectionStatus('disconnected');
            setIsPlaying(false);

            // Attempt to recover from error
            const audioElement = e.target as HTMLAudioElement;
            if (audioElement.error) {
                console.log('Audio error details:', audioElement.error);

                // Chrome-specific: Try alternative stream URL format on error
                if (audioElement.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                    console.log('Source not supported, trying alternative URL format...');
                    // Try adding common stream extensions
                    const currentUrl = audioElement.src;
                    if (!currentUrl.includes('.mp3') && !currentUrl.includes('.aac')) {
                        const timestamp = Date.now();
                        audioElement.src = `${station.streamUrl}.mp3?t=${timestamp}`;
                        audioElement.load();
                        setTimeout(() => {
                            audioElement.play().catch(console.error);
                        }, 1000);
                    }
                }

                // If network error, attempt reconnection
                if (audioElement.error.code === MediaError.MEDIA_ERR_NETWORK) {
                    setTimeout(() => {
                        reconnectStream();
                    }, 2000);
                }
            }
        };

        const handleStalled = () => {
            console.log('Stream stalled, attempting recovery...');
            setTimeout(() => {
                if (audio.paused || !hasSignal) {
                    reconnectStream();
                }
            }, 3000);
        };

        const handleWaiting = () => {
            console.log('Stream buffering...');
            setConnectionStatus('connecting');
        };

        const handleCanPlay = () => {
            console.log('Stream can play');
            if (isPlaying) {
                setConnectionStatus('connected');
                setHasSignal(true);
            }
        };

        const handlePlaying = () => {
            console.log('Stream is playing');
            setConnectionStatus('connected');
            setHasSignal(true);
        };

        const handleTimeUpdate = () => {
            if (isPlaying) {
                setConnectionStatus('connected');
                setHasSignal(true);
            }
            lastPlayAttemptRef.current = Date.now();
        };

        const handleEnded = () => {
            console.log('Stream ended, attempting to reconnect...');
            reconnectStream();
        };

        // Add comprehensive event listeners
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('error', handleError);
        audio.addEventListener('stalled', handleStalled);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('playing', handlePlaying);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);

        // Set up periodic health checks
        const healthCheckInterval = setInterval(checkStreamHealth, 10000); // Every 10 seconds

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('stalled', handleStalled);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            clearInterval(healthCheckInterval);
        };
    }, [volume, station.streamUrl, hasSignal, connectionStatus, checkStreamHealth, reconnectStream, isPlaying]);

    // Data usage tracking
    useEffect(() => {
        if (!isPlaying) {
            lastDataUpdateRef.current = Date.now();
            return;
        }

        const intervalId = setInterval(() => {
            const now = Date.now();
            const timeDiffSeconds = (now - lastDataUpdateRef.current) / 1000;

            // Calculate bytes: seconds * (kbps * 1000 / 8)
            const bytesPerSecond = (bitrate * 1000) / 8;
            const bytesUsed = timeDiffSeconds * bytesPerSecond;

            setDataUsage(prev => prev + bytesUsed);
            lastDataUpdateRef.current = now;
        }, 1000);

        return () => clearInterval(intervalId);
    }, [isPlaying, bitrate]);

    const formatDataUsage = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    // Auto-play on component mount
    useEffect(() => {
        const attemptAutoPlay = async () => {
            const audio = audioRef.current;
            if (!audio) return;

            setConnectionStatus('connecting');

            // Chrome requires user interaction for autoplay
            // Also check for mixed content issues
            try {
                if (!audio.paused) return; // Already playing

                setConnectionStatus('connecting');
                await audio.play();
                setIsPlaying(true);
                setConnectionStatus('connected');
                lastPlayAttemptRef.current = Date.now();
            } catch (error) {
                console.log('Auto-play prevented by browser:', error);

                // Check if it's a mixed content error (Chrome-specific)
                if (error instanceof Error && error.message.includes('mixed content')) {
                    console.error('MIXED CONTENT ERROR: Chrome blocks HTTP streams on HTTPS pages');
                    console.error('Solution: Serve your app over HTTP or use HTTPS proxy for the stream');
                    setConnectionStatus('disconnected');
                } else {
                    setConnectionStatus('disconnected');
                }
            }
        };

        attemptAutoPlay();

        // Cleanup on unmount
        return () => {
            const reconnectTimeout = reconnectTimeoutRef.current;
            const currentConnectionTimeout = connectionTimeoutRef.current;

            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            if (currentConnectionTimeout) {
                clearTimeout(currentConnectionTimeout);
            }
        };
    }, []);

    const togglePlay = async () => {
        const audio = audioRef.current;
        if (!audio) return;

        userInteractedRef.current = true;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
            setConnectionStatus('disconnected');
        } else {
            try {
                setConnectionStatus('connecting');
                await audio.play();
                setIsPlaying(true);
                setConnectionStatus('connected');
                lastPlayAttemptRef.current = Date.now();
            } catch (error) {
                console.error('Play failed:', error);
                setConnectionStatus('disconnected');
                // Attempt recovery
                setTimeout(() => {
                    reconnectStream();
                }, 1000);
            }
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const displayText = overrideMessage
        ? overrideMessage
        : currentTrack
            ? `${currentTrack.artist} — ${currentTrack.title}`
            : "...A New Song!";

    // Calculate dynamic duration based on text length to maintain constant speed
    // Higher factor = slower speed. 0.15 is a good balance.
    const animationDuration = Math.max(10, displayText.length * 0.2);
    const marqueeStyle = {
        animationDuration: `${animationDuration}s`,
    };

    const thumbnail = currentTrack?.thumbnail || station.thumbnail;

    // Get connection status color and text
    const getConnectionDisplay = () => {
        switch (connectionStatus) {
            case 'connecting':
                return { text: 'CONNECTING...', className: 'bg-yellow-500 text-white' };
            case 'connected':
                return { text: 'LIVE!', className: 'bg-primary text-primary-foreground animate-pulse-glow' };
            case 'reconnecting':
                return { text: 'RECONNECTING...', className: 'bg-orange-500 text-white animate-pulse' };
            case 'disconnected':
            default:
                return { text: 'OFFLINE', className: 'bg-muted text-muted-foreground' };
        }
    };

    const connectionDisplay = getConnectionDisplay();

    return (
        <div className="w-full max-w-2xl mx-auto player-card rounded-2xl p-4 space-y-3 flex-1 flex flex-col justify-between">
            <audio
                ref={audioRef}
                src={station.streamUrl}
                preload="auto"
            />

            {/* Top Info Bar */}
            <div className="flex justify-between items-start w-full px-2 mb-2">
                {/* Listener Count - Top Left */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/90 text-sm font-medium border border-white/10 shadow-sm">
                        <Users className="w-4 h-4" />
                        <span>{listenerCount.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">Listeners</span>
                </div>

                {/* Data Usage - Top Right */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/90 text-sm font-medium border border-white/10 shadow-sm">
                        <Activity className="w-4 h-4" />
                        <span>{formatDataUsage(dataUsage)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 font-medium tracking-wide uppercase">Data Used</span>
                </div>
            </div>

            {/* Logo */}
            <div className="flex justify-center">
                <div className="relative group rounded-full p-2 bg-gradient-to-br from-gray-100/90 to-gray-200/80 shadow-2xl">
                    <img
                        src="/fulllogo.png"
                        alt="Kingdom FM Xtra Logo"
                        className="h-28 w-28 transition-all duration-300 group-hover:scale-110 drop-shadow-2xl"
                    />
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
                </div>
            </div>

            {/* Station Title */}
            <h1 className="text-3xl font-display font-bold text-center text-gradient tracking-tight px-4">
                {station.title}
            </h1>

            {/* Connection Status */}
            <div className="flex justify-center">
                <div className={`px-6 py-2 rounded-full font-bold text-sm tracking-wider ${connectionDisplay.className}`}>
                    ● {connectionDisplay.text}
                </div>
            </div>

            {/* Now Playing */}
            <div className="flex items-center gap-4 bg-secondary rounded-xl p-4">
                <div className="flex-shrink-0">
                    <img
                        src={thumbnail}
                        alt="Now playing"
                        className="w-20 h-20 rounded-lg object-cover"
                    />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="text-sm text-muted-foreground mb-1">
                        {overrideMessage ? "Information" : "Now Playing"}
                    </div>
                    <div className="relative overflow-hidden w-full">
                        <div
                            className="whitespace-nowrap animate-marquee-seamless flex w-max"
                            style={marqueeStyle}
                        >
                            <span className="text-lg font-semibold px-4">{displayText}</span>
                            <span className="text-lg font-semibold px-4">{displayText}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-8">
                {/* Play/Pause */}
                <Button
                    onClick={togglePlay}
                    size="lg"
                    className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-110"
                >
                    {isPlaying ? (
                        <Pause className="h-8 w-8" />
                    ) : (
                        <Play className="h-8 w-8 ml-1" />
                    )}
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-3 bg-secondary rounded-full px-4 py-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        className="h-8 w-8 hover:bg-muted"
                    >
                        {isMuted || volume === 0 ? (
                            <VolumeX className="h-5 w-5" />
                        ) : (
                            <Volume2 className="h-5 w-5" />
                        )}
                    </Button>
                    <Slider
                        value={[volume]}
                        onValueChange={(v) => {
                            const newVolume = v[0];
                            setVolume(newVolume);
                            if (audioRef.current) {
                                audioRef.current.volume = newVolume / 100;
                            }
                        }}
                        max={100}
                        step={1}
                        min={0}
                        className="w-24 touch-manipulation"
                        style={{ touchAction: 'none' }}
                    />
                </div>

                {/* History */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full border-2 hover:border-primary hover:bg-primary/10"
                        >
                            <History className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Playback History</DialogTitle>
                        </DialogHeader>
                        <PlaybackHistory history={history} currentTrackId={currentTrackId} />
                    </DialogContent>
                </Dialog>

                {/* Schedule */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full border-2 hover:border-accent hover:bg-accent/10"
                        >
                            <Calendar className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Schedule</DialogTitle>
                        </DialogHeader>
                        <ScheduleView />
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};