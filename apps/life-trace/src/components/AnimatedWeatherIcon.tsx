import Lottie from 'lottie-react';
import { Cloud, CloudLightning, CloudRain, CloudSnow, type LucideIcon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { type WeatherMotionKind, weatherLottieMap } from '@/lib/weatherLottie';

type AnimatedWeatherIconProps = {
  text: string;
  className?: string;
  iconClassName?: string;
  size?: 'hero' | 'hourly' | 'compact';
};

const wrapperSizeClassMap: Record<NonNullable<AnimatedWeatherIconProps['size']>, string> = {
  hero: 'size-12 max-[360px]:size-10',
  hourly: 'size-8',
  compact: 'size-5',
};

const fallbackSizeClassMap: Record<NonNullable<AnimatedWeatherIconProps['size']>, string> = {
  hero: 'size-9 max-[360px]:size-7',
  hourly: 'size-5',
  compact: 'size-4',
};

function resolveWeatherMotionKind(text: string): WeatherMotionKind {
  const normalized = text.trim();
  if (normalized.includes('雷')) {
    return 'storm';
  }
  if (normalized.includes('雪') || normalized.includes('冰')) {
    return 'snow';
  }
  if (normalized.includes('雨')) {
    return 'rain';
  }
  if (normalized.includes('晴')) {
    return 'sunny';
  }
  return 'cloud';
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function FallbackIcon({
  kind,
  size,
  className,
}: {
  kind: WeatherMotionKind;
  size: NonNullable<AnimatedWeatherIconProps['size']>;
  className?: string;
}) {
  const Icon: LucideIcon =
    kind === 'sunny'
      ? Sun
      : kind === 'rain'
        ? CloudRain
        : kind === 'snow'
          ? CloudSnow
          : kind === 'storm'
            ? CloudLightning
            : Cloud;

  return <Icon className={cn(fallbackSizeClassMap[size], className)} />;
}

export function AnimatedWeatherIcon({
  text,
  className,
  iconClassName,
  size = 'hourly',
}: AnimatedWeatherIconProps) {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const kind = resolveWeatherMotionKind(text);

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full',
        wrapperSizeClassMap[size],
        className,
      )}
    >
      {prefersReducedMotion ? (
        <FallbackIcon kind={kind} size={size} className={iconClassName} />
      ) : (
        <Lottie
          animationData={weatherLottieMap[kind]}
          autoplay
          loop
          className={cn('pointer-events-none h-full w-full', iconClassName)}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        />
      )}
    </span>
  );
}
