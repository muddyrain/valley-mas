import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface TiltState {
  x: number;
  y: number;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
}

const PARTICLE_COUNT = 56;

interface HeroImmersiveShowcaseProps {
  onActivate?: () => void;
  isActive?: boolean;
}

export default function HeroImmersiveShowcase({
  onActivate,
  isActive = false,
}: HeroImmersiveShowcaseProps) {
  const stageRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tilt, setTilt] = useState<TiltState>({ x: 0, y: 0 });

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map(() => ({
        angle: Math.random() * Math.PI * 2,
        radius: 32 + Math.random() * 120,
        speed: 0.003 + Math.random() * 0.006,
        size: 1 + Math.random() * 2.6,
        alpha: 0.35 + Math.random() * 0.6,
      })),
    [],
  );

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const drawFrame = () => {
      const centerX = width / 2;
      const centerY = height * 0.56;
      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(centerX, centerY, 16, centerX, centerY, 170);
      glow.addColorStop(0, 'rgba(206,98,126,0.25)');
      glow.addColorStop(0.45, 'rgba(232,171,90,0.18)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(centerX, centerY);

      for (let ring = 0; ring < 3; ring += 1) {
        const radius = 44 + ring * 26;
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.strokeStyle = ring === 2 ? 'rgba(206,98,126,0.22)' : 'rgba(232,171,90,0.25)';
        context.lineWidth = ring === 1 ? 1.6 : 1.2;
        context.setLineDash(ring === 1 ? [3, 5] : [8, 10]);
        context.lineDashOffset = -performance.now() * (0.01 + ring * 0.007);
        context.stroke();
      }

      context.setLineDash([]);
      particles.forEach((particle, index) => {
        particle.angle += particle.speed;
        const x = Math.cos(particle.angle) * particle.radius;
        const y = Math.sin(particle.angle) * (particle.radius * 0.62);
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fillStyle =
          index % 3 === 0
            ? `rgba(206,98,126,${particle.alpha})`
            : `rgba(232,171,90,${particle.alpha * 0.8})`;
        context.fill();
      });
      context.restore();

      rafId = requestAnimationFrame(drawFrame);
    };

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncSize) : null;
    observer?.observe(stage);
    window.addEventListener('resize', syncSize);
    syncSize();
    drawFrame();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncSize);
      cancelAnimationFrame(rafId);
    };
  }, [particles]);

  const handlePointerMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    });
  };

  return (
    <button
      type="button"
      ref={stageRef}
      onClick={onActivate}
      className="group relative block h-[280px] w-full overflow-hidden rounded-[24px] border border-border/50 bg-card text-left shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-[320px] sm:rounded-[26px] md:h-[348px]"
      onMouseMove={handlePointerMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      aria-label="打开 Valley AI 中枢"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,hsl(var(--accent) / 0.2),transparent_38%),radial-gradient(circle_at_86%_16%,hsl(var(--secondary) / 0.2),transparent_36%),radial-gradient(circle_at_60%_88%,hsl(var(--primary) / 0.16),transparent_44%)]" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-[10px] tracking-[0.1em] text-primary uppercase sm:left-4 sm:top-4 sm:text-[11px] sm:tracking-[0.14em]">
        <Sparkles className="h-3.5 w-3.5" />
        首页展示舱
      </div>

      <div className="absolute right-3 top-3 rounded-xl border border-border bg-card/84 px-2.5 py-1 text-[10px] tracking-[0.08em] text-muted-foreground uppercase shadow-sm sm:right-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-[11px] sm:tracking-[0.12em]">
        {isActive ? '已唤醒' : '实时动态'}
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center [perspective:1200px]">
        <div
          className="relative h-[180px] w-[180px] transition duration-200 sm:h-[210px] sm:w-[210px]"
          style={{
            transform: `rotateX(${12 - tilt.y * 14}deg) rotateY(${tilt.x * 18}deg)`,
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="absolute inset-0 rounded-[34px] border border-border/70 bg-[linear-gradient(140deg,hsl(var(--card) / 0.7),hsl(var(--secondary) / 0.18),hsl(var(--primary) / 0.22))] shadow-lg backdrop-blur-sm" />
          <div className="absolute inset-4 rounded-[28px] border border-border/80 bg-card/35 backdrop-blur-md" />
          <div className="absolute left-1/2 top-1/2 h-[126px] w-[126px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/60 bg-[conic-gradient(from_0deg,hsl(var(--primary) / 0.16),hsl(var(--secondary) / 0.34),hsl(var(--accent) / 0.3),hsl(var(--primary) / 0.16))] animate-[spin_12s_linear_infinite] sm:h-[150px] sm:w-[150px]" />
          <div className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border/85 bg-card/52 shadow-md sm:h-[108px] sm:w-[108px]" />

          <div className="absolute left-1/2 top-[45%] h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-[linear-gradient(180deg,hsl(var(--secondary) / 0.42),hsl(var(--primary) / 0.36))] shadow-[0_0_20px_hsl(var(--primary) / 0.36)]" />
          <div className="absolute left-1/2 top-[62%] h-[52px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-border/80 bg-[linear-gradient(180deg,hsl(var(--primary) / 0.36),hsl(var(--accent) / 0.24))] shadow-[0_0_16px_hsl(var(--primary) / 0.28)]" />
          <div className="absolute left-[43%] top-[64%] h-9 w-2 rounded-full border border-border/70 bg-card/50" />
          <div className="absolute right-[43%] top-[64%] h-9 w-2 rounded-full border border-border/70 bg-card/50" />
        </div>
      </div>

      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border bg-card/82 px-3 py-2 shadow-sm sm:bottom-4 sm:left-4 sm:right-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] tracking-[0.12em] text-primary uppercase">动态引擎运行中</div>
          <div className="flex items-end gap-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <span
                key={index}
                className="inline-block w-1.5 rounded-full bg-[linear-gradient(180deg,hsl(var(--secondary) / 0.9),hsl(var(--primary) / 0.6))] animate-[pulse_1.8s_ease-in-out_infinite]"
                style={{
                  height: `${8 + ((index * 7) % 12)}px`,
                  animationDelay: `${index * 0.09}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
