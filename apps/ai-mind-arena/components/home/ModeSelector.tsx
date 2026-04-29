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
    <section className="mx-auto mt-5 max-w-[1200px]">
      <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-white">
        <span className="text-[15px]">🎨</span>
        选择辩论风格
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = mode.value === value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange(mode.value)}
              className={[
                'group inline-flex h-16 items-center justify-center gap-2 rounded-full border px-7 text-[14px] font-semibold text-white transition duration-200',
                active
                  ? 'border-fuchsia-300/80 bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(255,77,157,0.5)]'
                  : 'border-purple-400/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] text-white/86 hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(123,92,255,0.3)]',
              ].join(' ')}
              aria-pressed={active}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-white' : 'text-violet-100'}`} />
              <span className="text-base">{mode.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
