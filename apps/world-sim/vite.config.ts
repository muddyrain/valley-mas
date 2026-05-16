import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 5177,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/vitest.setup.ts'],
  },
});
