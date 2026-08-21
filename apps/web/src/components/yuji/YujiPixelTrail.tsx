import { useEffect, useRef } from 'react';
import { useYujiStage } from '@/features/yuji-stage/YujiStageContext';

const PIXEL_COUNT = 18;
const PIXEL_SIZE = 16;
const GRID_SIZE = PIXEL_SIZE;
const SAMPLE_STEP = PIXEL_SIZE;
const MAX_SAMPLES_PER_UPDATE = 5;

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
      const duration = Math.round(Math.min(620, Math.max(380, 500 + speed * 7)));

      pixelIndex += 1;
      pixel.style.left = `${snapToGrid(x - PIXEL_SIZE / 2)}px`;
      pixel.style.top = `${snapToGrid(y - PIXEL_SIZE / 2)}px`;
      pixel.style.width = `${PIXEL_SIZE}px`;
      pixel.style.height = `${PIXEL_SIZE}px`;
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

      for (let sample = 0; sample < MAX_SAMPLES_PER_UPDATE; sample += 1) {
        const deltaX = x - previousX;
        const deltaY = y - previousY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < SAMPLE_STEP) break;

        const progress = SAMPLE_STEP / distance;
        previousX += deltaX * progress;
        previousY += deltaY * progress;
        emitPixel(previousX, previousY, pointer.speed);
      }
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
