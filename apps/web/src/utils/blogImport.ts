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

export function createAutoExcerpt(excerpt: string, content: string) {
  const trimmedExcerpt = excerpt.trim();
  if (trimmedExcerpt) return trimmedExcerpt;
  return createPlainTextExcerpt(content.trim(), 180);
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
