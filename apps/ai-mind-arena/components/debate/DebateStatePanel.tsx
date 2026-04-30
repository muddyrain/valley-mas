'use client';

import type { ReactNode } from 'react';

interface DebateStatePanelProps {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function DebateStatePanel({ icon, title, description, children }: DebateStatePanelProps) {
  return (
    <section className="arena-subpanel mx-auto flex w-full max-w-[460px] flex-col items-center border-purple-400/20 bg-white/5 px-5 py-5 text-center text-white shadow-[0_0_20px_rgba(123,92,255,0.18)]">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-fuchsia-400/28 bg-fuchsia-500/12 text-fuchsia-200 shadow-[0_0_18px_rgba(255,77,157,0.28)]">
        {icon}
      </div>
      <h2 className="mt-3 text-[15px] font-semibold text-white">{title}</h2>
      {description ? (
        <p className="mt-2 text-[12px] leading-5 text-white/60">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2.5">{children}</div>
      ) : null}
    </section>
  );
}
