import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version?: string;
};

function getBuildId() {
  const envCommit =
    process.env.VITE_APP_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.GIT_COMMIT_SHA;

  if (envCommit) {
    return envCommit.trim().slice(0, 7);
  }

  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

const appVersion = process.env.VITE_APP_VERSION || packageJson.version || '0.0.0';
const appBuildId = getBuildId();

function lifeTraceBuildMetadataPlugin() {
  return {
    name: 'life-trace-build-metadata',
    apply: 'build' as const,
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (!existsSync(swPath)) {
        return;
      }

      const content = readFileSync(swPath, 'utf8')
        .replaceAll('__LIFE_TRACE_APP_VERSION__', appVersion)
        .replaceAll('__LIFE_TRACE_BUILD_ID__', appBuildId);
      writeFileSync(swPath, content);
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(appBuildId),
  },
  plugins: [react(), lifeTraceBuildMetadataPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5178,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4178,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
