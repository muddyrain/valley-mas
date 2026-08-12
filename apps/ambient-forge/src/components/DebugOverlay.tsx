import type { AmbientDebugStats } from '../engine/AmbientEngine';

interface DebugOverlayProps {
  stats: AmbientDebugStats | null;
}

export function DebugOverlay({ stats }: DebugOverlayProps) {
  if (!stats) return null;
  return (
    <aside className="debug-overlay" aria-label="调试信息">
      <span>FPS {stats.fps}</span>
      <span>DPR {stats.dpr.toFixed(1)}</span>
      <span>P {stats.particleCount}</span>
      <span>{stats.weather.toUpperCase()}</span>
      <span>{stats.autoTour ? 'TOUR' : stats.cameraView.toUpperCase()}</span>
      <span>
        NPC {stats.residentCount} · CAR {stats.vehicleCount}
      </span>
      <span>
        {stats.controlMode.toUpperCase()} · {stats.controlledMotion.toUpperCase()}
      </span>
      <span>
        L {stats.audioLow.toFixed(2)} · M {stats.audioMid.toFixed(2)} · H{' '}
        {stats.audioHigh.toFixed(2)}
      </span>
    </aside>
  );
}
