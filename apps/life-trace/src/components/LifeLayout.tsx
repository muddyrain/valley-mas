import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type LifePageVariant = 'tab' | 'sub' | 'immersive';
type LifePageSpacing = 'default' | 'compact';
type LifeCardPadding = 'compact' | 'default' | 'roomy' | 'none';
type LifeCardSurface = 'default' | 'soft' | 'tone';
type LifeSectionSpacing = 'default' | 'tight';

const pageVariantClass: Record<LifePageVariant, string> = {
  tab: 'px-5 pt-4 max-[360px]:px-4',
  sub: 'pb-4',
  immersive: 'px-4 pt-3 max-[360px]:px-3',
};

const pageSpacingClass: Record<LifePageSpacing, string> = {
  default: 'space-y-5',
  compact: 'space-y-4',
};

const cardPaddingClass: Record<LifeCardPadding, string> = {
  compact: 'p-3',
  default: 'p-4',
  roomy: 'p-5',
  none: 'p-0',
};

const cardSurfaceClass: Record<LifeCardSurface, string> = {
  default: 'bg-card',
  soft: 'border-border/80 bg-card/85 shadow-[0_14px_36px_rgba(71,58,42,0.055)] backdrop-blur',
  tone: 'bg-card/90 shadow-sm',
};

export type LifePageProps = HTMLAttributes<HTMLDivElement> & {
  variant?: LifePageVariant;
  spacing?: LifePageSpacing;
  withBottomInset?: boolean;
};

export const LifePage = forwardRef<HTMLDivElement, LifePageProps>(function LifePage(
  {
    children,
    className,
    variant = 'tab',
    spacing = 'default',
    withBottomInset = variant === 'tab',
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'min-w-0 overflow-x-hidden',
        pageVariantClass[variant],
        pageSpacingClass[spacing],
        withBottomInset && 'pb-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export type LifeCardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: LifeCardPadding;
  surface?: LifeCardSurface;
};

export function LifeCard({
  children,
  className,
  padding = 'default',
  surface = 'default',
  ...props
}: LifeCardProps) {
  return (
    <Card
      className={cn(
        'rounded-[1.25rem]',
        cardSurfaceClass[surface],
        cardPaddingClass[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );
}

export type LifeSectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  spacing?: LifeSectionSpacing;
};

export function LifeSection({
  title,
  meta,
  action,
  children,
  className,
  spacing = 'default',
  ...props
}: LifeSectionProps) {
  const hasHeader = title || meta || action;

  return (
    <section
      className={cn(spacing === 'default' ? 'space-y-3' : 'space-y-2.5', className)}
      {...props}
    >
      {hasHeader ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="min-w-0 truncate text-[1.12rem] font-semibold leading-tight text-foreground">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            {meta ? <span>{meta}</span> : null}
            {action}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LifeList({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('grid gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function LifeFilterBar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
