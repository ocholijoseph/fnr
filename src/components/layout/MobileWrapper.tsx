import React, { useEffect, useState } from 'react';

interface MobileWrapperProps {
    children: React.ReactNode;
}

const MobileWrapper: React.FC<MobileWrapperProps> = ({ children }) => {
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            // Base dimensions
            const baseWidth = 412;
            const baseHeight = 915;
            const aspectRatio = baseWidth / baseHeight;

            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const windowRatio = windowWidth / windowHeight;

            let newScale = 1;

            // If window is wider than our aspect ratio (landscape or wide portrait)
            if (windowRatio > aspectRatio) {
                // Fit to height
                newScale = windowHeight / baseHeight;
            } else {
                // Fit to width
                newScale = windowWidth / baseWidth;
            }

            setScale(newScale);
        };

        // Initial calculation
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden"
            style={{
                backgroundColor: '#000000', // Ensure pure black background for pillarboxes
            }}
        >
            <div
                className="relative overflow-hidden shadow-2xl origin-center"
                style={{
                    width: '412px',
                    height: '915px',
                    transform: `scale(${scale})`,
                    flexShrink: 0, // Prevent flex compression
                    backgroundColor: '#0f0f0f', // Match app background darker/neutral
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default MobileWrapper;
