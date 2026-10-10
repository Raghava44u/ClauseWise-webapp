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
        obsidian: {
          950: '#070a13',
          900: '#0b1222',
          850: '#101930',
          800: '#16223e',
          700: '#233358',
          600: '#344977',
        },
        navy: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc7fb',
          400: '#38a9f6',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        gold: {
          400: '#facc15',
          500: '#eab308',
        }
      },
      animation: {
        'scan-laser': 'scanLaser 2.2s ease-in-out infinite alternate',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        scanLaser: {
          '0%': { transform: 'translateY(0%)', opacity: '0.8' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0.8' },
        },
        pulseGlow: {
          '0%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
};
export default config;
