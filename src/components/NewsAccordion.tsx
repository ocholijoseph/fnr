import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertCircle, Loader2, Archive, RefreshCw, Zap, Globe, Clock, ChevronRight, Share2, ArrowLeft, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { newsStorage } from "@/lib/news-storage";
import { ArchivedNewsModal } from "@/components/ArchivedNewsModal";
import { useSwipeGestures } from "@/hooks/use-swipe-gestures";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getHeadlines, type HeadlineItem } from "@/lib/newsapi-service";

interface ManualNewsItem {
    id: string;
    title: string;
    content: string;
    status: string;
    pinned: boolean;
    createdAt: string;
}

export interface NewsAccordionProps {
    selectedHeadline?: HeadlineItem | null;
    onHeadlineChange?: (headline: HeadlineItem | null) => void;
}

export const NewsAccordion = ({ selectedHeadline: propHeadline, onHeadlineChange }: NewsAccordionProps) => {
    const [archivedCount, setArchivedCount] = useState(0);
    const [currentSwipeItem, setCurrentSwipeItem] = useState<string | null>(null);
    const [internalHeadline, setInternalHeadline] = useState<HeadlineItem | null>(null);
    const detailRef = useRef<HTMLDivElement>(null);

    // Use either prop or local state
    const selectedHeadline = propHeadline !== undefined ? propHeadline : internalHeadline;
    const setSelectedHeadline = (headline: HeadlineItem | null) => {
        if (onHeadlineChange) {
            onHeadlineChange(headline);
        } else {
            setInternalHeadline(headline);
        }
    };

    // Fetch manual news items (from api-server / Supabase)
    const {
        data: manualNews = [],
        isLoading: isLoadingManual,
        refetch: refetchManual,
    } = useQuery({
        queryKey: ["manual-news"],
        queryFn: async () => {
            const res = await fetch('/api/news');
            if (!res.ok) return [];
            return res.json() as Promise<ManualNewsItem[]>;
        },
        refetchInterval: 5 * 60 * 1000,
    });

    // Fetch aggregated headlines
    const {
        data: headlinesData,
        isLoading: isLoadingHeadlines,
        error: headlinesError,
        refetch: refetchHeadlines,
    } = useQuery({
        queryKey: ["headlines"],
        queryFn: getHeadlines,
        refetchInterval: 10 * 60 * 1000,
    });

    const isLoading = isLoadingManual || isLoadingHeadlines;

    // Filter out archived manual news
    const visibleManualNews = manualNews.filter(item => !newsStorage.isArchived(item.id));
    const headlines = headlinesData?.fullHeadlines || [];

    const handleRefresh = useCallback(() => {
        refetchManual();
        refetchHeadlines();
    }, [refetchManual, refetchHeadlines]);

    // Update archived count
    useEffect(() => {
        setArchivedCount(newsStorage.getArchivedCount());
    }, []);

    // Swipe gestures setup
    const { elementRef, isDragging, swipeDirection, addEventListeners, removeEventListeners } = useSwipeGestures({
        onSwipeLeft: () => {
            if (currentSwipeItem) {
                const item = manualNews.find(n => n.id === currentSwipeItem);
                if (item) {
                    newsStorage.archiveNews({ ...item, documentId: item.id, body: item.content, publishedAt: item.createdAt } as any, 'swipe');
                    setArchivedCount(newsStorage.getArchivedCount());
                    refetchManual();
                }
            }
        },
        onSwipeRight: handleRefresh,
        threshold: 80,
    });

    useEffect(() => {
        addEventListeners();
        return removeEventListeners;
    }, [addEventListeners, removeEventListeners]);

    const handleAccordionInteraction = useCallback((itemId: string) => {
        setCurrentSwipeItem(itemId);
        setTimeout(() => setCurrentSwipeItem(null), 1000);
    }, []);

    const openHeadline = useCallback((item: HeadlineItem) => {
        setSelectedHeadline(item);
        requestAnimationFrame(() => {
            detailRef.current?.focus();
        });
    }, []);

    const closeHeadline = useCallback(() => {
        setSelectedHeadline(null);
    }, []);

    useEffect(() => {
        if (!selectedHeadline) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeHeadline();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedHeadline, closeHeadline]);

    if (isLoading && manualNews.length === 0 && headlines.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto mt-8 p-8 flex flex-col items-center justify-center min-h-[300px] player-card rounded-2xl border border-white/5">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium animate-pulse">Syncing world news...</p>
            </div>
        );
    }

    return (
        <div
            ref={elementRef as React.RefObject<HTMLDivElement>}
            className="w-full max-w-4xl mx-auto mt-8 mb-12 relative"
        >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 px-2 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
                        <Newspaper className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-display font-bold tracking-tight">News Hub</h2>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Latest Global & Station Updates</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end">
                    <ArchivedNewsModal archivedCount={archivedCount} onRefresh={handleRefresh} />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-9 gap-2 bg-secondary/30 border border-white/5 hover:bg-secondary/50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="live" className="w-full">
                <TabsList className="w-full max-w-[400px] mb-6 p-1 bg-secondary/30 border border-white/5 h-11">
                    <TabsTrigger value="live" className="flex-1 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
                        <Zap className="h-3.5 w-3.5" /> Live Feed
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="flex-1 gap-2 data-[state=active]:bg-primary data-[state=active]:text-white relative">
                        <Newspaper className="h-3.5 w-3.5" /> Station Updates
                        {visibleManualNews.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white animate-bounce">
                                {visibleManualNews.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="live" className="space-y-4 outline-none">
                    {selectedHeadline ? (
                        <div
                            ref={detailRef}
                            tabIndex={-1}
                            className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300"
                        >
                            <div className="sticky top-0 z-20 bg-[#0f0f11]/90 backdrop-blur-md pb-4 pt-1 mb-2">
                                <button
                                    onClick={closeHeadline}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary active:text-primary transition-colors group focus-visible:ring-2 focus-visible:ring-primary rounded-xl px-4 py-3 -ml-2 min-h-[48px] touch-manipulation bg-secondary/20 border border-white/5"
                                    aria-label="Back to headlines"
                                >
                                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                    Back to Headlines
                                </button>
                            </div>

                            <div className="bg-secondary/20 border border-white/5 rounded-2xl overflow-hidden">
                                <div className="p-5 sm:p-6 space-y-5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter border-primary/20 bg-primary/5 text-primary">
                                            {selectedHeadline.region}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter border-blue-500/20 bg-blue-500/5 text-blue-400">
                                            {selectedHeadline.provider}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(selectedHeadline.timestamp).toLocaleString([], {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>

                                    <h2 className="text-xl sm:text-2xl font-bold leading-tight tracking-tight">
                                        {selectedHeadline.title}
                                    </h2>

                                    {selectedHeadline.summary ? (
                                        <p className="text-sm sm:text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                                            {selectedHeadline.summary}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">
                                            Full content is not available for this headline. Visit the source for details.
                                        </p>
                                    )}

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-4 border-t border-white/5">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Source: {selectedHeadline.source}
                                        </span>
                                        {selectedHeadline.url && (
                                            <a
                                                href={selectedHeadline.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Read original article
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {headlines.length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-secondary/10 rounded-2xl border border-dashed border-white/10">
                                <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">No live headlines available at this moment.</p>
                            </div>
                        ) : (
                            headlines.map((item: HeadlineItem) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => openHeadline(item)}
                                    className="group p-4 sm:p-5 bg-secondary/20 hover:bg-secondary/40 active:bg-secondary/50 border border-white/5 rounded-2xl transition-colors duration-200 flex flex-col justify-between gap-4 text-left w-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background min-h-[100px] touch-manipulation"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-primary/20 bg-primary/5 text-primary">
                                                {item.region}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-primary group-active:text-primary transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                            {item.summary || 'Tap to read more on ' + item.source}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.source}</span>
                                        <span className="text-primary text-xs font-bold flex items-center gap-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            Read More <ChevronRight className="h-3 w-3" />
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                    )}
                </TabsContent>

                <TabsContent value="manual" className="outline-none">
                    {visibleManualNews.length === 0 ? (
                        <div className="py-20 text-center bg-secondary/10 rounded-2xl border border-dashed border-white/10">
                            <Newspaper className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground">No recent station updates or announcements.</p>
                        </div>
                    ) : (
                        <Accordion type="single" collapsible className="w-full space-y-3">
                            {visibleManualNews.map((newsItem) => (
                                <AccordionItem
                                    key={newsItem.id}
                                    value={newsItem.id}
                                    className="border border-white/5 bg-secondary/20 rounded-2xl overflow-hidden px-1"
                                >
                                    <AccordionTrigger
                                        className="text-left py-4 px-4 hover:no-underline"
                                        onMouseDown={() => handleAccordionInteraction(newsItem.id)}
                                        onTouchStart={() => handleAccordionInteraction(newsItem.id)}
                                    >
                                        <div className="flex flex-col gap-1.5 pr-4">
                                            <div className="flex items-center gap-2">
                                                {newsItem.pinned && <Badge className="bg-primary text-white text-[8px] h-4">PINNED</Badge>}
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{new Date(newsItem.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <span className="font-bold text-base leading-tight">{newsItem.title}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-5 pb-6">
                                        <div className="space-y-4">
                                            <div 
                                                className="text-sm text-foreground/80 leading-relaxed prose prose-invert max-w-none"
                                                dangerouslySetInnerHTML={{ __html: newsItem.content }} 
                                            />
                                            <div className="pt-5 border-t border-white/5 flex items-center justify-between">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        newsStorage.archiveNews({...newsItem, documentId: newsItem.id, body: newsItem.content, publishedAt: newsItem.createdAt} as any, 'manual');
                                                        setArchivedCount(newsStorage.getArchivedCount());
                                                        refetchManual();
                                                    }}
                                                >
                                                    <Archive className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-bold uppercase">Archive</span>
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-8 gap-2 text-primary hover:bg-primary/10">
                                                    <Share2 className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-bold uppercase">Share</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </TabsContent>
            </Tabs>

            {/* Visual feedback for swipe gestures */}
            {isDragging && (
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-between px-8">
                    <div className={`transition-opacity duration-200 ${swipeDirection === 'right' ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="bg-green-500/20 backdrop-blur-md p-4 rounded-full border border-green-500/30">
                            <RefreshCw className="h-8 w-8 text-green-500 animate-spin" />
                        </div>
                    </div>
                    <div className={`transition-opacity duration-200 ${swipeDirection === 'left' ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="bg-destructive/20 backdrop-blur-md p-4 rounded-full border border-destructive/30">
                            <Archive className="h-8 w-8 text-destructive animate-bounce" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};