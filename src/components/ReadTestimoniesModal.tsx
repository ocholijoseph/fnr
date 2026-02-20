import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquareText } from "lucide-react";
import { format } from "date-fns";

interface Testimony {
    id: string;
    name: string;
    message: string;
    createdAt: string;
}

interface ReadTestimoniesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ReadTestimoniesModal = ({ isOpen, onClose }: ReadTestimoniesModalProps) => {
    const [testimonies, setTestimonies] = useState<Testimony[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTestimonies();
        }
    }, [isOpen]);

    const fetchTestimonies = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/testimonies");
            if (response.ok) {
                const data = await response.json();
                setTestimonies(data);
            }
        } catch (error) {
            console.error("Error fetching testimonies:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] h-[70vh] flex flex-col bg-card border-border overflow-hidden">
                <DialogHeader className="px-1">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquareText className="w-6 h-6 text-primary" />
                        Testimonies
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden mt-4">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse">Loading amazing stories...</p>
                        </div>
                    ) : testimonies.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                                <MessageSquareText className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-lg font-medium">No public testimonies yet.</p>
                            <p className="text-sm text-muted-foreground font-semibold text-primary">Be the first to share!</p>

                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-4 pb-6 px-1">
                                {testimonies.map((testimony, index) => (
                                    <div
                                        key={testimony.id || index}
                                        className="p-4 rounded-xl bg-secondary/20 border border-primary/5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
                                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-primary text-sm">{testimony.name}</h3>
                                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                                {format(new Date(testimony.createdAt), "MMM d, yyyy")}
                                            </span>
                                        </div>
                                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90 italic">
                                            "{testimony.message}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ReadTestimoniesModal;
