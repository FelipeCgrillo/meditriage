import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
        },
    },
    plugins: [],
};

export default config;
