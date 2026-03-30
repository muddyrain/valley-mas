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
      <div className="poem-footer poem-footer-floating pointer-events-auto">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
        <div className="min-w-0">
          <p className="poem-text text-sm md:text-base">{motivation.content}</p>
          <p className="poem-source">{motivation.source}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadMotivation()}
          className="poem-refresh-btn ml-auto shrink-0"
          aria-label="刷新鼓励诗句"
          title="刷新鼓励诗句"
        >
          <RefreshCw className={`h-4 w-4 ${poemRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
