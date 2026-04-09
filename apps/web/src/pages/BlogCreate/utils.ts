import { createPlainTextExcerpt } from '@/utils/blog';

function normalizeImportedTitle(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createAutoExcerpt(excerpt: string, content: string) {
  const trimmedExcerpt = excerpt.trim();
  if (trimmedExcerpt) return trimmedExcerpt;
  return createPlainTextExcerpt(content.trim(), 180);
}

export function base64ToImageFile(base64: string, mimeType: string, fileName: string) {
  const normalized = base64.includes(',') ? (base64.split(',').pop() ?? '') : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export function parseMarkdownImport(fileName: string, rawText: string) {
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let body = normalized.trim();
  let frontMatterTitle = '';

  const frontMatterMatch = body.match(/^---\n([\s\S]*?)\n---\n*/);
  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1];
    body = body.slice(frontMatterMatch[0].length).trim();
    const titleMatch = frontMatter.match(/^\s*title\s*:\s*(.+)\s*$/im);
    if (titleMatch) {
      frontMatterTitle = normalizeImportedTitle(titleMatch[1]);
    }
  }

  const headingMatch = body.match(/^(?:\s*\n)*#\s+(.+?)\s*(?:\n|$)/);
  const headingTitle = headingMatch ? normalizeImportedTitle(headingMatch[1]) : '';
  const fileTitle = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const parsedTitle = frontMatterTitle || headingTitle || fileTitle || '未命名博客';

  if (!frontMatterTitle && headingMatch) {
    body = body.slice(headingMatch[0].length).trim();
  }

  return {
    title: parsedTitle,
    content: body,
  };
}

export function waitNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
