import type { CSSProperties, ReactNode } from 'react';

type PageBannerTone = 'default' | 'soft';

interface PageBannerProps {
  padding?: string;
  maxWidth?: string;
  tone?: PageBannerTone;
  shellClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

const DEFAULT_BACKGROUND_STYLE: CSSProperties = {
  background:
    'linear-gradient(128deg, color-mix(in srgb, var(--primary) 54%, hsl(var(--background))) 0%, color-mix(in srgb, var(--primary) 52%, hsl(var(--secondary) / 1) 48%) 52%, color-mix(in srgb, var(--primary) 50%, hsl(var(--accent) / 1) 50%) 100%)',
};

const DEFAULT_OVERLAY_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 14% 20%, hsl(var(--background) / 0.38) 0%, transparent 36%), radial-gradient(circle at 84% 18%, hsl(var(--secondary) / 0.20) 0%, transparent 32%), radial-gradient(circle at 84% 76%, hsl(var(--accent) / 0.16) 0%, transparent 36%)',
};

const SOFT_BACKGROUND_STYLE: CSSProperties = {
  background:
    'linear-gradient(130deg, color-mix(in srgb, hsl(var(--primary) / 0.15) 56%, hsl(var(--background))) 0%, hsl(var(--background) / 0.84) 45%, color-mix(in srgb, var(--muted) 50%, hsl(var(--background))) 100%)',
};

const SOFT_OVERLAY_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 12% 15%, hsl(var(--background) / 0.72) 0%, transparent 38%), radial-gradient(circle at 86% 20%, hsl(var(--secondary) / 0.12) 0%, transparent 34%), radial-gradient(circle at 82% 82%, hsl(var(--accent) / 0.10) 0%, transparent 40%)',
};

const SOFT_GLOW_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.12) 0%, transparent 42%), radial-gradient(circle at 80% 26%, hsl(var(--secondary) / 0.12) 0%, transparent 36%), radial-gradient(circle at 70% 78%, hsl(var(--accent) / 0.08) 0%, transparent 34%)',
};

export default function PageBanner({
  padding = 'py-10 md:py-14',
  maxWidth = 'max-w-7xl',
  tone = 'default',
  shellClassName,
  contentClassName,
  children,
}: PageBannerProps) {
  const isSoft = tone === 'soft';
  const backgroundStyle = isSoft ? SOFT_BACKGROUND_STYLE : DEFAULT_BACKGROUND_STYLE;
  const overlayStyle = isSoft ? SOFT_OVERLAY_STYLE : DEFAULT_OVERLAY_STYLE;

  return (
    <div className="relative px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
      <div
        className={` relative mx-auto overflow-hidden rounded-[34px] border backdrop-blur-xl ${isSoft ? 'border-foreground/15 bg-background/34 shadow-lg' : 'border-foreground/10 bg-background/16'} ${maxWidth} ${shellClassName ?? ''}`}
      >
        <div
          className={`absolute inset-0 ${isSoft ? 'bg-gradient-to-br from-background/72 via-background/34 to-accent/38' : 'bg-gradient-to-br from-primary/20 via-primary/14 to-primary/22'}`}
        />
        <div
          className={`absolute inset-0 ${isSoft ? 'opacity-84' : 'opacity-92'}`}
          style={backgroundStyle}
        />
        <div
          className={`absolute inset-0 ${isSoft ? 'opacity-92' : 'opacity-88'}`}
          style={overlayStyle}
        />
        <div
          className={`absolute inset-0 ${isSoft ? 'bg-gradient-to-b from-background/76 via-background/50 to-background/34' : 'bg-gradient-to-b from-background/34 via-background/14 to-background/10'}`}
        />
        {isSoft ? (
          <div className="absolute inset-0 opacity-64" style={SOFT_GLOW_STYLE} />
        ) : (
          <div className="absolute inset-0 opacity-52" />
        )}

        <div
          className={`pointer-events-none absolute -left-16 top-[-5.5rem] h-56 w-56 rounded-full blur-3xl ${isSoft ? 'bg-background/52' : 'bg-background/30'}`}
        />
        <div
          className={`pointer-events-none absolute -right-14 top-[-2rem] h-48 w-48 rounded-full blur-3xl ${isSoft ? 'bg-background/44' : 'bg-background/24'}`}
        />
        <div
          className={`pointer-events-none absolute -bottom-16 right-20 h-52 w-52 rounded-full blur-3xl ${isSoft ? 'bg-background/38' : 'bg-background/20'}`}
        />

        <div
          className={`relative px-5 sm:px-8 lg:px-10 ${isSoft ? '' : '[text-shadow:0_1px_2px_hsl(var(--foreground)/0.2)]'} ${padding} ${contentClassName ?? ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
