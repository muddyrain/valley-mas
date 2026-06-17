import { useState } from 'react';
import type { WaterStyle } from '@/api/types';
import { WaterStyleSelector } from './WaterStyleSelector';

export function SeedInputBar({
  onSubmit,
  loading,
}: {
  onSubmit: (concept: string, waterStyle: WaterStyle) => void;
  loading: boolean;
}) {
  const [concept, setConcept] = useState('');
  const [style, setStyle] = useState<WaterStyle>('water');

  return (
    <div className="rounded-3xl bg-white/70 p-4 backdrop-blur shadow-lg flex flex-col gap-3">
      <input
        value={concept}
        onChange={(e) => setConcept(e.target.value)}
        placeholder="把任何东西种下去：未读消息、KPI、前任..."
        className="rounded-2xl bg-white px-4 py-3 outline-none text-garden-ink placeholder:text-garden-ink/40"
        maxLength={80}
      />
      <WaterStyleSelector value={style} onChange={setStyle} />
      <button
        type="button"
        disabled={!concept.trim() || loading}
        onClick={() => onSubmit(concept.trim(), style)}
        className="rounded-2xl bg-garden-ink py-3 text-white font-bold disabled:opacity-50"
      >
        {loading ? '种子精灵正在播种...' : '播种'}
      </button>
    </div>
  );
}
