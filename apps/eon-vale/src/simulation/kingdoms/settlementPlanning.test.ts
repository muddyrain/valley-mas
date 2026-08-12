import { describe, expect, it } from 'vitest';
import { BuildingType, TerrainType } from '@/shared/gameTypes';
import { generateWorldMap } from '../map/generateWorldMap';
import { planOrganicBuildingSite, traceVillageRoad } from './settlementPlanning';

function centralGrass(map: ReturnType<typeof generateWorldMap>) {
  for (let radius = 0; radius < map.size / 2; radius += 1) {
    for (
      let z = Math.floor(map.size / 2) - radius;
      z <= Math.floor(map.size / 2) + radius;
      z += 1
    ) {
      for (
        let x = Math.floor(map.size / 2) - radius;
        x <= Math.floor(map.size / 2) + radius;
        x += 1
      ) {
        if (x < 0 || z < 0 || x >= map.size || z >= map.size) continue;
        if (map.terrain[z * map.size + x] === TerrainType.Grass) return { x, z };
      }
    }
  }
  return { x: Math.floor(map.size / 2), z: Math.floor(map.size / 2) };
}

describe('organic settlement planning', () => {
  it('keeps homes near the centre and farms on a readable outer belt', () => {
    const map = generateWorldMap('organic-layout', 128, 'continent');
    const center = centralGrass(map);
    const occupied: Array<{ x: number; z: number }> = [];
    const homes = Array.from({ length: 6 }, (_, index) => {
      const site = planOrganicBuildingSite(map, center, BuildingType.Home, index, occupied);
      occupied.push(site);
      return site;
    });
    const farms = Array.from({ length: 3 }, (_, index) => {
      const site = planOrganicBuildingSite(map, center, BuildingType.Farm, index, occupied);
      occupied.push(site);
      return site;
    });

    expect(homes.every((site) => Math.hypot(site.x - center.x, site.z - center.z) <= 7.5)).toBe(
      true,
    );
    expect(farms.every((site) => Math.hypot(site.x - center.x, site.z - center.z) >= 7)).toBe(true);
    expect(
      occupied.every(
        (site, index) =>
          occupied.findIndex((other) => Math.hypot(site.x - other.x, site.z - other.z) < 1.8) ===
          index,
      ),
    ).toBe(true);
  });

  it('lays a continuous walkable road from the centre to a district', () => {
    const map = generateWorldMap('organic-roads', 128, 'continent');
    const center = centralGrass(map);
    const target = planOrganicBuildingSite(map, center, BuildingType.Farm, 0, []);
    const cells = traceVillageRoad(map, center, target);

    expect(cells.length).toBeGreaterThan(5);
    for (let index = 1; index < cells.length; index += 1) {
      const before = cells[index - 1] ?? 0;
      const after = cells[index] ?? 0;
      const dx = Math.abs((before % map.size) - (after % map.size));
      const dz = Math.abs(Math.floor(before / map.size) - Math.floor(after / map.size));
      expect(dx + dz).toBe(1);
      expect(map.terrain[after]).not.toBe(TerrainType.DeepOcean);
      expect(map.terrain[after]).not.toBe(TerrainType.Mountain);
    }
  });
});
