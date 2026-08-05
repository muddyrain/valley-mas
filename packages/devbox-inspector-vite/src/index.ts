import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

type Plugin = Record<string, unknown>;

const localRequire = createRequire(import.meta.url);

export interface DataInspectorViteOptions {
  enabled?: boolean;
  workspaceRoot?: string;
  bundler?: 'webpack' | 'vite' | 'rspack';
  showSwitch?: boolean;
  dev?: boolean;
}

function resolveWorkspaceRoot(defaultRoot?: string): string {
  if (defaultRoot?.trim()) {
    return defaultRoot;
  }

  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

function shouldEnableInThisEnv(enabled?: boolean): boolean {
  if (typeof enabled === 'boolean') {
    return enabled;
  }

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isOnline = process.env.BUILD_ENV === 'ONLINE';
  const isRSDoc = process.env.RSDOCTOR === 'true';

  return isDevelopment && !isOnline && !isRSDoc;
}

export function createDataInspectorVitePlugins(options: DataInspectorViteOptions = {}): Plugin[] {
  if (!shouldEnableInThisEnv(options.enabled)) {
    return [];
  }

  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (!workspaceRoot) {
    // 开发构建机注入了根路径可便于映射，若未拿到则仍保持注入（保持 fallback 行为）
  }

  const pluginOptions: Record<string, unknown> = {
    bundler: options.bundler ?? 'vite',
    showSwitch: options.showSwitch ?? false,
    ...(isDevelopment
      ? {}
      : {
          dev: options.dev ?? true,
          hideConsole: true,
          skipSnippets: ['htmlScript'],
          injectTo: path.resolve(__dirname, '__code_inspector_no_client__'),
        }),
  };

  if (workspaceRoot) {
    pluginOptions.workspaceRoot = workspaceRoot;
  }

  try {
    const codeInspectorModule = localRequire('code-inspector-plugin') as {
      codeInspectorPlugin: (options: Record<string, unknown>) => Plugin;
    };
    const { codeInspectorPlugin } = codeInspectorModule;
    return [codeInspectorPlugin(pluginOptions)];
  } catch {
    return [];
  }
}
