import { Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect } from "react";

interface HistoryItem {
    id: string;
    title: string;
    artist: string;
    playedAt: string;
}

interface PlaybackHistoryProps {
    history: HistoryItem[];
    currentTrackId?: string;
}

export const PlaybackHistory = ({ history, currentTrackId }: PlaybackHistoryProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const currentPlayerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentPlayerRef.current && scrollAreaRef.current) {
            currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTrackId]);

    return (
        <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3" ref={scrollAreaRef}>
                {history.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                        No playback history yet
                    </p>
                ) : (
                    history.map((item, index) => (
                        <div
                            key={item.id}
                            ref={item.id === currentTrackId ? currentPlayerRef : null}
                            className={`flex items-start gap-3 p-4 rounded-lg transition-colors ${
                                item.id === currentTrackId
                                    ? 'bg-primary/20 border-2 border-primary'
                                    : 'bg-secondary hover:bg-secondary/80'
                            }`}
                        >
                            <Clock className={`h-5 w-5 mt-1 flex-shrink-0 ${
                                item.id === currentTrackId ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={`font-semibold truncate ${
                                        item.id === currentTrackId ? 'text-primary' : ''
                                    }`}>{item.title}</p>
                                    {item.id === currentTrackId && (
                                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full animate-pulse">
                                            NOW
                                        </span>
                                    )}
                                </div>
                                <p className={`text-sm truncate ${
                                    item.id === currentTrackId ? 'text-primary/80' : 'text-muted-foreground'
                                }`}>{item.artist}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(item.playedAt).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
    );
};