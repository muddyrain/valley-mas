import { Mesh, MeshPhysicalMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { createLifestyleIslands } from './createLifestyleIslands';

describe('createLifestyleIslands', () => {
  it('装配可聚焦的空中港口和温室岛，并按画质裁剪动态细节', () => {
    const assembly = createLifestyleIslands(getQualityProfile('high'));
    expect(assembly.root.getObjectByName('sky-harbor-island')?.userData.cameraView).toBe('harbor');
    expect(assembly.root.getObjectByName('glasshouse-island')?.userData.cameraView).toBe(
      'greenhouse',
    );
    expect(assembly.root.getObjectByName('harbor-crane')).toBeTruthy();
    expect(assembly.root.getObjectByName('greenhouse-frame')).toBeTruthy();

    const highCount = assembly.getEffectCount();
    assembly.update(deriveSceneSignals(createDefaultAmbientInputs()), 4, 1 / 60);
    assembly.setQuality(getQualityProfile('low'));
    expect(assembly.getEffectCount()).toBeLessThan(highCount);
    assembly.dispose();
  });

  it('切换画质时只更新玻璃参数，不强制重编译材质', () => {
    const assembly = createLifestyleIslands(getQualityProfile('high'));
    let glassMaterial: MeshPhysicalMaterial | undefined;
    assembly.root.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof MeshPhysicalMaterial) {
        glassMaterial = object.material;
      }
    });
    expect(glassMaterial).toBeTruthy();
    const materialVersion = glassMaterial?.version;

    assembly.setQuality(getQualityProfile('low'));

    expect(glassMaterial?.version).toBe(materialVersion);
    assembly.dispose();
  });
});
