import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, Trash2, Clock, RotateCcw } from "lucide-react";
import { newsStorage, type ArchivedNews } from "@/lib/news-storage";
import { useState } from "react";

interface ArchivedNewsModalProps {
    archivedCount: number;
    onRefresh?: () => void;
}

export const ArchivedNewsModal = ({ archivedCount, onRefresh }: ArchivedNewsModalProps) => {
    const [open, setOpen] = useState(false);
    const [archivedNews, setArchivedNews] = useState<ArchivedNews[]>([]);

    const handleOpen = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            setArchivedNews(newsStorage.getArchivedNews());
        }
    };

    const handleUnarchive = (documentId: string) => {
        newsStorage.unarchiveNews(documentId);
        setArchivedNews(newsStorage.getArchivedNews());
        onRefresh?.();
    };

    const handleClearAll = () => {
        if (confirm('Are you sure you want to clear all archived news?')) {
            newsStorage.clearArchivedNews();
            setArchivedNews([]);
            onRefresh?.();
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
            Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            'day'
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Archive className="h-4 w-4" />
                    <span>Archive</span>
                    {archivedCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1 text-xs">
                            {archivedCount}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle className="flex items-center gap-2">
                        <Archive className="h-5 w-5" />
                        Archived News
                    </DialogTitle>
                    {archivedNews.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearAll}
                            className="text-destructive hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear All
                        </Button>
                    )}
                </DialogHeader>

                <div className="space-y-4">
                    {archivedNews.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No archived news yet.</p>
                            <p className="text-sm">Swipe left on news items to archive them.</p>
                        </div>
                    ) : (
                        archivedNews.map((item) => (
                            <div
                                key={item.documentId}
                                className="p-4 border rounded-lg space-y-3 bg-card/50"
                            >
                                <div className="flex justify-between items-start">
                                    <h4 className="font-semibold line-clamp-2 flex-1">{item.title}</h4>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnarchive(item.documentId)}
                                        className="ml-2 shrink-0"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>Archived {formatDate(item.archivedAt)}</span>
                                    {item.category && (
                                        <>
                                            <span>•</span>
                                            <Badge variant="outline" className="text-xs">
                                                {item.category.name}
                                            </Badge>
                                        </>
                                    )}
                                </div>

                                <div
                                    className="text-sm text-muted-foreground line-clamp-2"
                                    dangerouslySetInnerHTML={{ __html: item.body.replace(/<[^>]*>/g, '').substring(0, 150) + '...' }}
                                />
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};