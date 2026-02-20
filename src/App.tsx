import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import Embed from "./pages/Embed";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
    // Lock screen orientation to portrait on mobile devices
    useEffect(() => {
        const lockOrientation = async () => {
            try {
                // Primary lock attempt using Screen Orientation API
                if (screen.orientation && 'lock' in screen.orientation) {
                    await (screen.orientation as any).lock('portrait');
                    console.log('Screen orientation locked to portrait');
                }
            } catch (error) {
                console.log('Orientation lock not available or failed:', error);
            }
        };

        lockOrientation();

        // Re-lock on visibility change (re-entering app)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                lockOrientation();
            }
        };

        // Re-lock on orientation change if supported
        const handleOrientationChange = () => {
            lockOrientation();
        };

        window.addEventListener('orientationchange', handleOrientationChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('orientationchange', handleOrientationChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/embed" element={<Embed />} />
                        <Route path="/admin" element={<Admin />} />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </BrowserRouter>
            </TooltipProvider>
        </QueryClientProvider>
    );
};

export default App;