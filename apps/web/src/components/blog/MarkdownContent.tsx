import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import './markdown-styles.css';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const codeBlocks = contentRef.current.querySelectorAll('pre');
      codeBlocks.forEach((pre) => {
        if (pre.querySelector('.copy-button')) return;

        const code = pre.querySelector('code');
        if (!code) return;

        const button = document.createElement('button');
        button.className =
          'copy-button absolute top-3 right-3 px-3 py-1.5 text-xs rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100';
        button.textContent = '复制';
        button.onclick = () => {
          navigator.clipboard.writeText(code.textContent || '');
          button.textContent = '已复制!';
          setTimeout(() => {
            button.textContent = '复制';
          }, 2000);
        };

        pre.classList.add('group', 'relative');
        pre.appendChild(button);
      });
    }
  }, [content]);

  return (
    <div
      ref={contentRef}
      className={cn('markdown-body', className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
