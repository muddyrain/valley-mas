import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { type RefObject, useLayoutEffect } from 'react';
import {
  getLiquidRainFrame,
  normalizeLiquidRainPointer,
} from '@/features/yuji-home/liquidRainProgress';
import type { YujiHeaderSurface } from '@/features/yuji-public/YujiPublicChromeContext';

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(ScrollTrigger);
}

interface UseYujiMagicScrollOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onHeaderSurfaceChange?: (surface: YujiHeaderSurface) => void;
  sectionRef: RefObject<HTMLElement | null>;
  textureUrls: readonly string[];
}

function supportsEnhancedStage() {
  return (
    typeof window !== 'undefined' &&
    typeof window.WebGL2RenderingContext !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useYujiMagicScroll({
  canvasRef,
  onHeaderSurfaceChange,
  sectionRef,
  textureUrls,
}: UseYujiMagicScrollOptions) {
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const sticky = section?.querySelector<HTMLElement>('.yuji-liquid-rain-sticky');
    if (!section || !canvas || !sticky) return;

    let disposed = false;
    let animationFrame = 0;
    let visible = true;
    let pointerStrength = 0;
    let pointerTarget = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let lastHeaderSurface: YujiHeaderSurface = 'stage';
    let disposeRuntime: (() => void) | undefined;
    section.dataset.rendering = 'static';
    onHeaderSurfaceChange?.('stage');

    const applyFrame = (progress: number) => {
      const frame = getLiquidRainFrame(progress);
      section.dataset.scene = frame.scene;
      section.style.setProperty('--yuji-stage-progress', frame.progress.toFixed(4));
      section.style.setProperty('--yuji-tagline-opacity', frame.taglineOpacity.toFixed(4));
      section.style.setProperty('--yuji-portal-progress', frame.portalProgress.toFixed(4));
      section.style.setProperty('--yuji-paper-reveal', frame.paperReveal.toFixed(4));
      section.style.setProperty(
        '--yuji-signature-shift',
        `${((1 - frame.taglineOpacity) * 20).toFixed(2)}px`,
      );
      section.style.setProperty(
        '--yuji-portal-shift',
        `${((1 - frame.portalProgress) * 24).toFixed(2)}px`,
      );
      section.style.setProperty(
        '--yuji-cue-opacity',
        Math.max(0, 1 - frame.progress * 3).toFixed(4),
      );
      section.style.setProperty('--yuji-paper-scale', (1.04 - frame.paperReveal * 0.04).toFixed(4));

      const headerSurface: YujiHeaderSurface = frame.paperReveal > 0.58 ? 'content' : 'stage';
      if (headerSurface !== lastHeaderSurface) {
        lastHeaderSurface = headerSurface;
        onHeaderSurfaceChange?.(headerSurface);
      }
      return frame;
    };

    const initialFrame = applyFrame(0);

    if (!supportsEnhancedStage()) {
      section.style.setProperty('--yuji-tagline-opacity', '1');
      section.style.setProperty('--yuji-portal-progress', '1');
      section.style.setProperty('--yuji-paper-reveal', '0');
      section.style.setProperty('--yuji-signature-shift', '0px');
      section.style.setProperty('--yuji-portal-shift', '0px');
      section.style.setProperty('--yuji-cue-opacity', '0');
      section.style.setProperty('--yuji-paper-scale', '1');
      return () => onHeaderSurfaceChange?.('content');
    }

    const boot = async () => {
      try {
        const { LiquidRainMaterial } = await import('@/features/yuji-home/liquidRainMaterial');
        if (disposed) return;
        const material = new LiquidRainMaterial(canvas);
        let frame = initialFrame;

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const compact = window.matchMedia('(max-width: 760px)').matches;
          const pixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.8);
          material.resize(Math.max(1, rect.width), Math.max(1, rect.height), pixelRatio);
          material.render(performance.now());
        };

        resize();
        material.setDark(document.documentElement.classList.contains('dark'));
        material.setFrame(frame);
        material.render(performance.now());

        await material.loadTextures(textureUrls);
        if (disposed) {
          material.dispose();
          return;
        }
        section.dataset.rendering = 'enhanced';

        const tick = (time: number) => {
          if (disposed || !visible || document.hidden) return;
          pointerStrength += (pointerTarget - pointerStrength) * 0.11;
          pointerTarget *= 0.965;
          material.setPointer(pointerX, pointerY, pointerStrength);
          material.render(time);
          animationFrame = window.requestAnimationFrame(tick);
        };

        const start = () => {
          visible = true;
          window.cancelAnimationFrame(animationFrame);
          animationFrame = window.requestAnimationFrame(tick);
        };
        const stop = () => {
          visible = false;
          window.cancelAnimationFrame(animationFrame);
        };

        const updatePointer = (event: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          const pointer = normalizeLiquidRainPointer(event.clientX, event.clientY, rect);
          pointerX = pointer.x;
          pointerY = pointer.y;
          pointerTarget = event.pointerType === 'touch' ? 1.25 : 0.72;
        };
        const releasePointer = () => {
          pointerTarget = 0;
        };
        const handleContextLost = (event: Event) => {
          event.preventDefault();
          section.dataset.rendering = 'static';
          stop();
        };
        const handleVisibility = () => (document.hidden ? stop() : start());

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        const themeObserver = new MutationObserver(() => {
          material.setDark(document.documentElement.classList.contains('dark'));
        });
        themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });

        const scrollTrigger = ScrollTrigger.create({
          end: 'bottom bottom',
          invalidateOnRefresh: true,
          onEnter: start,
          onEnterBack: start,
          onLeave: () => {
            stop();
            onHeaderSurfaceChange?.('content');
          },
          onLeaveBack: stop,
          onRefresh: resize,
          onUpdate: (self) => {
            frame = applyFrame(self.progress);
            material.setFrame(frame);
          },
          pin: sticky,
          pinSpacing: false,
          start: 'top top',
          trigger: section,
        });

        section.addEventListener('pointerdown', updatePointer);
        section.addEventListener('pointermove', updatePointer);
        section.addEventListener('pointerleave', releasePointer);
        canvas.addEventListener('webglcontextlost', handleContextLost);
        document.addEventListener('visibilitychange', handleVisibility);
        start();

        disposeRuntime = () => {
          stop();
          scrollTrigger.kill();
          resizeObserver.disconnect();
          themeObserver.disconnect();
          section.removeEventListener('pointerdown', updatePointer);
          section.removeEventListener('pointermove', updatePointer);
          section.removeEventListener('pointerleave', releasePointer);
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          document.removeEventListener('visibilitychange', handleVisibility);
          material.dispose();
        };
      } catch {
        section.dataset.rendering = 'static';
      }
    };

    void boot();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      disposeRuntime?.();
      onHeaderSurfaceChange?.('content');
    };
  }, [canvasRef, onHeaderSurfaceChange, sectionRef, textureUrls]);
}
