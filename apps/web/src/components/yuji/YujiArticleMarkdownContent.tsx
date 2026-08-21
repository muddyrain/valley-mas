import { useCallback, useMemo } from 'react';

interface YujiArticleMarkdownContentProps {
  html: string;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy command was rejected');
}

function withCopyControls(html: string) {
  return html.replace(
    /<pre class="markdown-code-block">/g,
    '<pre class="markdown-code-block yuji-code-block"><button type="button" class="yuji-code-copy" aria-label="复制代码">复制</button>',
  );
}

export default function YujiArticleMarkdownContent({ html }: YujiArticleMarkdownContentProps) {
  const enhancedHtml = useMemo(() => withCopyControls(html), [html]);

  const handleCodeCopy = useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('.yuji-code-copy');
    if (!button) return;

    const code = button.parentElement?.querySelector('code');
    if (!code) return;
    const codeLines = Array.from(code.querySelectorAll<HTMLElement>('.markdown-code-content'));
    const codeText = codeLines.length
      ? codeLines.map((line) => line.textContent || '').join('\n')
      : code.textContent || '';

    try {
      await copyText(codeText);
      button.textContent = '已复制';
    } catch {
      button.textContent = '复制失败';
    }

    window.setTimeout(() => {
      button.textContent = '复制';
    }, 1800);
  }, []);

  return (
    <div
      className="yuji-article-body"
      onClick={(event) => void handleCodeCopy(event)}
      dangerouslySetInnerHTML={{ __html: enhancedHtml }}
    />
  );
}
