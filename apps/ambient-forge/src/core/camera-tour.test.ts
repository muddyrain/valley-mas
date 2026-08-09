import { describe, expect, it } from 'vitest';
import { orbitCameraPosition } from './camera-orbit';
import {
  advanceCameraTour,
  CAMERA_TOUR_ORDER,
  CAMERA_VIEW_PRESETS,
  getCameraTransitionEase,
  getCameraTransitionProgress,
  getNextCameraView,
  setCameraTourEnabled,
} from './camera-tour';

describe('camera tour', () => {
  it('为总览和七处地标提供有边界的镜头预设', () => {
    expect(Object.keys(CAMERA_VIEW_PRESETS)).toEqual([
      'overview',
      'observatory',
      'cavern',
      'garden',
      'crystal',
      'ruins',
      'harbor',
      'greenhouse',
    ]);

    for (const preset of Object.values(CAMERA_VIEW_PRESETS)) {
      const position = orbitCameraPosition(preset.orbit, preset.target);
      const distance = Math.hypot(
        position[0] - preset.target[0],
        position[1] - preset.target[1],
        position[2] - preset.target[2],
      );
      expect(distance).toBeCloseTo(preset.orbit.distance, 5);
      expect(distance).toBeGreaterThanOrEqual(12);
      expect(distance).toBeLessThanOrEqual(40);
    }
  });

  it('自动巡游按固定顺序循环且不会连续停留在同一地标', () => {
    expect(CAMERA_TOUR_ORDER).toEqual([
      'observatory',
      'cavern',
      'garden',
      'crystal',
      'ruins',
      'harbor',
      'greenhouse',
      'overview',
    ]);
    expect(getNextCameraView('overview')).toBe('observatory');
    expect(getNextCameraView('observatory')).toBe('cavern');
    expect(getNextCameraView('ruins')).toBe('harbor');
    expect(getNextCameraView('greenhouse')).toBe('overview');
  });

  it('开启后立即进入下一站，并只在停留时间到达后继续', () => {
    const enabled = setCameraTourEnabled({ enabled: false, view: 'overview', elapsed: 0 }, true);
    expect(enabled).toEqual({ enabled: true, view: 'observatory', elapsed: 0 });

    const waiting = advanceCameraTour(enabled, 8.9, 9);
    expect(waiting.view).toBe('observatory');
    expect(waiting.elapsed).toBeCloseTo(8.9);

    const advanced = advanceCameraTour(waiting, 0.2, 9);
    expect(advanced.view).toBe('cavern');
    expect(advanced.elapsed).toBeCloseTo(0.1);
  });

  it('后台极短帧时间仍保持可感知的镜头过渡速度', () => {
    expect(getCameraTransitionEase(0.001, 8)).toBeGreaterThan(0.07);
    expect(getCameraTransitionEase(0.05, 8)).toBeCloseTo(1 - Math.exp(-0.4));
  });

  it('镜头过渡按真实时间推进而不依赖渲染帧数量', () => {
    expect(getCameraTransitionProgress(1_000, 1_900, 1_200)).toBeCloseTo(0.75);
    expect(getCameraTransitionProgress(1_000, 2_400, 1_200)).toBe(1);
    expect(getCameraTransitionProgress(2_000, 1_900, 1_200)).toBe(0);
  });
});
