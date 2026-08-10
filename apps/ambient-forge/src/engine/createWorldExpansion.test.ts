import { Group, type Mesh, type MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import type { SurfaceAccumulation } from '../core/weather';
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

  it('让积水扩张、结冰并抑制雨滴波纹', () => {
    const expansion = createWorldExpansion(getQualityProfile('high'));
    const surface: SurfaceAccumulation = {
      wetness: 1,
      snowCover: 0.5,
      puddleDepth: 0.9,
      iceCover: 0.8,
      meltwaterFlow: 0,
    };

    expansion.update(
      deriveSceneSignals(
        { ...createDefaultAmbientInputs(), weather: 'snow', weatherIntensity: 1 },
        undefined,
        surface,
      ),
      4,
      1 / 60,
    );

    const water = expansion.root.getObjectByName('puddle-water-surfaces') as Group;
    const ice = expansion.root.getObjectByName('puddle-ice-layer') as Group;
    const firstWater = water?.children[0] as Mesh;
    const firstIce = ice?.children[0] as Mesh;
    const ripple = expansion.root.getObjectByName('puddle-ripple-0') as Mesh;

    expect(water).toBeInstanceOf(Group);
    expect(ice).toBeInstanceOf(Group);
    expect(firstWater.scale.x).toBeGreaterThan(1);
    expect((firstIce.material as MeshStandardMaterial).opacity).toBeGreaterThan(0.5);
    expect((ripple.material as MeshStandardMaterial).opacity).toBeLessThan(0.05);
    expansion.dispose();
  });
});
