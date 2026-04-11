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
    badge: '#ffffff',
    ring: '#111111',
    mountain: '#111111',
    water: '#111111',
    text: '#111111',
  },
  light: {
    badge: '#111111',
    ring: 'rgba(255,255,255,0.58)',
    mountain: '#ffffff',
    water: '#ffffff',
    text: '#ffffff',
  },
};

function mergeClass(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function BrandLogo({
  className,
  iconClassName,
  wordmarkClassName,
  tone = 'dark',
  showWordmark = true,
}: BrandLogoProps) {
  const color = PALETTE[tone];

  return (
    <div className={mergeClass('inline-flex items-center gap-3', className)}>
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="Valley Logo Icon"
        className={mergeClass('h-10 w-10 shrink-0', iconClassName)}
      >
        <circle cx="32" cy="32" r="29" fill={color.badge} stroke={color.ring} strokeWidth="2.6" />
        <path d="M9 40 L20 27 L29 34 L39 22 L55 40 Z" fill={color.mountain} stroke="none" />
        <path d="M10 41.5 H54" stroke={color.water} strokeWidth="3.8" strokeLinecap="round" />
        <path
          d="M16 49 Q24 45 32 49 Q40 53 48 49"
          fill="none"
          stroke={color.water}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark ? (
        <span
          className={mergeClass(
            'select-none font-bold uppercase tracking-[0.24em] leading-none',
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
