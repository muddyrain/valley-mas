import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.fbx', '**/*.gltf'],
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    port: 5175,
  },
});
