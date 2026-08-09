import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { createWorldExpansion } from './createWorldExpansion';

describe('createWorldExpansion', () => {
  it('装配高空天文台、下层瀑布洞穴、飞鸟、飞艇和雨后水面细节', () => {
    const expansion = createWorldExpansion(getQualityProfile('high'));

    expect(expansion.root.getObjectByName('sky-observatory-island')?.userData.cameraView).toBe(
      'observatory',
    );
    expect(expansion.root.getObjectByName('waterfall-cavern-island')?.userData.cameraView).toBe(
      'cavern',
    );
    expect(expansion.root.getObjectByName('expedition-airship')).toBeTruthy();
    expect(expansion.root.getObjectByName('bird-flock')).toBeTruthy();
    expect(expansion.root.getObjectByName('weather-puddle-field')).toBeTruthy();
    expect(expansion.getEffectCount()).toBeGreaterThan(20);

    expansion.update(deriveSceneSignals(createDefaultAmbientInputs()), 2, 1 / 60);
    expansion.setQuality(getQualityProfile('low'));

    expect(expansion.getEffectCount()).toBeLessThan(20);
    expansion.dispose();
  });
});
