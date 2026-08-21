import { gsap } from 'gsap';
import { type RefObject, useLayoutEffect } from 'react';
import { resolveAnimatedStickerCount } from '@/features/yuji-stage/stageMotion';
import type { StagePerformanceTier } from '@/features/yuji-stage/stagePerformance';

export function useYujiHeroIntro(
  rootRef: RefObject<HTMLElement | null>,
  entered: boolean,
  settled: boolean,
  tier: StagePerformanceTier,
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !entered) return;

    const select = gsap.utils.selector(root);
    const stickers = select<SVGElement>('.yuji-sticker');
    const revealTargets = select<HTMLElement>(
      '.yuji-wordmark-brief, .yuji-wordmark-lockup, .yuji-hero-manifesto span, .yuji-wordmark-telemetry, .yuji-stage-enter',
    );

    if (settled || typeof window.matchMedia !== 'function') {
      gsap.set(revealTargets, { autoAlpha: 1, clearProps: 'opacity,transform,visibility' });
      for (const sticker of stickers) sticker.dataset.yujiSettled = 'true';
      return;
    }

    const media = gsap.matchMedia(root);
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const animatedCount = tier === 'static' ? 3 : resolveAnimatedStickerCount(tier);
      const animatedStickers = stickers.slice(0, animatedCount);
      const header = document.querySelector<HTMLElement>('.yuji-header-inner');
      const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });

      gsap.set(revealTargets, { autoAlpha: 0 });
      gsap.set(select('.yuji-sticker-field'), { autoAlpha: 1 });
      for (const sticker of stickers) sticker.dataset.yujiSettled = 'false';
      if (header) gsap.set(header, { autoAlpha: 0, y: -14 });

      timeline
        .fromTo(
          select('.yuji-wordmark-brief'),
          { autoAlpha: 0, skewX: -7, x: -24 },
          { autoAlpha: 1, duration: 0.46, ease: 'power3.out', skewX: 0, x: 0 },
          0.04,
        )
        .fromTo(
          select('.yuji-wordmark-lockup'),
          { autoAlpha: 0, scale: 0.97, y: 24 },
          { autoAlpha: 1, duration: 0.54, ease: 'power3.out', scale: 1, y: 0 },
          0.08,
        )
        .fromTo(
          select('.yuji-hero-manifesto span'),
          { autoAlpha: 0, skewX: -7, x: -24 },
          { autoAlpha: 1, duration: 0.5, ease: 'power3.out', stagger: 0.06, skewX: 0, x: 0 },
          0.18,
        )
        .fromTo(
          select('.yuji-wordmark-telemetry, .yuji-stage-enter'),
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, duration: 0.42, ease: 'power3.out', stagger: 0.04, y: 0 },
          0.3,
        );

      if (header) {
        timeline.to(header, { autoAlpha: 1, duration: 0.42, ease: 'power3.out', y: 0 }, 0.24);
      }

      if (animatedStickers.length) {
        const dropDistance = tier === 'full' ? Math.max(260, window.innerHeight * 0.58) : 110;
        timeline.fromTo(
          animatedStickers,
          {
            autoAlpha: 0,
            rotation: (index) => (index % 2 === 0 ? -14 : 14),
            scale: 0.88,
            y: (index) => -dropDistance - index * 22,
          },
          {
            autoAlpha: 1,
            duration: tier === 'full' ? 0.58 : 0.46,
            ease: 'back.out(1.45)',
            onComplete: () => {
              for (const sticker of animatedStickers) sticker.dataset.yujiSettled = 'true';
              gsap.set(animatedStickers, { clearProps: 'opacity,transform,visibility' });
            },
            rotation: 0,
            scale: 1,
            stagger: tier === 'full' ? 0.06 : 0.055,
            y: 0,
          },
          0.5,
        );
      }

      timeline.eventCallback('onComplete', () => {
        gsap.set(revealTargets, { clearProps: 'opacity,transform,visibility' });
        if (header) gsap.set(header, { clearProps: 'opacity,transform,visibility' });
      });

      return () => timeline.kill();
    });
    media.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(revealTargets, { autoAlpha: 1, clearProps: 'opacity,transform,visibility' });
      for (const sticker of stickers) sticker.dataset.yujiSettled = 'true';
    });

    return () => media.revert();
  }, [entered, rootRef, settled, tier]);
}
