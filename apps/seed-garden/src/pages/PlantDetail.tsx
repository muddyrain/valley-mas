import axios from 'axios';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { chatPlant, waterPlant } from '@/api/interaction';
import { fetchPlantDetail, harvestPlant } from '@/api/plant';
import type { Harvest, PlantDetailView } from '@/api/types';
import { GrowthTimeline } from '@/components/GrowthTimeline';
import { RarityBadge } from '@/components/RarityBadge';
import { ShareCardExport } from '@/components/ShareCardExport';
import { plantFallbackDataUrl } from '@/lib/plantFallback';
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
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [view, setView] = useState<PlantDetailView | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [watering, setWatering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef<() => void>(() => {});
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [lastChat, setLastChat] = useState<{ user: string; reply: string } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [harvest, setHarvest] = useState<Harvest | null>(null);
  const [harvestError, setHarvestError] = useState<string | null>(null);

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
    reloadRef.current = load;
    load();
    const poll = setInterval(load, 30_000);
    const ticker = setInterval(() => setTick(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [id, token]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const handleWater = async () => {
    if (!id || watering) return;
    setWatering(true);
    try {
      const res = await waterPlant(Number(id));
      showToast(res.reply);
      reloadRef.current();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 429) {
        showToast('今天浇得有点多了，植物想休息一下');
      } else {
        const msg = e instanceof Error ? e.message : '浇水失败，请稍后再试';
        showToast(msg);
      }
    } finally {
      setWatering(false);
    }
  };

  const handleChat = async () => {
    if (!id || chatting) return;
    const msg = chatInput.trim();
    if (!msg) {
      setChatError('说点什么再发吧');
      return;
    }
    setChatting(true);
    setChatError(null);
    try {
      const res = await chatPlant(Number(id), msg);
      setLastChat({ user: msg, reply: res.reply });
      setChatInput('');
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 429) {
        setChatError('今天聊得有点多了，明天再来');
      } else {
        const errMsg = e instanceof Error ? e.message : '聊天失败，请稍后再试';
        setChatError(errMsg);
      }
    } finally {
      setChatting(false);
    }
  };

  const handleHarvest = async () => {
    if (!id || harvesting) return;
    if (!window.confirm('收获后这棵植物会离开花园，确定吗？')) return;
    setHarvesting(true);
    setHarvestError(null);
    try {
      const res = await harvestPlant(Number(id));
      setHarvest(res);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '收获失败，请稍后再试';
      setHarvestError(errMsg);
    } finally {
      setHarvesting(false);
    }
  };

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
  const fallback = plantFallbackDataUrl(p.rarity);
  const isGrowing = p.status === 'growing';
  const isMature = p.status === 'mature';

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
        <img
          src={src}
          alt={p.name}
          className="w-full max-w-sm mx-auto"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== fallback) img.src = fallback;
          }}
        />
        <p className="text-sm text-garden-ink/70 mt-2">{p.description}</p>
        <p className="text-xs text-garden-ink/60 mt-2">
          阶段 {p.stage}/{p.stage_max} · 状态 {STATUS_LABEL[p.status] ?? p.status}
          {isGrowing && ` · 距下一阶段 ${formatCountdown(p.next_stage_at, tick)}`}
        </p>
      </section>
      {isGrowing && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleWater}
            disabled={watering}
            className={clsx(
              'rounded-full px-6 py-2 text-sm font-bold text-white shadow transition',
              watering ? 'bg-garden-ink/40' : 'bg-garden-ink hover:bg-garden-ink/90',
            )}
          >
            {watering ? '浇水中...' : '浇水'}
          </button>
          <div
            className={clsx(
              'min-h-[1.5rem] text-center text-sm text-garden-ink/80 transition-opacity duration-500',
              toast ? 'opacity-100' : 'opacity-0',
            )}
            aria-live="polite"
          >
            {toast}
          </div>
        </div>
      )}
      {isMature && !harvest && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleHarvest}
            disabled={harvesting}
            className={clsx(
              'rounded-full px-6 py-2 text-sm font-bold text-white shadow transition',
              harvesting ? 'bg-amber-700/40' : 'bg-amber-700 hover:bg-amber-700/90',
            )}
          >
            {harvesting ? '收获中...' : '收获'}
          </button>
          {harvestError && (
            <p className="text-xs text-red-500" aria-live="polite">
              {harvestError}
            </p>
          )}
        </div>
      )}
      {isMature && !harvest && (
        <section className="flex flex-col gap-2 rounded-3xl border border-garden-ink/10 bg-white/60 p-4">
          <h2 className="text-sm font-bold text-garden-ink/70">跟它聊聊</h2>
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="说点什么..."
            disabled={chatting}
            className="w-full resize-none rounded-2xl border border-garden-ink/15 bg-white/80 p-3 text-sm text-garden-ink outline-none focus:border-garden-ink/40 disabled:opacity-60"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-garden-ink/50">{chatInput.length}/200</span>
            <button
              type="button"
              onClick={handleChat}
              disabled={chatting}
              className={clsx(
                'rounded-full px-5 py-1.5 text-sm font-bold text-white shadow transition',
                chatting ? 'bg-garden-ink/40' : 'bg-garden-ink hover:bg-garden-ink/90',
              )}
            >
              {chatting ? '发送中...' : '跟它聊聊'}
            </button>
          </div>
          {chatError && (
            <p className="text-xs text-red-500" aria-live="polite">
              {chatError}
            </p>
          )}
          {lastChat && (
            <div className="flex flex-col gap-1 rounded-2xl bg-garden-ink/5 p-3 text-sm text-garden-ink/80">
              <p>
                <span className="font-bold text-garden-ink/70">我说：</span>
                {lastChat.user}
              </p>
              <p>
                <span className="font-bold text-garden-ink/70">它说：</span>
                {lastChat.reply}
              </p>
            </div>
          )}
        </section>
      )}
      {harvest && (
        <section className="flex flex-col gap-3 rounded-3xl border-2 border-amber-700/40 bg-amber-50/80 p-4">
          <h2 className="text-base font-bold text-amber-900">收获完成</h2>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-garden-ink">{harvest.fruit_name}</p>
            <p className="text-sm text-garden-ink/80">{harvest.fruit_description}</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3 text-sm text-garden-ink/80">
            <p className="font-bold text-garden-ink/70 mb-1">告别信</p>
            <p className="whitespace-pre-wrap">{harvest.farewell_letter}</p>
          </div>
          <div className="flex flex-col items-center gap-2 pt-2">
            <ShareCardExport plant={view.plant} harvest={harvest} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/garden')}
            className="self-center rounded-full bg-garden-ink px-6 py-2 text-sm font-bold text-white shadow hover:bg-garden-ink/90"
          >
            返回花园
          </button>
        </section>
      )}
      <section>
        <h2 className="text-sm font-bold text-garden-ink/70 mb-2">成长日志</h2>
        <GrowthTimeline logs={view.logs} />
      </section>
    </main>
  );
}
