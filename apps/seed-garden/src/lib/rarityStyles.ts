import type { Rarity } from '@/api/types';

export const rarityFrame: Record<Rarity, string> = {
  N: 'border-stone-300 shadow-sm',
  R: 'border-sky-400 shadow-md shadow-sky-200/50',
  SR: 'border-violet-400 shadow-lg shadow-violet-300/50',
  SSR: 'border-amber-400 shadow-xl shadow-amber-300/60',
};

export const rarityLabel: Record<Rarity, string> = {
  N: '★',
  R: '★★',
  SR: '★★★',
  SSR: '★★★★',
};
