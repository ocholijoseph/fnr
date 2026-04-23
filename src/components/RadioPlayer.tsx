import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, History, Radio, Calendar, Users, Activity, MessageSquare, Heart, MessageSquareText, Newspaper, Settings, Clock } from "lucide-react";
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
    scrollType?: "information" | "news";
    onClearHistory?: () => void;
}

export const RadioPlayer = ({ station, currentTrack, currentTrackId, history = [], listenerCount = 0, bitrate = 128, overrideMessage, scrollType = "information", onClearHistory }: RadioPlayerProps) => {
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
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(date);
    };


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

     // Cleanup timeouts on unmount
     useEffect(() => {
         return () => {
             if (reconnectTimeoutRef.current) {
                 clearTimeout(reconnectTimeoutRef.current);
             }
             if (connectionTimeoutRef.current) {
                 clearTimeout(connectionTimeoutRef.current);
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
            : "Freedom Naija Xtra";

    // Calculate dynamic duration based on text length to maintain constant speed
    // Higher factor = slower speed. 0.15 is a good balance for long text.
    const animationDuration = Math.max(10, displayText.length * 0.15);
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
        <div className="w-full max-w-xl mx-auto player-card rounded-2xl p-4 space-y-3 flex-1 flex flex-col justify-between">
             <audio
                 ref={audioRef}
                 src={station.streamUrl}
             />

            {/* Top Info Bar */}
            <div className="flex justify-between items-start w-full px-1 sm:px-2 mb-2">
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
                <div className="relative group">
                    <img
                        src="fulllogo.png"
                        alt="Freedom Naija Xtra Logo"
                        className="h-24 w-24 sm:h-28 sm:w-28 transition-all duration-300 group-hover:scale-110 drop-shadow-2xl"
                        loading="lazy"
                    />
                </div>
            </div>

            {/* Station Title */}
            <h1 className="text-3xl font-display font-bold text-center text-gradient tracking-tight px-4">
                {station.title}
            </h1>

            {/* Connection Status & Clock */}
            <div className="flex flex-col items-center gap-2">
                <div className={`px-6 py-2 rounded-full font-bold text-sm tracking-wider ${connectionDisplay.className}`}>
                    ● {connectionDisplay.text}
                </div>
                <div className="text-[11px] font-medium text-muted-foreground/80 tracking-widest uppercase flex items-center gap-2 bg-secondary/30 px-4 py-1 rounded-full border border-white/5">
                    <Clock className="w-3 h-3" />
                    {formatTime(currentTime)}
                </div>
            </div>

            {/* Now Playing */}
            <div className="flex items-center gap-4 bg-secondary rounded-xl p-4">
                 <div className="flex-shrink-0">
                     <img
                         src={thumbnail}
                         alt="Now playing"
                         className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover"
                         loading="lazy"
                     />
                 </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="text-sm text-muted-foreground mb-1 font-medium flex items-center gap-1.5">
                        {overrideMessage ? (
                            scrollType?.toLowerCase() === "news" ? (
                                <><Newspaper className="w-3 h-3 text-primary" /> News Updates</>
                            ) : (
                                <><Settings className="w-3 h-3 text-primary" /> Information</>
                            )
                        ) : "Now Playing"}
                    </div>
                    <div className="relative overflow-hidden w-full">
                        <div
                            className="whitespace-nowrap animate-marquee-seamless flex w-max"
                            style={marqueeStyle}
                        >
                            <span className="text-lg font-semibold px-12 font-['Inter']">{displayText}</span>
                            <span className="text-lg font-semibold px-12 font-['Inter']">{displayText}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 sm:gap-8">
                {/* Play/Pause */}
                <Button
                    onClick={togglePlay}
                    size="lg"
                    className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90 transition-transform hover:scale-110"
                >
                    {isPlaying ? (
                        <Pause className="h-6 w-6 sm:h-8 sm:w-8" />
                    ) : (
                        <Play className="h-6 w-6 sm:h-8 sm:w-8 ml-1" />
                    )}
                </Button>

                {/* Volume */}
                <div className="flex items-center gap-1.5 sm:gap-3 bg-secondary rounded-full px-2 sm:px-4 py-1.5 sm:py-2">
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
                        className="w-16 sm:w-24 touch-manipulation"
                        style={{ touchAction: 'none' }}
                    />
                </div>

                {/* History */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 rounded-full hover:bg-primary/10"
                        >
                            <History className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Playback History</DialogTitle>
                        </DialogHeader>
                        <PlaybackHistory history={history} currentTrackId={currentTrackId} onClearHistory={onClearHistory} />
                    </DialogContent>
                </Dialog>

                {/* Schedule */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 rounded-full hover:bg-accent/10"
                        >
                            <Calendar className="h-5 w-5" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
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
