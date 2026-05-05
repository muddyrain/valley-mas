import { ArrowUpToLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const SHOW_THRESHOLD = 220;
const MIN_SCROLLABLE_HEIGHT = 360;

function getScrollMeta() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const clientHeight = window.innerHeight || document.documentElement.clientHeight;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  return {
    showButton: maxScrollTop > MIN_SCROLLABLE_HEIGHT && scrollTop > SHOW_THRESHOLD,
  };
}

export function GlobalScrollButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frameId = 0;

    const updateScrollState = () => {
      const next = getScrollMeta();
      setVisible(next.showButton);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateScrollState);
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(document.documentElement);
    resizeObserver?.observe(document.body);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, []);

  const handleClick = useCallback(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="回到顶部"
      title="回到顶部"
      onClick={handleClick}
      className="fixed right-4 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-theme-soft-strong bg-white/92 text-theme-primary shadow-[0_14px_36px_rgba(148,163,184,0.24)] backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-theme-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/35 sm:right-6 sm:bottom-7"
    >
      <ArrowUpToLine className="h-5 w-5" />
    </button>
  );
}
