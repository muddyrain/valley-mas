import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { type EncyclopediaItem, fetchEncyclopedia } from '@/api/encyclopedia';
import { EncyclopediaCard } from '@/components/EncyclopediaCard';
import { useAuthStore } from '@/stores/useAuthStore';

type LoadState = 'loading' | 'ready' | 'error';

export default function Encyclopedia() {
  const { token } = useAuthStore();
  const [items, setItems] = useState<EncyclopediaItem[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setState('loading');
    fetchEncyclopedia()
      .then((list) => {
        if (!alive) return;
        setItems(list ?? []);
        setState('ready');
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setState('error');
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <main className="mx-auto max-w-3xl p-4 flex flex-col gap-4">
      <Link to="/garden" className="text-sm text-garden-ink/70 hover:text-garden-ink">
        ← 返回花园
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-garden-ink">图鉴</h1>
        {state === 'ready' && items.length > 0 && (
          <p className="text-xs text-garden-ink/60">
            No.001 - No.{String(items.length).padStart(3, '0')} 共 {items.length} 件
          </p>
        )}
      </header>
      {state === 'loading' && (
        <div className="rounded-2xl bg-white/50 p-6 text-center text-sm text-garden-ink/60">
          加载中...
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-2xl bg-white/50 p-6 text-center text-sm text-garden-ink/70">
          <p>种子精灵在打盹...</p>
          {error && <p className="mt-2 text-xs text-garden-ink/50">{error}</p>}
        </div>
      )}
      {state === 'ready' && items.length === 0 && (
        <div className="rounded-2xl bg-white/50 p-8 text-center text-sm text-garden-ink/70">
          <p>图鉴还是空的，先去花园种一棵植物吧。</p>
          <Link
            to="/garden"
            className="mt-3 inline-block rounded-full bg-garden-ink px-5 py-1.5 text-sm font-bold text-white shadow hover:bg-garden-ink/90"
          >
            返回花园
          </Link>
        </div>
      )}
      {state === 'ready' && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <EncyclopediaCard key={item.plant.id} item={item} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}
