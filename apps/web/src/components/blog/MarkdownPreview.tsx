import { useMemo } from 'react';
import { renderMarkdownWithAnchors } from '@/utils/blog';
import { MarkdownContent } from './MarkdownContent';

interface MarkdownPreviewProps {
  markdown: string;
  className?: string;
}

export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  const html = useMemo(() => renderMarkdownWithAnchors(markdown), [markdown]);
  return <MarkdownContent content={html} className={className} />;
}
