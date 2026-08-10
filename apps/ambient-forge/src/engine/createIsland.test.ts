import { Group, InstancedMesh, type Mesh, type MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { getQualityProfile } from '../core/quality';
import { deriveSceneSignals } from '../core/scene-signals';
import { createIsland } from './createIsland';

describe('createIsland', () => {
  it('批量实例化主岛树木和草叶，并按质量档裁剪草叶 LOD', () => {
    const island = createIsland(getQualityProfile('high'));
    const trunks = island.root.getObjectByName('tree-trunks');
    const leaves = island.root.getObjectByName('tree-leaves-0');
    const grass = island.root.getObjectByName('grass-blades');

    expect(trunks).toBeInstanceOf(InstancedMesh);
    expect(leaves).toBeInstanceOf(InstancedMesh);
    expect(grass).toBeInstanceOf(InstancedMesh);
    expect((grass as InstancedMesh).count).toBe(getQualityProfile('high').grassBlades);

    island.setQuality(getQualityProfile('low'));

    expect((grass as InstancedMesh).count).toBe(getQualityProfile('low').grassBlades);
    island.dispose();
  });

  it('让主岛水洼随积水增长并显示冻结层', () => {
    const island = createIsland(getQualityProfile('high'));
    island.update(
      deriveSceneSignals(createDefaultAmbientInputs(), undefined, {
        wetness: 1,
        snowCover: 0.4,
        puddleDepth: 1,
        iceCover: 0.75,
        meltwaterFlow: 0,
      }),
      3,
    );

    const puddles = island.root.getObjectByName('main-island-puddles') as Group;
    const ice = island.root.getObjectByName('main-island-puddle-ice') as Group;
    const firstPuddle = puddles?.children[0] as Mesh;
    const firstIce = ice?.children[0] as Mesh;

    expect(puddles).toBeInstanceOf(Group);
    expect(ice).toBeInstanceOf(Group);
    expect(firstPuddle.scale.x).toBeGreaterThan(1);
    expect((firstIce.material as MeshStandardMaterial).opacity).toBeGreaterThan(0.5);
    island.dispose();
  });
});
