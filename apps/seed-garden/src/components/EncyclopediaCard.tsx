import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { EncyclopediaItem } from '@/api/encyclopedia';
import { plantFallbackDataUrl } from '@/lib/plantFallback';
import { rarityFrame } from '@/lib/rarityStyles';
import { RarityBadge } from './RarityBadge';

function formatHarvestedAt(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function EncyclopediaCard({ item, index }: { item: EncyclopediaItem; index: number }) {
  const { plant, harvest } = item;
  const src = `/assets/encyclopedia/${plant.rarity}/${plant.asset_key}_${plant.stage_max}.png`;
  const fallback = plantFallbackDataUrl(plant.rarity);
  const harvestedAt = formatHarvestedAt(plant.harvested_at);
  const no = `No. ${String(index + 1).padStart(3, '0')}`;

  return (
    <Link
      to={`/garden/plant/${plant.id}`}
      className={clsx(
        'flex flex-col rounded-3xl border-2 bg-white/50 p-3 transition hover:-translate-y-0.5 hover:bg-white/70',
        rarityFrame[plant.rarity],
      )}
    >
      <div className="flex items-center justify-between text-xs text-garden-ink/60">
        <span className="font-mono tracking-wider">{no}</span>
        <RarityBadge rarity={plant.rarity} />
      </div>
      <div className="mt-2 aspect-square w-full overflow-hidden rounded-2xl bg-amber-50/60">
        <img
          src={src}
          alt={harvest.fruit_name}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== fallback) img.src = fallback;
          }}
        />
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <p className="text-sm font-bold text-garden-ink">{harvest.fruit_name}</p>
        <p className="line-clamp-2 text-xs text-garden-ink/70">{harvest.fruit_description}</p>
        {harvestedAt && <p className="mt-1 text-[11px] text-garden-ink/50">收获于 {harvestedAt}</p>}
        <div className="mt-1 flex justify-end">
          <a
            href={`/garden/share/${plant.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-garden-ink/60 hover:text-garden-ink"
          >
            分享 →
          </a>
        </div>
      </div>
    </Link>
  );
}
