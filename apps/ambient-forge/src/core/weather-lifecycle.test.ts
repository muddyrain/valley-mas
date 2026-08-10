import { describe, expect, it } from 'vitest';
import { getWeatherTargets } from './weather';
import { createWeatherLifecycleState, stepWeatherLifecycle } from './weather-lifecycle';

describe('weather lifecycle', () => {
  it('风暴云前沿随高强度风雨推进，天气转晴后逐步退出', () => {
    const clear = createWeatherLifecycleState();
    const approaching = stepWeatherLifecycle(clear, getWeatherTargets('rain', 1), 0.9, 4);

    expect(approaching.state.stormFront).toBeGreaterThan(0.35);
    expect(approaching.state.stormEnergy).toBeGreaterThan(0.6);

    const retreating = stepWeatherLifecycle(
      approaching.state,
      getWeatherTargets('clear', 0),
      0.1,
      5,
    );
    expect(retreating.state.stormFront).toBeLessThan(approaching.state.stormFront);
  });

  it('雷暴生命周期交替产生远雷与近雷，并同步闪电脉冲', () => {
    const storm = getWeatherTargets('rain', 1);
    const first = stepWeatherLifecycle(createWeatherLifecycleState(), storm, 1, 3);

    expect(first.thunder?.distance).toBe('far');
    expect(first.state.lightningFlash).toBe(1);

    const second = stepWeatherLifecycle(
      first.state,
      storm,
      1,
      first.state.nextThunderSeconds + 0.1,
    );
    expect(second.thunder?.distance).toBe('near');
    expect(second.thunder?.delaySeconds).toBeLessThan(first.thunder?.delaySeconds ?? 0);
  });
});
