import { useEffect, useRef } from 'react';
import { useYujiStage } from '@/features/yuji-stage/YujiStageContext';

const PIXEL_COUNT = 18;
const GRID_SIZE = 8;
const MIN_SAMPLE_DISTANCE = 10;
const SAMPLE_STEP = 18;
const PIXEL_SIZES = [20, 16, 12, 16] as const;

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export default function YujiPixelTrail() {
  const stage = useYujiStage();
  const trailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trail = trailRef.current;
    if (!stage || !trail || typeof window.matchMedia !== 'function') return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const pixels = Array.from(trail.querySelectorAll<HTMLElement>('i'));
    let previousX: number | null = null;
    let previousY: number | null = null;
    let pixelIndex = 0;

    const clearTrail = () => {
      previousX = null;
      previousY = null;
      for (const pixel of pixels) {
        pixel.style.animation = 'none';
        pixel.style.opacity = '0';
      }
    };

    const emitPixel = (x: number, y: number, speed: number) => {
      const pixel = pixels[pixelIndex % pixels.length];
      const animationName =
        Math.floor(pixelIndex / pixels.length) % 2 === 0
          ? 'yuji-pixel-trail-fade-a'
          : 'yuji-pixel-trail-fade-b';
      const phase = pixelIndex % 4;
      const size = PIXEL_SIZES[phase] ?? 16;
      const duration = Math.round(Math.min(620, Math.max(380, 500 + speed * 7)));

      pixelIndex += 1;
      pixel.style.left = `${snapToGrid(x - size / 2)}px`;
      pixel.style.top = `${snapToGrid(y - size / 2)}px`;
      pixel.style.width = `${size}px`;
      pixel.style.height = `${size}px`;
      pixel.style.opacity = '0';
      pixel.style.animation = `${animationName} ${duration}ms steps(5, end) forwards`;
    };

    const paint = () => {
      const pointer = stage.pointerBus.frame;
      if (!finePointer.matches || !pointer.inside) {
        clearTrail();
        return;
      }

      const x = pointer.x * window.innerWidth;
      const y = pointer.y * window.innerHeight;
      const target = document.elementFromPoint?.(x, y) as HTMLElement | null;
      const hero = document.querySelector<HTMLElement>('.yuji-wordmark-hero');
      const openingStageVisible =
        hero && hero.getBoundingClientRect().bottom > window.innerHeight * 0.18;
      if (openingStageVisible || target?.closest('.yuji-wordmark-hero')) {
        clearTrail();
        return;
      }

      if (previousX === null || previousY === null) {
        previousX = x;
        previousY = y;
        return;
      }

      const deltaX = x - previousX;
      const deltaY = y - previousY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < MIN_SAMPLE_DISTANCE) return;

      const sampleCount = Math.min(5, Math.max(1, Math.floor(distance / SAMPLE_STEP)));
      for (let sample = 1; sample <= sampleCount; sample += 1) {
        const progress = sample / (sampleCount + 1);
        emitPixel(previousX + deltaX * progress, previousY + deltaY * progress, pointer.speed);
      }

      previousX = x;
      previousY = y;
    };

    const unsubscribe = stage.pointerBus.subscribe(paint);
    finePointer.addEventListener('change', paint);

    return () => {
      unsubscribe();
      finePointer.removeEventListener('change', paint);
      clearTrail();
    };
  }, [stage]);

  return (
    <div ref={trailRef} className="yuji-pixel-trail" aria-hidden="true">
      {Array.from({ length: PIXEL_COUNT }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}
