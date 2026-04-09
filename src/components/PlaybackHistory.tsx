import { Clock, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
    onClearHistory?: () => void;
}

export const PlaybackHistory = ({ history, currentTrackId, onClearHistory }: PlaybackHistoryProps) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const currentPlayerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentPlayerRef.current && scrollAreaRef.current) {
            currentPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTrackId]);

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-end">
                {history.length > 0 && onClearHistory && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearHistory}
                        className="text-xs"
                    >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                )}
            </div>
            <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3" ref={scrollAreaRef}>
                    {history.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            No playback history yet
                        </p>
                    ) : (
                        history.map((item) => (
                            <div
                                key={item.id}
                                ref={item.id === currentTrackId ? currentPlayerRef : null}
                                className={`flex items-start gap-3 p-4 rounded-lg transition-colors ${
                                    item.id === currentTrackId
                                        ? 'bg-primary/20 border-2 border-primary shadow-md'
                                        : 'bg-secondary hover:bg-secondary/80'
                                }`}
                            >
                                <Clock className={`h-5 w-5 mt-1 flex-shrink-0 ${
                                    item.id === currentTrackId ? 'text-primary' : 'text-muted-foreground'
                                }`} />
                                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                        <p className={`font-semibold truncate flex-1 leading-tight ${
                                            item.id === currentTrackId ? 'text-primary' : ''
                                        }`}>
                                            {item.title}
                                        </p>
                                        {item.id === currentTrackId && (
                                            <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded flex-shrink-0 animate-pulse">
                                                NOW PLAYING
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm truncate leading-tight ${
                                        item.id === currentTrackId ? 'text-primary/80' : 'text-muted-foreground'
                                    }`}>
                                        {item.artist}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                        {formatTime(item.playedAt)}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};