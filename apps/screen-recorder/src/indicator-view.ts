import type { RecorderSnapshot } from './shared/contracts';

export type IndicatorView = {
  label: string;
  elapsed: string;
  phase: 'configuring' | 'countdown' | 'recording' | 'stopping';
};

export type IndicatorFrame = {
  mode: 'screen' | 'region';
  x: number;
  y: number;
  width: number;
  height: number;
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getIndicatorView(
  snapshot: RecorderSnapshot,
  now = Date.now(),
): IndicatorView | undefined {
  if (snapshot.state === 'configuring' && snapshot.plan) {
    return {
      label: snapshot.plan.mode === 'region' ? '录制区域' : '录制主屏幕',
      elapsed: snapshot.plan.selection
        ? `${Math.round(snapshot.plan.selection.width)} × ${Math.round(snapshot.plan.selection.height)}`
        : '主显示器',
      phase: 'configuring',
    };
  }
  if (snapshot.state === 'countdown' && snapshot.plan) {
    return {
      label: '准备录制',
      elapsed: String(Math.max(0, Math.ceil((snapshot.plan.countdownEndsAt - now) / 1_000))),
      phase: 'countdown',
    };
  }
  if (snapshot.state === 'recording' && snapshot.startedAt) {
    return {
      label: '正在录制',
      elapsed: formatDuration(Math.max(0, Math.floor((now - snapshot.startedAt) / 1_000))),
      phase: 'recording',
    };
  }
  if (snapshot.state === 'stopping') {
    return { label: '正在保存', elapsed: '…', phase: 'stopping' };
  }
  return undefined;
}

export function getIndicatorFrame(snapshot: RecorderSnapshot): IndicatorFrame | undefined {
  const plan = snapshot.plan;
  if (!plan) {
    return undefined;
  }
  if (plan.mode === 'screen') {
    return {
      mode: 'screen',
      x: 2,
      y: 2,
      width: Math.max(0, plan.display.bounds.width - 4),
      height: Math.max(0, plan.display.bounds.height - 4),
    };
  }
  if (!plan.selection) {
    return undefined;
  }
  return {
    mode: 'region',
    x: plan.selection.x - plan.display.bounds.x,
    y: plan.selection.y - plan.display.bounds.y,
    width: plan.selection.width,
    height: plan.selection.height,
  };
}
