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
    'linear-gradient(128deg, color-mix(in srgb, var(--theme-primary-deep) 54%, white) 0%, color-mix(in srgb, var(--theme-primary) 52%, rgba(var(--theme-secondary-rgb),1) 48%) 52%, color-mix(in srgb, var(--theme-primary-hover) 50%, rgba(var(--theme-tertiary-rgb),1) 50%) 100%)',
};

const DEFAULT_OVERLAY_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 14% 20%, rgba(255,255,255,0.38) 0%, transparent 36%), radial-gradient(circle at 84% 18%, rgba(var(--theme-secondary-rgb),0.20) 0%, transparent 32%), radial-gradient(circle at 84% 76%, rgba(var(--theme-tertiary-rgb),0.16) 0%, transparent 36%)',
};

const SOFT_BACKGROUND_STYLE: CSSProperties = {
  background:
    'linear-gradient(130deg, color-mix(in srgb, var(--theme-primary-soft) 56%, white) 0%, rgba(255,255,255,0.84) 45%, color-mix(in srgb, var(--theme-surface-alt) 50%, white) 100%)',
};

const SOFT_OVERLAY_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 12% 15%, rgba(255,255,255,0.72) 0%, transparent 38%), radial-gradient(circle at 86% 20%, rgba(var(--theme-secondary-rgb),0.12) 0%, transparent 34%), radial-gradient(circle at 82% 82%, rgba(var(--theme-tertiary-rgb),0.10) 0%, transparent 40%)',
};

const SOFT_GLOW_STYLE: CSSProperties = {
  background:
    'radial-gradient(circle at 20% 30%, rgba(var(--theme-primary-rgb),0.12) 0%, transparent 42%), radial-gradient(circle at 80% 26%, rgba(var(--theme-secondary-rgb),0.12) 0%, transparent 36%), radial-gradient(circle at 70% 78%, rgba(var(--theme-tertiary-rgb),0.08) 0%, transparent 34%)',
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
        className={`theme-hero-shell relative mx-auto overflow-hidden rounded-[34px] border backdrop-blur-xl ${isSoft ? 'border-white/66 bg-white/34 shadow-[0_24px_64px_rgba(var(--theme-primary-rgb),0.13)]' : 'border-white/40 bg-white/16'} ${maxWidth} ${shellClassName ?? ''}`}
      >
        <div
          className={`absolute inset-0 ${isSoft ? 'bg-gradient-to-br from-white/72 via-white/34 to-theme-soft/38' : 'bg-linear-to-br from-theme-primary/20 via-theme-primary-hover/14 to-theme-primary-deep/22'}`}
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
          className={`absolute inset-0 ${isSoft ? 'bg-gradient-to-b from-white/76 via-white/50 to-white/34' : 'bg-gradient-to-b from-white/34 via-white/14 to-white/10'}`}
        />
        {isSoft ? (
          <div className="absolute inset-0 opacity-64" style={SOFT_GLOW_STYLE} />
        ) : (
          <div className="theme-hero-glow absolute inset-0 opacity-52" />
        )}

        <div
          className={`pointer-events-none absolute -left-16 top-[-5.5rem] h-56 w-56 rounded-full blur-3xl ${isSoft ? 'bg-white/52' : 'bg-white/30'}`}
        />
        <div
          className={`pointer-events-none absolute -right-14 top-[-2rem] h-48 w-48 rounded-full blur-3xl ${isSoft ? 'bg-white/44' : 'bg-white/24'}`}
        />
        <div
          className={`pointer-events-none absolute -bottom-16 right-20 h-52 w-52 rounded-full blur-3xl ${isSoft ? 'bg-white/38' : 'bg-white/20'}`}
        />

        <div
          className={`relative px-5 sm:px-8 lg:px-10 ${isSoft ? '' : '[text-shadow:0_1px_2px_rgba(15,23,42,0.2)]'} ${padding} ${contentClassName ?? ''}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
