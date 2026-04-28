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

function getImportedFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

export function parseMarkdownImport(fileName: string, rawText: string) {
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fileTitle = getImportedFileTitle(fileName);
  const body = normalized;
  let frontMatterTitle = '';

  const frontMatterMatch = body.match(/^---\n([\s\S]*?)\n---\n*/);
  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1];
    const titleMatch = frontMatter.match(/^\s*title\s*:\s*(.+)\s*$/im);
    if (titleMatch) {
      frontMatterTitle = normalizeImportedTitle(titleMatch[1]);
    }
  }

  const headingMatch = body.match(/^(?:\s*\n)*#\s+(.+?)\s*(?:\n|$)/);
  const headingTitle = headingMatch ? normalizeImportedTitle(headingMatch[1]) : '';

  return {
    title: fileTitle || frontMatterTitle || headingTitle || '未命名博客',
    content: body,
  };
}
