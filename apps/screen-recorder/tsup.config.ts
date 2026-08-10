import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'electron/main.ts',
    preload: 'electron/preload.ts',
  },
  format: ['cjs'],
  outDir: 'dist-electron',
  outExtension: () => ({ js: '.cjs' }),
  platform: 'node',
  target: 'node22',
  external: ['electron'],
  clean: true,
  sourcemap: true,
});
