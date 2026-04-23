import { Instagram, Facebook, X, MessageCircle, Share2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { isSupabaseEnabled, subscribeToTable } from "@/lib/supabase";

interface SocialHandle {
    id: string;
    platform: string;
    url: string;
    enabled: boolean;
}

const PLATFORM_ICONS: Record<string, any> = {
    instagram: { icon: Instagram, color: "hover:bg-pink-500/20 hover:text-pink-500" },
    facebook: { icon: Facebook, color: "hover:bg-blue-600/20 hover:text-blue-600" },
    twitter: { icon: X, color: "hover:bg-gray-500/20 hover:text-gray-400" },
    x: { icon: X, color: "hover:bg-gray-500/20 hover:text-gray-400" },
    whatsapp: { icon: MessageCircle, color: "hover:bg-green-500/20 hover:text-green-500" },
    youtube: { icon: Share2, color: "hover:bg-red-600/20 hover:text-red-600" },
    other: { icon: Globe, color: "hover:bg-primary/20 hover:text-primary" }
};

export const Footer = () => {
    const [socials, setSocials] = useState<SocialHandle[]>([]);

    useEffect(() => {
        const fetchSocials = async () => {
            try {
                const response = await fetch('/api/socials');
                if (response.ok) {
                    const data = await response.json();
                    setSocials(data.filter((s: SocialHandle) => s.enabled && s.url));
                }
            } catch (error) {
                console.error("Error fetching socials for footer:", error);
            }
        };

        let unsubscribe: (() => Promise<void>) | undefined;

        fetchSocials();

        if (isSupabaseEnabled()) {
            subscribeToTable<any>('socials', () => {
                fetchSocials();
            }).then((cleanup) => {
                unsubscribe = cleanup;
            }).catch((error) => {
                console.warn('Supabase realtime social subscription failed:', error);
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return (
        <footer className="w-full py-6 px-4 border-t border-border/50">
            <div className="mx-auto">
                <div className="text-center mb-4">
                    <h3 className="text-sm font-semibold text-foreground/80">Connect With Us</h3>
                </div>
                <div className="flex justify-center items-center gap-4 flex-wrap">
                    {socials.length > 0 ? (
                        socials.map((social) => {
                            const platform = PLATFORM_ICONS[social.platform] || PLATFORM_ICONS.other;
                            const Icon = platform.icon;
                            return (
                                <Button
                                    key={social.id}
                                    variant="ghost"
                                    size="icon"
                                    className={`h-10 w-10 rounded-full transition-colors ${platform.color}`}
                                    onClick={() => window.open(social.url, "_blank")}
                                    title={social.platform.charAt(0).toUpperCase() + social.platform.slice(1)}
                                >
                                    <Icon className="h-5 w-5" />
                                </Button>
                            );
                        })
                    ) : (
                        // Fallback static icons if API fails or no data
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-pink-500/20 hover:text-pink-500 transition-colors"
                                onClick={() => window.open("https://instagram.com/freedomnaijaradio", "_blank")}
                                title="Instagram"
                            >
                                <Instagram className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-blue-600/20 hover:text-blue-600 transition-colors"
                                onClick={() => window.open("https://facebook.com/freedomradio", "_blank")}
                                title="Facebook"
                            >
                                <Facebook className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-gray-500/20 hover:text-gray-400 transition-colors"
                                onClick={() => window.open("https://x.com/Freedom_Naija", "_blank")}
                                title="X (Twitter)"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full hover:bg-green-500/20 hover:text-green-500 transition-colors"
                                onClick={() => window.open("https://wa.me/2347071240560", "_blank")}
                                title="WhatsApp"
                            >
                                <MessageCircle className="h-5 w-5" />
                            </Button>
                        </>
                    )}
                </div>
                <div className="text-center mt-4">
                    <p className="text-xs text-muted-foreground">© 2026 Freedom Naija Radio. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};