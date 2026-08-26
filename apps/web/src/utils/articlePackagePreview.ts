import { marked } from 'marked';
import type { ArticlePackageEntry } from '@/api/blog';

const sensitiveFileNames = new Set([
  '.npmrc',
  '.pypirc',
  '.netrc',
  '.git-credentials',
  'credentials',
  'credentials.json',
  'secrets.json',
  'secret.json',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
]);

const sensitiveExtensions = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);

export function isSensitivePackagePath(path: string) {
  const normalized = path.trim().toLowerCase().replace(/\\/g, '/');
  const parts = normalized.split('/');
  const base = parts[parts.length - 1] || '';
  const dot = base.lastIndexOf('.');
  const extension = dot >= 0 ? base.slice(dot) : '';
  return (
    base === '.env' ||
    base.startsWith('.env.') ||
    sensitiveFileNames.has(base) ||
    sensitiveExtensions.has(extension) ||
    normalized === '.aws/credentials' ||
    normalized === '.docker/config.json'
  );
}

function escapeRawHTML(source: string) {
  return source.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function resolvePackagePath(currentPath: string, reference: string) {
  const cleanReference = reference.split(/[?#]/, 1)[0]?.replace(/\\/g, '/') || '';
  if (
    !cleanReference ||
    cleanReference.startsWith('/') ||
    /^[a-z][a-z0-9+.-]*:/i.test(cleanReference)
  ) {
    return '';
  }
  const base = currentPath.split('/').slice(0, -1);
  for (const part of cleanReference.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (base.length === 0) return '';
      base.pop();
    } else {
      base.push(part);
    }
  }
  return base.join('/');
}

export function renderSafePackageMarkdown(
  source: string,
  currentPath: string,
  entries: ArticlePackageEntry[],
  imageURL: (path: string) => string,
) {
  const parsed = marked.parse(escapeRawHTML(source), {
    async: false,
  }) as string;
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  return parsed
    .replace(/\s(?:on[a-z]+|style)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\shref="([^"]*)"/gi, (_match, href: string) => {
      if (/^https:\/\//i.test(href)) return ` href="${href}" target="_blank" rel="noreferrer"`;
      const resolved = resolvePackagePath(currentPath, href);
      const entry = entryByPath.get(resolved);
      if (!entry || entry.previewKind === 'metadata') return '';
      return ` href="?file=${encodeURIComponent(resolved)}"`;
    })
    .replace(/\ssrc="([^"]*)"/gi, (_match, src: string) => {
      const resolved = resolvePackagePath(currentPath, src);
      const entry = entryByPath.get(resolved);
      if (!entry || entry.previewKind !== 'image') return '';
      return ` src="${imageURL(resolved)}"`;
    });
}
