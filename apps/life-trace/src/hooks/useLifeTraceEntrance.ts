import type { RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

type EntranceOptions = {
  enabled?: boolean;
  dependencies?: unknown[];
  selector?: string;
  y?: number;
  scale?: number;
  stagger?: number;
  delay?: number;
  duration?: number;
  ease?: string;
};

export function useLifeTraceEntrance(
  scope: RefObject<HTMLElement | null>,
  {
    enabled = true,
    dependencies = [],
    selector = '[data-entrance]',
    y = 14,
    scale = 1,
    stagger = 0.045,
    delay = 0,
    duration = 0.46,
    ease = 'power2.out',
  }: EntranceOptions = {},
) {
  useGSAP(
    () => {
      if (!enabled) {
        return;
      }

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(selector, {
          autoAlpha: 0,
          y,
          scale,
          duration,
          delay,
          ease,
          stagger,
          clearProps: 'transform,opacity,visibility',
        });
      });

      return () => mm.revert();
    },
    {
      scope,
      dependencies,
      revertOnUpdate: true,
    },
  );
}
