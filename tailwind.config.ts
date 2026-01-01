import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
    darkMode: ["class"],
    content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                "live-glow": "hsl(var(--live-glow))",
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Montserrat', 'Inter', 'sans-serif'],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: {
                        height: "0",
                        opacity: "0",
                    },
                    to: {
                        height: "var(--radix-accordion-content-height)",
                        opacity: "1",
                    },
                },
                "accordion-up": {
                    from: {
                        height: "var(--radix-accordion-content-height)",
                        opacity: "1",
                    },
                    to: {
                        height: "0",
                        opacity: "0",
                    },
                },
                "pulse-glow": {
                    "0%, 100%": {
                        opacity: "1",
                        boxShadow: "0 0 20px hsl(var(--live-glow) / 0.8)",
                    },
                    "50%": {
                        opacity: "0.7",
                        boxShadow: "0 0 40px hsl(var(--live-glow) / 1)",
                    },
                },
                "marquee": {
                    "0%": { transform: "translateX(100%)" },
                    "100%": { transform: "translateX(-100%)" },
                },
                "radio-wave": {
                    "0%, 100%": {
                        transform: "scale(1)",
                        opacity: "0.6",
                    },
                    "50%": {
                        transform: "scale(1.2)",
                        opacity: "0.3",
                    },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.3s ease-out",
                "accordion-up": "accordion-up 0.3s ease-out",
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "marquee": "marquee 15s linear infinite",
                "radio-wave": "radio-wave 3s ease-in-out infinite",
            },
        },
    },
    plugins: [animate],
} satisfies Config;
