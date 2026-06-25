import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

type LifeTraceBrandMarkProps = {
  className?: string;
  imageClassName?: string;
  alt?: string;
};

export function LifeTraceBrandMark({
  className,
  imageClassName,
  alt = 'Life Trace',
}: LifeTraceBrandMarkProps) {
  const { dark } = useTheme();

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-[1.15rem] shadow-[0_16px_48px_rgba(6,182,212,0.18)]',
        className,
      )}
    >
      <img
        src={dark ? '/brand/life-trace-mark-dark.svg' : '/brand/life-trace-mark-light.svg'}
        alt={alt}
        className={cn('size-full object-cover', imageClassName)}
      />
    </span>
  );
}
