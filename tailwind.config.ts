import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                medical: {
                    primary: "#0066CC",
                    secondary: "#4A90E2",
                    accent: "#00A8E8",
                    danger: "#DC2626",
                    warning: "#F59E0B",
                    success: "#10B981",
                    neutral: "#6B7280",
                },
                esi: {
                    1: "#DC2626", // Critical - Red
                    2: "#F59E0B", // Emergency - Orange
                    3: "#FBBF24", // Urgent - Yellow
                    4: "#10B981", // Less Urgent - Green
                    5: "#3B82F6", // Non-Urgent - Blue
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            keyframes: {
                'slide-in-bottom': {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'scale-in': {
                    '0%': { transform: 'scale(0.9)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            animation: {
                'slide-in-bottom': 'slide-in-bottom 0.5s ease-out',
                'fade-in': 'fade-in 0.3s ease-out',
                'scale-in': 'scale-in 0.3s ease-out',
            },
        },
    },
    plugins: [],
};

export default config;
