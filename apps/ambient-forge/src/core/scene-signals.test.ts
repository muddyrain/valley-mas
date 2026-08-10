import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from './ambient-inputs';
import { deriveSceneSignals } from './scene-signals';

describe('deriveSceneSignals', () => {
  it('把天气和三频能量映射为有界且不同的场景信号', () => {
    const signals = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      timeOfDay: 23,
      weather: 'rain',
      weatherIntensity: 0.8,
      audioLow: 1,
      audioMid: 0.7,
      audioHigh: 0.9,
    });

    expect(signals.islandBreath).toBeGreaterThan(0);
    expect(signals.islandBreath).toBeLessThanOrEqual(0.02);
    expect(signals.plantSway).toBeGreaterThan(signals.islandBreath);
    expect(signals.fireflyActivity).toBeGreaterThan(0.25);
    expect(signals.fogDensity).toBeGreaterThan(0.01);
    expect(signals.cabinLight).toBeGreaterThan(0.5);
  });

  it('reduced-motion 明显压低视差、呼吸和粒子响应', () => {
    const base = { ...createDefaultAmbientInputs(), audioLow: 1, audioHigh: 1 };
    const normal = deriveSceneSignals(base);
    const reduced = deriveSceneSignals({ ...base, reducedMotion: true });

    expect(reduced.islandBreath).toBeLessThan(normal.islandBreath * 0.4);
    expect(reduced.pointerX).toBeLessThan(normal.pointerX + 0.001);
    expect(reduced.fireflyActivity).toBeLessThan(normal.fireflyActivity);
  });

  it('保留归一化风力供天气和植被共享同一个风场', () => {
    const calm = deriveSceneSignals({ ...createDefaultAmbientInputs(), wind: 0 });
    const windy = deriveSceneSignals({ ...createDefaultAmbientInputs(), wind: 1 });

    expect(calm.windStrength).toBe(0);
    expect(windy.windStrength).toBe(1);
    expect(windy.plantSway).toBeGreaterThan(calm.plantSway);
  });

  it('强降雨会压低萤火虫活动而不是让晴雨夜景完全相同', () => {
    const clear = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      timeOfDay: 23,
      weather: 'clear',
      weatherIntensity: 1,
    });
    const rain = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      timeOfDay: 23,
      weather: 'rain',
      weatherIntensity: 1,
    });

    expect(rain.fireflyActivity).toBeLessThan(clear.fireflyActivity * 0.45);
  });

  it('把积水、冰层、融雪水流与风暴前沿传递给场景系统', () => {
    const signals = deriveSceneSignals(
      { ...createDefaultAmbientInputs(), weather: 'snow', weatherIntensity: 1 },
      undefined,
      { wetness: 0.8, snowCover: 0.9, puddleDepth: 0.7, iceCover: 0.6, meltwaterFlow: 0.4 },
      { stormFront: 0.75, stormEnergy: 0.8, lightningFlash: 0.5 },
    );

    expect(signals.puddleDepth).toBe(0.7);
    expect(signals.iceCover).toBe(0.6);
    expect(signals.meltwaterFlow).toBe(0.4);
    expect(signals.stormFront).toBe(0.75);
    expect(signals.lightningFlash).toBe(0.5);
  });
});
