import { cn } from '@/lib/utils';

type BrandLogoTone = 'dark' | 'light';

interface BrandLogoProps {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  tone?: BrandLogoTone;
  showWordmark?: boolean;
}

const PALETTE: Record<
  BrandLogoTone,
  { badge: string; ring: string; mountain: string; water: string; text: string }
> = {
  dark: {
    badge: 'var(--theme-primary-soft)',
    ring: 'var(--theme-border)',
    mountain: 'var(--theme-primary-deep, #1f4f85)',
    water: 'var(--theme-primary, #3b82f6)',
    text: 'var(--theme-primary-deep, #1f4f85)',
  },
  light: {
    badge: 'var(--theme-primary)',
    ring: 'rgba(255,255,255,0.35)',
    mountain: 'rgba(255,255,255,0.95)',
    water: 'rgba(255,255,255,0.8)',
    text: 'rgba(255,255,255,0.96)',
  },
};

export default function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
  tone = 'dark',
  showWordmark = true,
}: BrandLogoProps) {
  const color = PALETTE[tone];

  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="Valley Logo Icon"
        className={cn(
          'h-10 w-10 shrink-0 drop-shadow-[0_4px_10px_rgba(53,33,20,0.22)]',
          iconClassName,
        )}
      >
        <circle cx="32" cy="32" r="29" fill={color.badge} stroke={color.ring} strokeWidth="2" />
        <path
          d="M10 39 L21 27 L30 35 L40 23 L54 39"
          fill="none"
          stroke={color.mountain}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M11 41 H53" stroke={color.water} strokeWidth="2.8" strokeLinecap="round" />
        <path
          d="M16 47 C22 44 27 44 32 47 C37 50 42 50 48 47"
          fill="none"
          stroke={color.water}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark ? (
        <span
          className={cn(
            'select-none font-bold uppercase tracking-[0.26em] leading-none',
            wordmarkClassName,
          )}
          style={{ color: color.text }}
          aria-hidden="true"
        >
          Valley
        </span>
      ) : null}
    </div>
  );
}
