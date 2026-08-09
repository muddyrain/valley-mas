import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    host: '127.0.0.1',
    port: 5179,
    strictPort: true,
  },
});
