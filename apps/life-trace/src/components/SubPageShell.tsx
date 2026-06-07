import { ArrowLeft } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { gsap, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';

type SubPageShellProps = {
  title: string;
  eyebrow?: string;
  backTo?: string;
  fallbackBackTo?: string;
  onBack?: () => void;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function canNavigateBackFromState(historyState: unknown) {
  if (!historyState || typeof historyState !== 'object') {
    return false;
  }

  const { idx } = historyState as { idx?: unknown };
  return typeof idx === 'number' && idx > 0;
}

export function SubPageShell({
  title,
  eyebrow,
  backTo,
  fallbackBackTo,
  onBack,
  action,
  children,
  className,
  contentClassName,
}: SubPageShellProps) {
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          pageRef.current,
          { x: 34, autoAlpha: 0.88 },
          {
            x: 0,
            autoAlpha: 1,
            duration: 0.34,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
          },
        );
      });

      return () => mm.revert();
    },
    { scope: pageRef },
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
      return;
    }
    if (canNavigateBackFromState(window.history.state)) {
      navigate(-1);
      return;
    }
    if (fallbackBackTo) {
      navigate(fallbackBackTo);
      return;
    }
    navigate(-1);
  };

  return (
    <div ref={pageRef} className={cn('min-w-0 overflow-x-hidden', className)}>
      <header className="sticky top-0 z-20 -mx-4 mb-5 border-b border-border/70 bg-background/92 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="返回"
            className="shrink-0"
            onClick={handleBack}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            {eyebrow ? (
              <p className="truncate text-xs font-semibold text-muted-foreground">{eyebrow}</p>
            ) : null}
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-end">{action}</div>
        </div>
      </header>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
