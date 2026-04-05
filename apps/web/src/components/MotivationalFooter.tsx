import { Quote, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type MotivationalItem = {
  content: string;
  source: string;
};

function formatPoemSource(author: string, origin: string) {
  return `${author}《${origin}》`;
}

export function MotivationalFooter() {
  const [poemRefreshing, setPoemRefreshing] = useState(false);
  const [motivation, setMotivation] = useState<MotivationalItem | null>(null);

  const loadMotivation = useCallback(async () => {
    setPoemRefreshing(true);
    try {
      const res = await fetch('https://v1.jinrishici.com/all.json');
      if (!res.ok) throw new Error('fetch poem failed');
      const data = (await res.json()) as {
        content: string;
        origin: string;
        author: string;
        category: string;
      };
      if (!data?.content) throw new Error('empty poem');
      setMotivation({
        content: data.content,
        source: formatPoemSource(data.author || '', data.origin),
      });
    } catch {
    } finally {
      setPoemRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMotivation();
  }, [loadMotivation]);

  if (!motivation) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div
        className="pointer-events-auto flex min-h-14 w-[min(860px,calc(100vw-24px))] items-center gap-2.5 overflow-hidden rounded-full border border-white/30 px-4.5 py-2.5 text-white backdrop-blur-[10px] animate-[poem-glow_4.8s_ease-in-out_infinite]"
        style={{
          background: `linear-gradient(90deg, rgba(var(--theme-primary-rgb),0.55), rgba(var(--theme-primary-rgb),0.35))`,
          boxShadow: `0 20px 42px rgba(var(--theme-primary-rgb),0.28)`,
        }}
      >
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
        <div className="min-w-0">
          <p className="overflow-hidden text-ellipsis whitespace-nowrap tracking-[0.04em] text-sm transition-colors duration-300 animate-[poem-breathe_3.8s_ease-in-out_infinite] md:text-base">
            {motivation.content}
          </p>
          <p className="mt-0.5 text-xs tracking-[0.03em] text-white/80">{motivation.source}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMotivation()}
          className="ml-auto inline-flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border border-white/24 bg-white/14 text-white/90 transition-[transform,background,color] duration-200 hover:rotate-[-18deg] hover:scale-[1.06] hover:bg-white/24 hover:text-white"
          aria-label="刷新鼓励诗句"
          title="刷新鼓励诗句"
        >
          <RefreshCw className={`h-4 w-4 ${poemRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
