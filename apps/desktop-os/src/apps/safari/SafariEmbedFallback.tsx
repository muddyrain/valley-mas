import { useEffect, useRef, useState } from 'react';
import { useBrowserStore } from '../../store/browserStore';
import EmptyState from '../../ui/EmptyState';
import { PlushButton } from '../../ui/PlushPrimitives';
import './SafariWindow.css';

interface SafariEmbedFallbackProps {
  url: string;
  title: string | null;
  onRetry: () => void;
}

const COPY_HINT_MS = 3000;

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to execCommand
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function SafariEmbedFallback({ url, title, onRetry }: SafariEmbedFallbackProps) {
  const addBookmark = useBrowserStore((s) => s.addBookmark);
  const isBookmarked = useBrowserStore((s) => s.bookmarks.some((b) => b.url === url));

  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  const handleOpenNew = () => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (!ok) return;
    setCopied(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, COPY_HINT_MS);
  };

  const handleBookmark = () => {
    if (isBookmarked) return;
    addBookmark(url, title);
  };

  return (
    <EmptyState
      className="safari-browser__fallback"
      tone="danger"
      icon="!"
      title="网站可能拒绝在 Safari 内嵌入显示"
      description="大多数大型站点出于安全考虑设置了 X-Frame-Options 或 CSP frame-ancestors,Safari 内无法直接展示。"
      action={
        <div className="safari-fallback__actions">
          <PlushButton tone="primary" onClick={handleOpenNew}>
            新窗口打开
          </PlushButton>
          <PlushButton tone="neutral" onClick={onRetry}>
            重试
          </PlushButton>
          <PlushButton tone="neutral" onClick={handleCopy}>
            {copied ? '已复制' : '复制链接'}
          </PlushButton>
          <PlushButton
            tone="accent"
            onClick={handleBookmark}
            disabled={isBookmarked}
            data-bookmarked={isBookmarked ? 'true' : undefined}
          >
            {isBookmarked ? '已收藏' : '加入收藏'}
          </PlushButton>
        </div>
      }
    />
  );
}
