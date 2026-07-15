import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EditorSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function EditorSection({
  title,
  description,
  action,
  children,
  className,
}: EditorSectionProps) {
  return (
    <section className={cn('space-y-4 rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
