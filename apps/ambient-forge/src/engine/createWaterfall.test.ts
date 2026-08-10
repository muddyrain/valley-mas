import { Mesh, MeshPhysicalMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import type { SurfaceAccumulation } from '../core/weather';
import { createWaterfall } from './createWaterfall';

describe('createWaterfall', () => {
  it('装配折射水层、动态湿痕、融雪支流与可传播水波', () => {
    const waterfall = createWaterfall(getQualityProfile('high'));
    const refraction = waterfall.root.getObjectByName('waterfall-refraction');

    expect(refraction).toBeInstanceOf(Mesh);
    expect((refraction as Mesh).material).toBeInstanceOf(MeshPhysicalMaterial);
    expect(waterfall.root.getObjectByName('cliff-wet-streaks')).toBeTruthy();
    expect(waterfall.root.getObjectByName('meltwater-rivulets')).toBeTruthy();

    const surface: SurfaceAccumulation = {
      wetness: 1,
      snowCover: 0.4,
      puddleDepth: 1,
      iceCover: 0,
      meltwaterFlow: 0.8,
    };
    waterfall.update(
      deriveSceneSignals(
        { ...createDefaultAmbientInputs(), weather: 'rain', weatherIntensity: 1 },
        undefined,
        surface,
      ),
      2,
    );

    const state = waterfall.getState();
    expect(state.refractionStrength).toBeGreaterThan(0.3);
    expect(state.foamEnergy).toBeGreaterThan(0.7);
    expect(state.rippleEnergy).toBeGreaterThan(0.2);
    expect(state.wetStreakStrength).toBeGreaterThan(0.7);
  });
});
