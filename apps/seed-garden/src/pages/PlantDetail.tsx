import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { fetchPlantDetail } from '@/api/plant';
import type { PlantDetailView } from '@/api/types';
import { GrowthTimeline } from '@/components/GrowthTimeline';
import { RarityBadge } from '@/components/RarityBadge';
import { rarityFrame } from '@/lib/rarityStyles';
import { formatCountdown } from '@/lib/stageTimer';
import { useAuthStore } from '@/stores/useAuthStore';

const STATUS_LABEL: Record<string, string> = {
  growing: '生长中',
  mature: '已成熟',
  harvested: '已收获',
};

export default function PlantDetail() {
  const { id } = useParams();
  const { token } = useAuthStore();
  const [view, setView] = useState<PlantDetailView | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !token) return;
    let alive = true;
    const load = () =>
      fetchPlantDetail(Number(id))
        .then((v) => {
          if (alive) {
            setView(v);
            setError(null);
          }
        })
        .catch((e: Error) => {
          if (alive) setError(e.message);
        });
    load();
    const poll = setInterval(load, 30_000);
    const ticker = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [id, token]);

  if (!token) return <Navigate to="/login" replace />;

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center text-garden-ink/70">
        <p>种子精灵在打盹...</p>
        <p className="text-xs mt-2">{error}</p>
        <Link to="/garden" className="text-sm text-garden-ink underline mt-4 inline-block">
          返回花园
        </Link>
      </main>
    );
  }
  if (!view) return <main className="p-8 text-center text-garden-ink/70">加载中...</main>;

  const p = view.plant;
  const src = `/assets/encyclopedia/${p.rarity}/${p.asset_key}_${p.stage}.png`;
  const isGrowing = p.status === 'growing';

  return (
    <main className="mx-auto max-w-xl p-4 flex flex-col gap-4">
      <Link to="/garden" className="text-sm text-garden-ink/70 hover:text-garden-ink">
        ← 返回花园
      </Link>
      <section className={clsx('rounded-3xl border-2 bg-white/50 p-4', rarityFrame[p.rarity])}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-garden-ink">{p.name}</h1>
          <RarityBadge rarity={p.rarity} />
        </div>
        <img src={src} alt={p.name} className="w-full max-w-sm mx-auto" loading="lazy" />
        <p className="text-sm text-garden-ink/70 mt-2">{p.description}</p>
        <p className="text-xs text-garden-ink/60 mt-2">
          阶段 {p.stage}/{p.stage_max} · 状态 {STATUS_LABEL[p.status] ?? p.status}
          {isGrowing && ` · 距下一阶段 ${formatCountdown(p.next_stage_at, tick)}`}
        </p>
      </section>
      <section>
        <h2 className="text-sm font-bold text-garden-ink/70 mb-2">成长日志</h2>
        <GrowthTimeline logs={view.logs} />
      </section>
    </main>
  );
}
