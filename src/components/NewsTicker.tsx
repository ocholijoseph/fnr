import React from 'react';
import { Zap } from 'lucide-react';

interface NewsTickerProps {
    message: string;
    visible?: boolean;
}

const NewsTicker: React.FC<NewsTickerProps> = ({ message, visible = true }) => {
    if (!visible || !message) return null;

    // Duplicate message for seamless marquee
    const displayText = message.trim();
    
    // Calculate duration based on text length to keep speed consistent
    // Approx 150px per second. Text width ≈ length * 9px
    const duration = Math.max(20, (displayText.length * 10) / 50);

    return (
        <div className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 border-y border-orange-400/30 shadow-lg overflow-hidden relative h-10 flex items-center">
            {/* Pulsing Label */}
            <div className="absolute left-0 top-0 bottom-0 z-20 bg-orange-600 px-4 flex items-center gap-2 shadow-[5px_0_15px_-5px_rgba(0,0,0,0.3)] border-r border-orange-400/30">
                <Zap className="w-4 h-4 text-white animate-pulse" />
                <span className="text-white text-xs font-black tracking-tighter uppercase">Live</span>
            </div>

            {/* Scrolling Content */}
            <div className="relative overflow-hidden w-full h-full flex items-center">
                <div 
                    className="whitespace-nowrap animate-marquee-seamless flex items-center"
                    style={{ animationDuration: `${duration}s` }}
                >
                    <span className="text-white text-sm font-bold px-12 tracking-wide drop-shadow-sm">
                        {displayText}
                    </span>
                    <span className="text-white text-sm font-bold px-12 tracking-wide drop-shadow-sm">
                        {displayText}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default NewsTicker;
