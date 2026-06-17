import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';
import type { Harvest, Plant } from '@/api/types';
import { plantFallbackBg, plantFallbackEmoji } from '@/lib/plantFallback';
import { rarityFrame } from '@/lib/rarityStyles';
import { RarityBadge } from './RarityBadge';

interface ShareCardExportProps {
  plant: Plant;
  harvest: Harvest;
}

const FAREWELL_LIMIT = 80;

function truncate(text: string, limit: number): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}…`;
}

export function ShareCardExport({ plant, harvest }: ShareCardExportProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const src = `/assets/encyclopedia/${plant.rarity}/${plant.asset_key}_${plant.stage_max}.png`;
  const bg = plantFallbackBg(plant.rarity);
  const emoji = plantFallbackEmoji(plant.rarity);
  const farewell = truncate(harvest.farewell_letter, FAREWELL_LIMIT);

  const handleExport = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    setErrMsg(null);
    try {
      const img = imgRef.current;
      if (img && !imgFailed) {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          });
        }
        if (img.decode) {
          try {
            await img.decode();
          } catch {
            // decode 失败也不阻塞，由 onError 切换到 fallback DOM
          }
        }
      }
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#fffbeb',
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `语种园-${harvest.fruit_name || plant.name}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '导出失败，请稍后再试';
      setErrMsg(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={cardRef}
        className={`flex w-[360px] flex-col gap-3 rounded-3xl border-2 bg-amber-50 p-5 ${rarityFrame[plant.rarity]}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-amber-800/80">语种园</span>
          <RarityBadge rarity={plant.rarity} />
        </div>
        <div
          className="aspect-square w-full rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: bg }}
        >
          {imgFailed ? (
            <span className="text-[120px] leading-none select-none">{emoji}</span>
          ) : (
            <img
              ref={imgRef}
              src={src}
              alt={harvest.fruit_name}
              className="max-h-full max-w-full rounded-2xl object-contain"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-garden-ink">{harvest.fruit_name}</p>
          <p className="text-xs text-garden-ink/70">{harvest.fruit_description}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 text-xs text-garden-ink/80">
          <p className="mb-1 font-bold text-garden-ink/60">告别信</p>
          <p className="whitespace-pre-wrap leading-relaxed">{farewell}</p>
        </div>
        <div className="flex items-center justify-between text-[10px] text-garden-ink/50">
          <span>{plant.name}</span>
          <span>来自语种园</span>
        </div>
      </div>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className={`rounded-full px-5 py-2 text-sm font-bold text-white shadow transition ${
          exporting ? 'bg-amber-700/40' : 'bg-amber-700 hover:bg-amber-700/90'
        }`}
      >
        {exporting ? '生成中...' : '导出分享图'}
      </button>
      {errMsg && (
        <p className="text-xs text-red-500" aria-live="polite">
          {errMsg}
        </p>
      )}
    </div>
  );
}
