import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Embed from "./pages/Embed";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
    // Lock screen orientation to portrait on mobile devices
    useEffect(() => {
        const lockOrientation = async () => {
            try {
                // Check if Screen Orientation API is supported
                if (screen.orientation && 'lock' in screen.orientation) {
                    await (screen.orientation as any).lock('portrait');
                    console.log('Screen orientation locked to portrait');
                }
            } catch (error) {
                // Orientation lock may fail if not in fullscreen or PWA mode
                console.log('Orientation lock not available or failed:', error);
            }
        };

        lockOrientation();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <div className="w-[412px] h-[915px] overflow-hidden mx-auto">
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/embed" element={<Embed />} />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </BrowserRouter>
                </div>
            </TooltipProvider>
        </QueryClientProvider>
    );
};

export default App;
