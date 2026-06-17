import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { Plant } from '@/api/types';
import { rarityFrame } from '@/lib/rarityStyles';
import { RarityBadge } from './RarityBadge';

export function PlantPot({ plant, slotIndex }: { plant?: Plant; slotIndex: number }) {
  if (!plant) {
    return (
      <div className="aspect-square rounded-3xl border-2 border-dashed border-garden-ink/30 flex items-center justify-center text-garden-ink/40">
        空花盆 · {slotIndex + 1}
      </div>
    );
  }
  const src = `/assets/encyclopedia/${plant.rarity}/${plant.asset_key}_${plant.stage}.png`;
  return (
    <Link
      to={`/garden/plant/${plant.id}`}
      className={clsx(
        'block aspect-square rounded-3xl border-2 bg-white/40 p-2',
        rarityFrame[plant.rarity],
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-garden-ink">{plant.name}</span>
        <RarityBadge rarity={plant.rarity} />
      </div>
      <img src={src} alt={plant.name} className="w-full h-[80%] object-contain" loading="lazy" />
      <div className="text-center text-xs text-garden-ink/60">
        阶段 {plant.stage}/{plant.stage_max}
      </div>
    </Link>
  );
}
