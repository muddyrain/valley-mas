import { describe, expect, it } from 'vitest';
import {
  createAdaptiveQualityState,
  setAdaptiveQualityPreference,
  stepAdaptiveQuality,
} from './adaptive-quality';

describe('adaptive quality', () => {
  it('持续低帧率时逐档降级，短时抖动不改变画质', () => {
    let state = createAdaptiveQualityState('high');

    state = stepAdaptiveQuality(state, 32, 1);
    expect(state.effective).toBe('high');

    state = stepAdaptiveQuality(state, 32, 1.2);
    expect(state.effective).toBe('medium');

    state = stepAdaptiveQuality(state, 28, 6.2);
    state = stepAdaptiveQuality(state, 28, 2.2);
    expect(state.effective).toBe('low');
  });

  it('稳定高帧率后逐档恢复，但不超过用户选择的上限', () => {
    let state = createAdaptiveQualityState('medium');
    state = stepAdaptiveQuality(state, 30, 2.2);
    expect(state.effective).toBe('low');

    state = stepAdaptiveQuality(state, 59, 6.2);
    state = stepAdaptiveQuality(state, 59, 10.2);
    expect(state.effective).toBe('medium');

    state = stepAdaptiveQuality(state, 60, 20);
    expect(state.effective).toBe('medium');
  });

  it('用户切换质量档时立即重置到新的上限', () => {
    let state = createAdaptiveQualityState('high');
    state = stepAdaptiveQuality(state, 25, 2.2);

    state = setAdaptiveQualityPreference(state, 'low');

    expect(state.preferred).toBe('low');
    expect(state.effective).toBe('low');
  });
});
