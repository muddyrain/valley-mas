import { useEffect, useRef, useState } from 'react';
import { useYujiStage } from '@/features/yuji-stage/YujiStageContext';
import { YujiTransitionNavLink } from '@/features/yuji-transition/YujiPublicTransition';
import YujiStageLoader from './YujiStageLoader';
import YujiStickerField from './YujiStickerField';

export default function YujiWordmarkHero() {
  const stage = useYujiStage();
  const pointerReadoutRef = useRef<HTMLSpanElement>(null);
  const loaderEnabled = Boolean(stage && stage.tier !== 'static');
  const [stageEntered, setStageEntered] = useState(!loaderEnabled);

  useEffect(() => {
    if (!loaderEnabled) {
      setStageEntered(true);
      return;
    }
    setStageEntered(false);
  }, [loaderEnabled]);

  useEffect(() => {
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      if (!pointerReadoutRef.current) return;
      pointerReadoutRef.current.textContent = `POINTER / ${String(x).padStart(4, '0')} X  ${String(y).padStart(4, '0')} Y`;
    };
    const move = (event: PointerEvent) => {
      x = Math.round(event.clientX);
      y = Math.round(event.clientY);
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {loaderEnabled ? (
        <YujiStageLoader
          onReleased={() => setStageEntered(true)}
          progress={stage?.loadProgress ?? 100}
          ready={stage?.webglReady ?? false}
        />
      ) : null}
      <section
        className="yuji-wordmark-hero"
        data-yuji-stage="wordmark"
        data-stage-entered={stageEntered}
        data-webgl-ready={stage?.webglReady || undefined}
        aria-labelledby="yuji-wordmark-title"
      >
        <div className="yuji-wordmark-brief">
          <p>
            <span>YUJI.DESIGN / EDITORIAL ENGINE</span>
            文字、代码与影像的个人档案
          </p>
          <p>
            <span>THINKING IN SYSTEMS</span>
            把复杂问题写得清楚，也保留它的质感
          </p>
          <p>
            <span>DESIGNED &amp; WRITTEN BY @MUDDYRAIN</span>
            一个持续发生的数字实验室，来自上海
          </p>
        </div>

        <div className="yuji-wordmark-lockup">
          <p>HELLO FROM SHANGHAI / MOVE YOUR POINTER</p>
          <h1 id="yuji-wordmark-title" aria-label="雨迹">
            <span>y</span>
            <span>u</span>
            <span>j</span>
            <span>i</span>
          </h1>
        </div>

        <YujiStickerField />

        <p className="yuji-hero-manifesto">
          <span>把判断写进</span>
          <span>代码与影像</span>
          <span>让想法留下痕迹</span>
        </p>

        <div className="yuji-wordmark-telemetry is-bottom" aria-hidden="true">
          <span>31.2304° N / 121.4737° E</span>
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
