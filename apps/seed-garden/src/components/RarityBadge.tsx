import clsx from 'clsx';
import type { Rarity } from '@/api/types';
import { rarityLabel } from '@/lib/rarityStyles';

const colorMap: Record<Rarity, string> = {
  N: 'bg-stone-200 text-stone-700',
  R: 'bg-sky-100 text-sky-700',
  SR: 'bg-violet-100 text-violet-700',
  SSR: 'bg-amber-100 text-amber-700',
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-bold', colorMap[rarity])}>
      {rarityLabel[rarity]} {rarity}
    </span>
  );
}
