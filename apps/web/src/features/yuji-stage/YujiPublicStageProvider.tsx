import { addEffect } from '@react-three/fiber';
import Lenis from 'lenis';
import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPointerBus, createScrollBus } from './stageBus';
import { resolveHeroExitProgress } from './stageMotion';
import { resolveStagePerformanceTier, type StagePerformanceTier } from './stagePerformance';
import { YujiStageCanvas } from './YujiStageCanvas';
import {
  type StageCoverRegistration,
  YujiStageContext,
  type YujiStageContextValue,
} from './YujiStageContext';

function browserSupportsWebGL() {
  if (typeof window === 'undefined') return false;
  if (window.navigator.userAgent.toLowerCase().includes('jsdom')) return false;
  return 'WebGL2RenderingContext' in window || 'WebGLRenderingContext' in window;
}

function readDeviceMemory() {
  return (window.navigator as Navigator & { deviceMemory?: number }).deviceMemory;
}

export function YujiPublicStageProvider({
  children,
  theme,
}: PropsWithChildren<{ theme: 'dark' | 'light' }>) {
  const location = useLocation();
  const routePath = location.pathname;
  const stageRoute = location.pathname === '/';
  const scrollBus = useMemo(() => createScrollBus(), []);
  const pointerBus = useMemo(() => createPointerBus(), []);
  const lenisRef = useRef<Lenis | null>(null);
  const pendingRestoreRef = useRef<number | null>(null);
  const applyPendingRestoreRef = useRef<(() => void) | null>(null);
  const [covers, setCovers] = useState<StageCoverRegistration[]>([]);
  const [tier, setTier] = useState<StagePerformanceTier>('static');
  const [documentVisible, setDocumentVisible] = useState(true);
  const [webglReady, setWebglReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [introReleased, setIntroReleased] = useState(false);
  const [introSettled, setIntroSettled] = useState(false);

  const releaseIntro = useCallback(() => {
    setIntroReleased(true);
  }, []);

  useEffect(() => {
    if (!introReleased || introSettled) return;
    const settleTimer = window.setTimeout(() => setIntroSettled(true), 1_450);
    return () => window.clearTimeout(settleTimer);
  }, [introReleased, introSettled]);

  const registerCover = useCallback((cover: StageCoverRegistration) => {
    setCovers((current) => [...current.filter((item) => item.id !== cover.id), cover]);
    return () => {
      setCovers((current) => current.filter((item) => item.id !== cover.id));
    };
  }, []);

  useEffect(() => {
    if (!stageRoute) {
      setTier('static');
      setWebglReady(false);
      setLoadProgress(0);
      return;
    }

    if (typeof window.matchMedia !== 'function') {
      setTier('static');
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateTier = () => {
      setTier(
        resolveStagePerformanceTier({
          deviceMemory: readDeviceMemory(),
          hardwareConcurrency: window.navigator.hardwareConcurrency,
          reducedMotion: media.matches,
          viewportWidth: window.innerWidth,
          webgl: browserSupportsWebGL(),
        }),
      );
    };
    updateTier();
    window.addEventListener('resize', updateTier, { passive: true });
    media.addEventListener('change', updateTier);
    return () => {
      window.removeEventListener('resize', updateTier);
      media.removeEventListener('change', updateTier);
    };
  }, [stageRoute]);

  useEffect(() => {
    if (!stageRoute || tier === 'static') return;
    const lenis = new Lenis({
      autoRaf: false,
      lerp: tier === 'full' ? 0.085 : 0.12,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.92,
    });
    lenisRef.current = lenis;
    const applyPendingRestore = () => {
      const pendingScroll = pendingRestoreRef.current;
      if (pendingScroll === null) return;
      lenis.resize();
      lenis.scrollTo(Math.min(pendingScroll, lenis.limit), { force: true, immediate: true });
      if (lenis.limit >= pendingScroll - 1) pendingRestoreRef.current = null;
    };
    applyPendingRestoreRef.current = applyPendingRestore;
    const restoreFrame = window.requestAnimationFrame(applyPendingRestore);
    const removeFrameEffect = addEffect((time) => {
      lenis.raf(time);
      const scroll = lenis.actualScroll;
      const limit = Math.max(0, lenis.limit);
      scrollBus.write({
        direction: lenis.direction,
        limit,
        progress: limit > 0 ? scroll / limit : 0,
        scroll,
        velocity: lenis.velocity,
        viewportHeight: window.innerHeight,
      });
      const exit = resolveHeroExitProgress(scroll, window.innerHeight);
      document.documentElement.style.setProperty('--yuji-hero-exit', exit.toFixed(4));
    });
    const handleContentResize = () => {
      lenis.resize();
      applyPendingRestore();
    };
    const resizeObserver = new ResizeObserver(handleContentResize);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
    const mutationObserver = new MutationObserver(handleContentResize);
    const publicMain = document.getElementById('yuji-main');
    if (publicMain) mutationObserver.observe(publicMain, { childList: true, subtree: true });
    const resizeFrame = window.requestAnimationFrame(() => lenis.resize());
    const handleKeyboardScroll = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.matches('input, textarea, select, [role="textbox"]')
      ) {
        return;
      }

      lenis.resize();
      const pageStep = window.innerHeight * 0.86;
      const nextTarget =
        event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)
          ? lenis.targetScroll + pageStep
          : event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)
            ? lenis.targetScroll - pageStep
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? lenis.limit
                : event.key === 'ArrowDown'
                  ? lenis.targetScroll + 90
                  : event.key === 'ArrowUp'
                    ? lenis.targetScroll - 90
                    : null;
      if (nextTarget === null) return;
      event.preventDefault();
      lenis.scrollTo(Math.min(lenis.limit, Math.max(0, nextTarget)));
    };
    window.addEventListener('keydown', handleKeyboardScroll);
    return () => {
      window.cancelAnimationFrame(resizeFrame);
      window.cancelAnimationFrame(restoreFrame);
      removeFrameEffect();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('keydown', handleKeyboardScroll);
      lenis.destroy();
      lenisRef.current = null;
      applyPendingRestoreRef.current = null;
      document.documentElement.style.removeProperty('--yuji-hero-exit');
    };
  }, [scrollBus, stageRoute, tier]);

  useEffect(() => {
    const handleScrollRestore = (event: Event) => {
      const scrollY = (event as CustomEvent<{ scrollY?: number }>).detail?.scrollY;
      if (typeof scrollY !== 'number') return;
      pendingRestoreRef.current = scrollY;
      const lenis = lenisRef.current;
      if (!lenis) return;
      applyPendingRestoreRef.current?.();
    };
    window.addEventListener('yuji:restore-scroll', handleScrollRestore);
    return () => window.removeEventListener('yuji:restore-scroll', handleScrollRestore);
  }, []);

  useEffect(() => {
    if (!routePath) return;
    lenisRef.current?.scrollTo(0, { force: true, immediate: true });
    window.scrollTo(0, 0);
  }, [routePath]);

  useEffect(() => {
    if (!stageRoute) return;
    const move = (event: PointerEvent) => {
      pointerBus.move(event.clientX, event.clientY, {
        height: window.innerHeight,
        left: 0,
        top: 0,
        width: window.innerWidth,
      });
    };
    const reset = () => pointerBus.reset();
    const visibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setDocumentVisible(visible);
      if (!visible) reset();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      reset();
    };
  }, [pointerBus, stageRoute]);

  const value = useMemo<YujiStageContextValue>(
    () => ({
      covers,
      introReleased,
      introSettled,
      loadProgress,
      pointerBus,
      registerCover,
      releaseIntro,
      scrollBus,
      tier,
      webglReady,
    }),
    [
      covers,
      introReleased,
      introSettled,
      loadProgress,
      pointerBus,
      registerCover,
      releaseIntro,
      scrollBus,
      tier,
      webglReady,
    ],
  );

  return (
    <YujiStageContext.Provider value={value}>
      {stageRoute && tier !== 'static' ? (
        <YujiStageCanvas
          covers={covers}
          introReleased={introReleased}
          introSettled={introSettled}
          mode="home"
          pointerBus={pointerBus}
          running={documentVisible}
          scrollBus={scrollBus}
          setLoadProgress={setLoadProgress}
          setReady={setWebglReady}
          theme={theme}
          tier={tier}
        />
      ) : null}
      {children}
    </YujiStageContext.Provider>
  );
}
