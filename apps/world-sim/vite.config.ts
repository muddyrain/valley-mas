import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5179,
  },
  preview: {
    port: 4179,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
});
