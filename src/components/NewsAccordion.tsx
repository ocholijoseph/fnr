import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertCircle, Loader2, Archive, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { newsApi, type NewsResponse } from "@/lib/api";
import { newsStorage } from "@/lib/news-storage";
import { ArchivedNewsModal } from "@/components/ArchivedNewsModal";
import { useSwipeGestures } from "@/hooks/use-swipe-gestures";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";

export const NewsAccordion = () => {
    const [archivedCount, setArchivedCount] = useState(0);
    const [currentSwipeItem, setCurrentSwipeItem] = useState<string | null>(null);

    const {
        data: news = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["news"],
        queryFn: () => newsApi.getNews(10),
        refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
        staleTime: 60 * 1000, // Consider data fresh for 1 minute
    });

    // Update archived count
    useEffect(() => {
        setArchivedCount(newsStorage.getArchivedCount());
    }, []);

    // Filter out archived news
    const visibleNews = news.filter(item => !newsStorage.isArchived(item.documentId));

    // Handle swipe left - archive news
    const handleSwipeLeft = useCallback((newsItem: NewsResponse) => {
        if (currentSwipeItem === newsItem.documentId) {
            newsStorage.archiveNews(newsItem, 'swipe');
            setArchivedCount(newsStorage.getArchivedCount());
            setCurrentSwipeItem(null);
        }
    }, [currentSwipeItem]);

    // Handle swipe right - refresh news
    const handleSwipeRight = useCallback(() => {
        refetch();
    }, [refetch]);

    // Setup swipe gestures for news container
    const { elementRef, isDragging, swipeDirection, deltaX, addEventListeners, removeEventListeners } = useSwipeGestures({
        onSwipeLeft: () => {
            if (currentSwipeItem) {
                const item = visibleNews.find(n => n.documentId === currentSwipeItem);
                if (item) handleSwipeLeft(item);
            }
        },
        onSwipeRight: handleSwipeRight,
        threshold: 80, // Higher threshold for news items
    });

    // Setup event listeners
    useEffect(() => {
        addEventListeners();
        return removeEventListeners;
    }, [addEventListeners, removeEventListeners]);

    // Handle accordion item press (for mobile swipe detection)
    const handleAccordionInteraction = useCallback((itemId: string) => {
        setCurrentSwipeItem(itemId);
        // Reset current swipe item after a short delay
        setTimeout(() => setCurrentSwipeItem(null), 1000);
    }, []);

    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto mt-12 player-card rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Newspaper className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-display font-bold">Latest News</h2>
                    </div>
                    <ArchivedNewsModal archivedCount={archivedCount} onRefresh={refetch} />
                </div>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading news...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-2xl mx-auto mt-12 player-card rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Newspaper className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-display font-bold">Latest News</h2>
                    </div>
                    <ArchivedNewsModal archivedCount={archivedCount} onRefresh={refetch} />
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to load news. Please check your connection and try again.
                        <button
                            onClick={() => refetch()}
                            className="ml-2 underline hover:no-underline"
                        >
                            Retry
                        </button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (visibleNews.length === 0) {
        return (
            <div className="w-full max-w-2xl mx-auto mt-12 player-card rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Newspaper className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-display font-bold">Latest News</h2>
                    </div>
                    <ArchivedNewsModal archivedCount={archivedCount} onRefresh={refetch} />
                </div>
                <div className="text-center py-12 text-muted-foreground">
                    {news.length > 0 ? 'All news items have been archived.' : 'No news articles available at the moment.'}
                    {news.length > 0 && (
                        <p className="text-sm mt-2">
                            Check the archive to restore news items.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={elementRef as React.RefObject<HTMLDivElement>}
            className="w-full max-w-2xl mx-auto mt-12 player-card rounded-2xl p-8 relative overflow-hidden"
        >
            {/* Visual feedback for swipe gestures */}
            {isDragging && (
                <div className="absolute inset-0 pointer-events-none z-10">
                    <div
                        className={`absolute inset-y-0 w-32 flex items-center justify-center transition-opacity duration-200 ${
                            swipeDirection === 'left' ? 'left-0 opacity-100' : 'left-0 opacity-0'
                        }`}
                    >
                        <div className="bg-destructive/20 rounded-r-lg p-2 flex items-center gap-2">
                            <Archive className="h-5 w-5 text-destructive" />
                            <span className="text-sm font-medium text-destructive">Archive</span>
                        </div>
                    </div>
                    <div
                        className={`absolute inset-y-0 w-32 flex items-center justify-center transition-opacity duration-200 ${
                            swipeDirection === 'right' ? 'right-0 opacity-100' : 'right-0 opacity-0'
                        }`}
                    >
                        <div className="bg-green-500/20 rounded-l-lg p-2 flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-600">Refresh</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Newspaper className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-display font-bold">Latest News</h2>
                </div>
                <div className="flex items-center gap-2">
                    <ArchivedNewsModal archivedCount={archivedCount} onRefresh={refetch} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Swipe instructions */}
            <div className="mb-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                💡 <strong>Swipe gestures:</strong> Swipe left on any news item to archive it, or swipe right to refresh all news.
            </div>

            <Accordion type="single" collapsible className="w-full">
                {visibleNews.map((newsItem: NewsResponse) => (
                    <AccordionItem
                        key={newsItem.documentId}
                        value={newsItem.documentId}
                        className={`transition-all duration-200 ${
                            currentSwipeItem === newsItem.documentId && isDragging
                                ? swipeDirection === 'left'
                                    ? 'transform -translate-x-2 opacity-70'
                                    : 'transform translate-x-2 opacity-70'
                                : ''
                        }`}
                    >
                        <AccordionTrigger
                            className="text-left hover:text-primary transition-colors"
                            onMouseDown={() => handleAccordionInteraction(newsItem.documentId)}
                            onTouchStart={() => handleAccordionInteraction(newsItem.documentId)}
                        >
                            <div className="flex flex-col gap-1 pr-4">
                                <span className="font-semibold">{newsItem.title}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                        {new Date(newsItem.publishedAt).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </span>
                                    {newsItem.category && (
                                        <>
                                            <span>•</span>
                                            <span>{newsItem.category.name}</span>
                                        </>
                                    )}
                                    {newsItem.author && (
                                        <>
                                            <span>•</span>
                                            <span>{newsItem.author.name}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4">
                                {newsItem.featured_image && (
                                    <img
                                        src={`${import.meta.env.VITE_STRAPI_URL || 'http://localhost:1337'}${newsItem.featured_image.url}`}
                                        alt={newsItem.featured_image.alternativeText || newsItem.title}
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                )}
                                <div
                                    className="text-muted-foreground prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: newsItem.body }}
                                />
                                <div className="pt-2 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            newsStorage.archiveNews(newsItem, 'manual');
                                            setArchivedCount(newsStorage.getArchivedCount());
                                            refetch();
                                        }}
                                        className="gap-2 text-destructive hover:text-destructive"
                                    >
                                        <Archive className="h-4 w-4" />
                                        Archive this news
                                    </Button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};