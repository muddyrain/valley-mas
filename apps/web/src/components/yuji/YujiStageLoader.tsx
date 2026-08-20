import { type CSSProperties, useEffect, useRef, useState } from 'react';

interface YujiStageLoaderProps {
  onReleased: () => void;
  progress: number;
  ready: boolean;
}

type LoaderPhase = 'loading' | 'releasing' | 'hidden';

export default function YujiStageLoader({ onReleased, progress, ready }: YujiStageLoaderProps) {
  const [displayProgress, setDisplayProgress] = useState(Math.max(2, Math.min(progress, 100)));
  const [phase, setPhase] = useState<LoaderPhase>('loading');
  const startedAtRef = useRef(performance.now());
  const onReleasedRef = useRef(onReleased);
  const releaseStartedRef = useRef(false);
  onReleasedRef.current = onReleased;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (ready || progress >= 100) return 100;
        const measured = Math.max(current, Math.min(progress, 96));
        return Math.min(94, measured + Math.max(0.18, (94 - measured) * 0.018));
      });
    }, 42);
    return () => window.clearInterval(interval);
  }, [progress, ready]);

  useEffect(() => {
    if ((!ready && progress < 100) || phase !== 'loading') return;
    setDisplayProgress(100);
    const elapsed = performance.now() - startedAtRef.current;
    const releaseTimer = window.setTimeout(
      () => {
        if (releaseStartedRef.current) return;
        releaseStartedRef.current = true;
        onReleasedRef.current();
        setPhase('releasing');
      },
      Math.max(0, 720 - elapsed),
    );
    return () => window.clearTimeout(releaseTimer);
  }, [phase, progress, ready]);

  useEffect(() => {
    if (phase !== 'releasing') return;
    const hideTimer = window.setTimeout(() => {
      setPhase('hidden');
    }, 620);
    return () => window.clearTimeout(hideTimer);
  }, [phase]);

  useEffect(() => {
    const failOpenTimer = window.setTimeout(() => {
      setDisplayProgress(100);
      if (releaseStartedRef.current) return;
      releaseStartedRef.current = true;
      onReleasedRef.current();
      setPhase('releasing');
    }, 8000);
    return () => window.clearTimeout(failOpenTimer);
  }, []);

  useEffect(() => {
    if (phase === 'hidden') return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [phase]);

  if (phase === 'hidden') return null;

  return (
    <div
      className={`yuji-stage-loader is-${phase}`}
      role="status"
      aria-label="首页视觉正在加载"
      style={{ '--yuji-load-progress': displayProgress } as CSSProperties}
    >
      <span className="yuji-stage-loader-mark" aria-hidden="true">
        YUJI / SIGNAL
      </span>
      <span className="yuji-stage-loader-track" aria-hidden="true">
        <i />
      </span>
      <span className="yuji-stage-loader-value" aria-hidden="true">
        {String(Math.round(displayProgress)).padStart(3, '0')}
      </span>
    </div>
  );
}
