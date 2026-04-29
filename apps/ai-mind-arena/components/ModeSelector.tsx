'use client';

import { BriefcaseBusiness, Flame, Heart, Sparkles, Swords, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DebateMode } from '@/lib/types';

const modes: Array<{
  value: DebateMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: 'serious', label: '严肃', icon: BriefcaseBusiness },
  { value: 'funny', label: '搞笑', icon: Sparkles },
  { value: 'sharp', label: '毒舌', icon: Zap },
  { value: 'wild', label: '发疯', icon: Flame },
  { value: 'workplace', label: '职场', icon: Swords },
  { value: 'emotion', label: '情感', icon: Heart },
];

interface ModeSelectorProps {
  value: DebateMode;
  onChange: (mode: DebateMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <section className="mx-auto mt-9 max-w-4xl text-center">
      <div className="mb-5 text-2xl font-black text-white drop-shadow">🎨 选择辩论风格 🎨</div>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = mode.value === value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={[
                'group inline-flex h-16 min-w-36 items-center justify-center gap-3 rounded-full border-4 px-7 text-xl font-black text-white transition duration-200',
                active
                  ? 'scale-105 border-white bg-blue-500 shadow-[0_0_0_8px_rgba(255,255,255,.28),0_10px_0_rgba(21,4,45,.35)]'
                  : 'border-white/35 bg-white/14 hover:-translate-y-1 hover:border-white/70 hover:bg-white/22',
              ].join(' ')}
              aria-pressed={active}
            >
              <Icon className="h-6 w-6" />
              {mode.label}
              {active ? <span className="text-3xl leading-none text-arena-yellow">✓</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
