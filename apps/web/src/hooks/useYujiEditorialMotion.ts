import { gsap } from 'gsap';
import { type RefObject, useLayoutEffect } from 'react';

const UNREVEALED_SELECTOR = ':not([data-yuji-revealed="true"])';

export function useYujiEditorialMotion(rootRef: RefObject<HTMLElement | null>, revision: string) {
  useLayoutEffect(() => {
    void revision;
    const root = rootRef.current;
    if (!root || typeof window.matchMedia !== 'function') return;

    const media = gsap.matchMedia(root);
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const select = gsap.utils.selector(root);
      const intro = select(`[data-yuji-reveal="intro"]${UNREVEALED_SELECTOR}`);
      const images = select(`[data-yuji-reveal="media"]${UNREVEALED_SELECTOR}`);
      const scrollItems = select(`[data-yuji-reveal="scroll"]${UNREVEALED_SELECTOR}`);
      const observerTweens = new Set<gsap.core.Tween>();
      let observer: IntersectionObserver | undefined;

      if (intro.length) {
        gsap.fromTo(
          intro,
          { autoAlpha: 0, y: 22 },
          {
            autoAlpha: 1,
            clearProps: 'opacity,visibility,transform',
            duration: 0.58,
            ease: 'power3.out',
            stagger: 0.07,
            y: 0,
          },
        );
        for (const element of intro) element.dataset.yujiRevealed = 'true';
      }

      if (images.length) {
        gsap.fromTo(
          images,
          { autoAlpha: 0, clipPath: 'inset(0 0 12% 0)', scale: 1.025 },
          {
            autoAlpha: 1,
            clearProps: 'opacity,visibility,transform,clip-path',
            clipPath: 'inset(0 0 0% 0)',
            duration: 0.76,
            ease: 'power3.out',
            scale: 1,
            stagger: 0.12,
          },
        );
        for (const element of images) element.dataset.yujiRevealed = 'true';
      }

      if (scrollItems.length && 'IntersectionObserver' in window) {
        gsap.set(scrollItems, { autoAlpha: 0, y: 28 });
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const element = entry.target as HTMLElement;
              observer?.unobserve(element);
              element.dataset.yujiRevealed = 'true';
              const tween = gsap.to(element, {
                autoAlpha: 1,
                clearProps: 'opacity,visibility,transform',
                duration: 0.64,
                ease: 'power3.out',
                onComplete: () => observerTweens.delete(tween),
                y: 0,
              });
              observerTweens.add(tween);
            }
          },
          { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
        );
        for (const element of scrollItems) observer.observe(element);
      }

      return () => {
        observer?.disconnect();
        for (const tween of observerTweens) tween.kill();
      };
    });

    return () => media.revert();
  }, [revision, rootRef]);
}
