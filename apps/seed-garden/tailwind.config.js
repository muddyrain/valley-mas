/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        garden: {
          warm: '#FFE9B0',
          peach: '#FFD09A',
          ink: '#4A3A2C',
        },
      },
    },
  },
  plugins: [],
};
