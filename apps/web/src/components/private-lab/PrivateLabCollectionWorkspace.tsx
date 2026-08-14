import type { ComponentProps, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PrivateLabCollectionWorkspace({
  navigation,
  children,
  className,
  ...props
}: ComponentProps<'div'> & { navigation: ReactNode }) {
  return (
    <div
      data-slot="private-lab-collection-workspace"
      className={cn('grid min-w-0 items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]', className)}
      {...props}
    >
      <aside data-slot="private-lab-collection-navigation" className="min-w-0 lg:sticky lg:top-4">
        {navigation}
      </aside>
      <section data-slot="private-lab-collection-content" className="min-w-0">
        {children}
      </section>
    </div>
  );
}

export function PrivateLabCollectionPanel({
  variant = 'content',
  className,
  ...props
}: ComponentProps<typeof Card> & { variant?: 'content' | 'navigation' }) {
  return (
    <Card
      data-slot="private-lab-collection-panel"
      data-variant={variant}
      className={cn(
        'gap-0 py-0 shadow-xs ring-foreground/8',
        variant === 'navigation' && 'lg:rounded-none lg:bg-transparent lg:shadow-none lg:ring-0',
        className,
      )}
      {...props}
    />
  );
}
