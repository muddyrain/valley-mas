import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HeroStatChipProps = {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function HeroStatChip({ icon, children, className }: HeroStatChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-card/82 px-4 py-2 text-sm text-foreground shadow-[0_10px_28px_rgba(148,163,184,0.08)]',
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}
