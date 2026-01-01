import { Instagram, Facebook, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Footer = () => {
    return (
        <footer className="w-full py-6 px-4 border-t border-border/50">
            <div className="mx-auto">
                <div className="text-center mb-4">
                    <h3 className="text-sm font-semibold text-foreground/80">Connect With Us</h3>
                </div>
                <div className="flex justify-center items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full hover:bg-pink-500/20 hover:text-pink-500 transition-colors"
                        onClick={() => window.open("https://instagram.com/kingdomfmxtra", "_blank")}
                    >
                        <Instagram className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full hover:bg-blue-600/20 hover:text-blue-600 transition-colors"
                        onClick={() => window.open("https://facebook.com/kingdomfmxtra", "_blank")}
                    >
                        <Facebook className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full hover:bg-gray-500/20 hover:text-gray-400 transition-colors"
                        onClick={() => window.open("https://twitter.com/kingdomfmxtra", "_blank")}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full hover:bg-green-500/20 hover:text-green-500 transition-colors"
                        onClick={() => window.open("https://wa.me/2348000000000", "_blank")}
                    >
                        <MessageCircle className="h-5 w-5" />
                    </Button>
                </div>
                <div className="text-center mt-4">
                    <p className="text-xs text-muted-foreground">© 2025 Kingdom FM Xtra. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};