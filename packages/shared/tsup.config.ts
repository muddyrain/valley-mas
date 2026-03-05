import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types/index.ts', 'src/utils/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  publicDir: 'src/assets', // 复制 assets 目录到 dist
});
