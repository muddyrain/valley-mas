import { useEffect, useRef } from 'react';
import { resolveStickerFlow } from '@/features/yuji-stage/stageMotion';
import { useYujiStage } from '@/features/yuji-stage/YujiStageContext';
import { YujiTransitionNavLink } from '@/features/yuji-transition/YujiPublicTransition';
import { useYujiHeroIntro } from '@/hooks/useYujiHeroIntro';
import YujiStageLoader from './YujiStageLoader';
import YujiStickerField from './YujiStickerField';

export default function YujiWordmarkHero() {
  const stage = useYujiStage();
  const heroRef = useRef<HTMLElement>(null);
  const pointerReadoutRef = useRef<HTMLSpanElement>(null);
  const loaderEnabled = Boolean(stage && stage.tier !== 'static' && !stage.introReleased);
  const stageEntered = !loaderEnabled;
  const tier = stage?.tier ?? 'static';
  useYujiHeroIntro(heroRef, stageEntered, stage?.introSettled ?? true, tier);

  useEffect(() => {
    if (stage?.tier === 'static' && !stage.introReleased) stage.releaseIntro();
  }, [stage]);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const hero = heroRef.current;
      if (!stage || !hero) return;
      const pointer = stage.pointerBus.frame;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const x = Math.round(pointer.x * viewportWidth);
      const y = Math.round(pointer.y * viewportHeight);
      const stickers = Array.from(hero.querySelectorAll<SVGSVGElement>('[data-yuji-sticker]'));
      const stickerRects = stickers.map((sticker) => sticker.getBoundingClientRect());

      if (pointerReadoutRef.current) {
        pointerReadoutRef.current.textContent = `POINTER / ${String(x).padStart(4, '0')} X  ${String(y).padStart(4, '0')} Y`;
      }

      stickers.forEach((sticker, index) => {
        const response = resolveStickerFlow({
          active: pointer.inside && stage.tier !== 'static',
          pointerX: pointer.x,
          pointerY: pointer.y,
          rect: stickerRects[index],
          viewportHeight,
          viewportWidth,
        });
        sticker.style.setProperty('--yuji-sticker-flow-x', `${response.offsetX.toFixed(2)}px`);
        sticker.style.setProperty('--yuji-sticker-flow-y', `${response.offsetY.toFixed(2)}px`);
        sticker.style.setProperty(
          '--yuji-sticker-flow-glow',
          `${(response.intensity * 22).toFixed(2)}px`,
        );
        sticker.style.setProperty(
          '--yuji-sticker-flow-brightness',
          (1 + response.intensity * 0.22).toFixed(3),
        );
        sticker.style.setProperty(
          '--yuji-sticker-flow-saturation',
          (1 + response.intensity * 0.28).toFixed(3),
        );
        sticker.style.setProperty(
          '--yuji-sticker-flow-scale',
          (1 + response.intensity * 0.035).toFixed(3),
        );
      });
    };
    if (!stage) return;
    const unsubscribe = stage.pointerBus.subscribe(() => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    });
    return () => {
      unsubscribe();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [stage]);

  return (
    <>
      {loaderEnabled ? (
        <YujiStageLoader
          onReleased={() => stage?.releaseIntro()}
          progress={stage?.loadProgress ?? 100}
          ready={stage?.webglReady ?? false}
        />
      ) : null}
      <section
        ref={heroRef}
        className="yuji-wordmark-hero"
        data-yuji-stage="wordmark"
        data-stage-entered={stageEntered}
        data-yuji-motion-tier={tier}
        data-webgl-ready={stage?.webglReady || undefined}
        aria-labelledby="yuji-wordmark-title"
      >
        <div className="yuji-hero-exit-halftone" aria-hidden="true" />
        <div className="yuji-wordmark-brief">
          <p>
            <span>YUJI.DESIGN / INDEPENDENT FIELD</span>
            一个关于技术、审美与创造的私人现场
          </p>
          <p>
            <span>SYSTEMS, CRAFT &amp; CURIOSITY</span>
            把复杂变清楚，把想法做成作品
          </p>
          <p>
            <span>NOTES BY @MUDDYRAIN</span>
            前端、工具与影像
          </p>
        </div>

        <div className="yuji-wordmark-lockup">
          <p>HELLO FROM HANGZHOU / MOVE YOUR POINTER</p>
          <h1 id="yuji-wordmark-title" aria-label="muddyrain">
            <span>m</span>
            <span>u</span>
            <span>d</span>
            <span>d</span>
            <span>y</span>
            <span>r</span>
            <span>a</span>
            <span>i</span>
            <span>n</span>
          </h1>
        </div>

        <YujiStickerField />

        <p className="yuji-hero-manifesto">
          <span>保持好奇</span>
          <span>允许偏航</span>
          <span>找到自己的节奏</span>
        </p>

        <div className="yuji-wordmark-telemetry is-bottom" aria-hidden="true">
          <span>30.2741° N / 120.1551° E</span>
          <span ref={pointerReadoutRef}>POINTER / 0000 X 0000 Y</span>
          <span>SCROLL TO DISCOVER ↓</span>
        </div>

        <YujiTransitionNavLink
          className="yuji-stage-enter"
          to="/articles"
          transitionId="hero-index"
        >
          <span>VIEW THE WRITING / 发现文章</span>
          <span aria-hidden="true">↘</span>
        </YujiTransitionNavLink>
      </section>
    </>
  );
}
