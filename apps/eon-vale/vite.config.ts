import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5184,
    strictPort: true,
  },
  preview: {
    port: 4184,
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/')) return 'three';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          return undefined;
        },
      },
    },
  },
});
