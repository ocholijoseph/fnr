import React from 'react';

interface SegmentedSwitchProps {
    options: { label: string; value: string }[];
    activeValue: string;
    onChange: (value: string) => void;
}

const SegmentedSwitch: React.FC<SegmentedSwitchProps> = ({ options, activeValue, onChange }) => {
    const activeIndex = options.findIndex(opt => opt.value === activeValue);

    return (
        <div className="relative flex bg-secondary/30 backdrop-blur-sm p-1 rounded-full w-full max-w-md mx-auto border border-primary/10 shadow-sm">
            {/* Sliding background */}
            <div
                className="absolute top-1 bottom-1 left-1 bg-primary rounded-full shadow-md transition-all duration-300 ease-out"
                style={{
                    width: `calc(${100 / options.length}% - 4px)`,
                    transform: `translateX(${activeIndex * 100}%)`
                }}
            />

            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`relative z-10 flex-1 py-3 px-4 text-[13px] sm:text-sm font-bold rounded-full transition-colors duration-300 ${activeValue === option.value ? 'text-white' : 'text-muted-foreground hover:text-primary/70'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export default SegmentedSwitch;
