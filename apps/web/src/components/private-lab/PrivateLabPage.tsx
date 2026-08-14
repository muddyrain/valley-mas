import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PrivateLabPage({ className, children, ...props }: ComponentProps<'main'>) {
  return (
    <main
      data-slot="private-lab-page"
      className={cn('min-h-full bg-background', className)}
      {...props}
    >
      <div
        data-slot="private-lab-page-content"
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        {children}
      </div>
    </main>
  );
}

export function PrivateLabPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="private-lab-page-header"
      className={cn(
        'mb-7 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
