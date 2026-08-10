import { describe, expect, it } from 'vitest';
import {
  createSurfaceAccumulation,
  getWeatherTargets,
  stepSurfaceAccumulation,
  stepWeatherTransition,
} from './weather';

describe('weather transitions', () => {
  it('为雨雪雾生成可辨识的不同目标', () => {
    const rain = getWeatherTargets('rain', 1);
    const snow = getWeatherTargets('snow', 1);
    const fog = getWeatherTargets('fog', 1);

    expect(rain.rain).toBe(1);
    expect(snow.snow).toBe(1);
    expect(fog.fog).toBeGreaterThan(rain.fog);
  });

  it('按过渡时长渐进接近目标', () => {
    const current = getWeatherTargets('clear', 0);
    const target = getWeatherTargets('rain', 1);
    const next = stepWeatherTransition(current, target, 0.1, 1);

    expect(next.rain).toBeGreaterThan(0);
    expect(next.rain).toBeLessThan(0.3);
    expect(stepWeatherTransition(current, target, 1.1, 1.1).rain).toBeGreaterThan(0.94);
  });

  it('雨停后地面不会立刻变干，积雪也会逐步堆积和融化', () => {
    const dry = createSurfaceAccumulation();
    const soaked = stepSurfaceAccumulation(dry, getWeatherTargets('rain', 1), 12);
    expect(soaked.wetness).toBeGreaterThan(0.75);

    const afterRain = stepSurfaceAccumulation(soaked, getWeatherTargets('clear', 0), 2);
    expect(afterRain.wetness).toBeGreaterThan(0.65);

    const snowed = stepSurfaceAccumulation(afterRain, getWeatherTargets('snow', 1), 14);
    expect(snowed.snowCover).toBeGreaterThan(0.6);
    const melting = stepSurfaceAccumulation(snowed, getWeatherTargets('rain', 0.8), 5);
    expect(melting.snowCover).toBeLessThan(snowed.snowCover);
  });

  it('积水会随降雨增长、在寒冷降雪中冻结，并在回暖时形成融雪水流', () => {
    const soaked = stepSurfaceAccumulation(
      createSurfaceAccumulation(),
      getWeatherTargets('rain', 1),
      18,
    );
    expect(soaked.puddleDepth).toBeGreaterThan(0.65);

    const frozen = stepSurfaceAccumulation(soaked, getWeatherTargets('snow', 1), 20);
    expect(frozen.iceCover).toBeGreaterThan(0.35);

    const thawed = stepSurfaceAccumulation(frozen, getWeatherTargets('rain', 0.7), 8);
    expect(thawed.iceCover).toBeLessThan(frozen.iceCover);
    expect(thawed.meltwaterFlow).toBeGreaterThan(0.1);
  });
});
