import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { animalAppearance, buildingAppearance, humanAppearance } from '@/render/entityAppearance';
import { createPixelCamera, screenToWorldCell, zoomCameraAt } from '@/render/pixelCamera';
import { BuildingType, EntityKind, Profession } from '@/shared/gameTypes';
import { createSeededRandom } from '@/shared/random';
import { generateWorldMap } from '@/simulation/map/generateWorldMap';
import { findPath } from '@/simulation/navigation/astar';
import { createNavigationGrid, setCellCost } from '@/simulation/navigation/grid';
import manifest from '../../rearchitecture-manifest.json';

function outlineHash(terrain: Uint8Array, height: Float32Array): string {
  let hash = 2_166_136_261;
  for (const value of terrain) {
    hash ^= value;
    hash = Math.imul(hash, 16_777_619);
  }
  for (const value of height) {
    hash ^= Math.round(value * 1_000);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

describe('phase 0 protected baseline', () => {
  it('keeps every protected and replacement-candidate path machine-checkable', () => {
    const appRoot = fileURLToPath(new URL('../../', import.meta.url));
    const tracked = [...manifest.protected, ...manifest.replacementCandidates];

    expect(manifest.baselineCommit).toBe('6e845600');
    expect(tracked.filter((path) => !existsSync(`${appRoot}/${path}`))).toEqual([]);
    expect(manifest.legacyRuntimeEntryGraph.edges).toHaveLength(4);
  });

  it('pins the cross-environment random sequence', () => {
    const random = createSeededRandom('eon-vale');

    expect(Array.from({ length: 8 }, random)).toEqual([
      0.9266626103781164, 0.8530939242336899, 0.3553441094700247, 0.6747863565105945,
      0.16236642887815833, 0.13002115418203175, 0.4183609262108803, 0.7244840506464243,
    ]);
  });

  it('pins the seeded archipelago outline before extraction', () => {
    const map = generateWorldMap('phase-0-outline', 128, 'archipelago');

    expect({
      hash: outlineHash(map.terrain, map.height),
      land: Array.from(map.terrain).filter((value) => value >= 2).length,
      walkable: Array.from(map.navigation.cost).filter((value) => value > 0).length,
    }).toEqual({ hash: 'e701f6ca', land: 6_461, walkable: 6_394 });
  });

  it('pins camera, navigation, and formal pixel sample outputs', () => {
    const camera = createPixelCamera(256, 1, 1_280, 720);
    const before = screenToWorldCell(camera, 900, 420);
    const after = screenToWorldCell(zoomCameraAt(camera, 900, 420, 1), 900, 420);
    const grid = createNavigationGrid(8, 8);
    for (let z = 0; z < 7; z += 1) setCellCost(grid, 3, z, 0);

    expect([before.x, before.z, after.x, after.z]).toEqual([193, 143, 193, 143]);
    expect(findPath(grid, 0, 63)).toEqual([
      0, 8, 16, 24, 32, 40, 48, 49, 57, 58, 59, 60, 61, 62, 63,
    ]);
    expect({
      resident: humanAppearance(Profession.Guard),
      deer: animalAppearance(EntityKind.Deer),
      home: buildingAppearance(BuildingType.Home),
    }).toMatchObject({
      resident: { facing: 'screen-front', accentColor: '#505b72' },
      deer: { profile: 'screen-side', bodyColor: '#b47b45' },
      home: { footprint: [1.62, 1.5], roof: [1.18, 1.04] },
    });
  });
});
