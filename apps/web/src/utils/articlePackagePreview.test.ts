import { describe, expect, it } from 'vitest';
import {
  isSensitivePackagePath,
  renderSafePackageMarkdown,
  resolvePackagePath,
} from './articlePackagePreview';

const entries = [
  { path: 'demo/README.md', previewKind: 'markdown' as const, size: 10 },
  { path: 'demo/guide.md', previewKind: 'markdown' as const, size: 10 },
  { path: 'demo/assets/cover.png', previewKind: 'image' as const, size: 10 },
];

describe('文章配套包 Markdown 安全渲染', () => {
  it('不会执行原始 HTML 或 javascript 链接', () => {
    const html = renderSafePackageMarkdown(
      '<img src=x onerror=alert(1)>\n\n[危险](javascript:alert(1))',
      'demo/README.md',
      entries,
      (path) => `/preview?path=${path}`,
    );
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('只解析包内可预览的相对链接和图片', () => {
    const html = renderSafePackageMarkdown(
      '[指南](guide.md) ![封面](assets/cover.png) ![越界](../../secret.png)',
      'demo/README.md',
      entries,
      (path) => `/preview?path=${encodeURIComponent(path)}`,
    );
    expect(html).toContain('?file=demo%2Fguide.md');
    expect(html).toContain('/preview?path=demo%2Fassets%2Fcover.png');
    expect(html).not.toContain('secret.png"');
  });

  it('拒绝越出配套包根的路径', () => {
    expect(resolvePackagePath('README.md', '../secret.txt')).toBe('');
  });

  it('识别不应在线展示的配置与密钥文件', () => {
    expect(isSensitivePackagePath('.env')).toBe(true);
    expect(isSensitivePackagePath('config/.env.production')).toBe(true);
    expect(isSensitivePackagePath('keys/id_ed25519')).toBe(true);
    expect(isSensitivePackagePath('keys/server.pem')).toBe(true);
    expect(isSensitivePackagePath('src/index.ts')).toBe(false);
  });
});
