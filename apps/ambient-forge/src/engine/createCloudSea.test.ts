import { InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { createCloudSea } from './createCloudSea';

describe('createCloudSea', () => {
  it('以实例批次绘制云层，并按质量档裁剪可见云量', () => {
    const clouds = createCloudSea(getQualityProfile('high'));
    const highCount = clouds.getVisibleCount();

    expect(clouds.root.getObjectByName('cloud-layer-0-0')).toBeInstanceOf(InstancedMesh);

    clouds.setQuality(getQualityProfile('low'));

    expect(clouds.getVisibleCount()).toBeLessThan(highCount);
    clouds.dispose();
  });

  it('风暴云前沿会从远景推进到群岛上空', () => {
    const clouds = createCloudSea(getQualityProfile('high'));
    const storm = clouds.root.getObjectByName('storm-cloud-bank');
    const base = deriveSceneSignals({
      ...createDefaultAmbientInputs(),
      weather: 'rain',
      weatherIntensity: 1,
      wind: 1,
    });

    clouds.update({ ...base, stormFront: 0.1 }, 1, 1 / 60);
    const distantX = storm?.position.x ?? 0;
    clouds.update({ ...base, stormFront: 0.9 }, 2, 1 / 60);

    expect(storm?.position.x).toBeLessThan(distantX);
    clouds.dispose();
  });
});
