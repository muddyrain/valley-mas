import { execSync } from 'node:child_process';
import path from 'node:path';
import { createDataInspectorVitePlugins } from '@valley/devbox-inspector-vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

function resolveWorkspaceRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: process.cwd(),
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

// https://vite.dev/config/
export default defineConfig(() => {
  const workspaceRoot = resolveWorkspaceRoot();

  return {
    plugins: [react(), ...createDataInspectorVitePlugins({ workspaceRoot })],
    assetsInclude: ['**/*.glb'],
    define: {
      'import.meta.env.VITE_INSPECTOR_WORKSPACE_ROOT': JSON.stringify(workspaceRoot),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
