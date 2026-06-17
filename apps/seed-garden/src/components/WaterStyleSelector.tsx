import clsx from 'clsx';
import type { WaterStyle } from '@/api/types';

const OPTIONS: { value: WaterStyle; emoji: string; label: string }[] = [
  { value: 'water', emoji: '💧', label: '普通水' },
  { value: 'coffee', emoji: '☕', label: '咖啡' },
  { value: 'wine', emoji: '🍷', label: '红酒' },
  { value: 'potion', emoji: '🧪', label: '神秘药水' },
];

export function WaterStyleSelector({
  value,
  onChange,
}: {
  value: WaterStyle;
  onChange: (v: WaterStyle) => void;
}) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-full border-2 px-3 py-1 text-sm transition',
            value === o.value
              ? 'border-garden-ink bg-white text-garden-ink'
              : 'border-transparent bg-white/40 text-garden-ink/70 hover:bg-white/70',
          )}
        >
          {o.emoji} {o.label}
        </button>
      ))}
    </div>
  );
}
