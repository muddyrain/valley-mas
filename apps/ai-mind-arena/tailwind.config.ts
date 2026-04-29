import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arena: {
          ink: '#16062d',
          purple: '#5a22a5',
          violet: '#7d3cff',
          pink: '#e23b91',
          cyan: '#51d8ff',
          yellow: '#ffd21f',
          cream: '#fff7ef',
        },
      },
      boxShadow: {
        sticker: '0 12px 0 rgba(28, 9, 66, 0.35)',
        glow: '0 0 36px rgba(255, 210, 31, 0.34)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Arial', 'sans-serif'],
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.94)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
      },
      animation: {
        floaty: 'floaty 4.5s ease-in-out infinite',
        popIn: 'popIn 420ms cubic-bezier(.2,.9,.3,1.2) both',
        shine: 'shine 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
