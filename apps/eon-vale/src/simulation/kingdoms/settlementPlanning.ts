import { BuildingType, TerrainType, type WorldMap } from '@/shared/gameTypes';

export interface MapPoint {
  x: number;
  z: number;
}

function isBuildable(map: WorldMap, x: number, z: number): boolean {
  if (x <= 1 || z <= 1 || x >= map.size - 2 || z >= map.size - 2) return false;
  const terrain = map.terrain[z * map.size + x] as TerrainType;
  return (
    terrain !== TerrainType.DeepOcean &&
    terrain !== TerrainType.ShallowOcean &&
    terrain !== TerrainType.Mountain
  );
}

function districtRadius(type: BuildingType, index: number): number {
  if (type === BuildingType.TownCenter) return 0;
  if (type === BuildingType.Home) return 3.5 + (index % 3) * 1.25;
  if (type === BuildingType.Farm) return 8 + (index % 2) * 1.8;
  if (type === BuildingType.Wall || type === BuildingType.Watchtower) return 10.5;
  if (type === BuildingType.LoggingCamp || type === BuildingType.Mine) return 9;
  if (type === BuildingType.Road) return 5 + (index % 3) * 1.5;
  return 5.5 + (index % 2) * 1.2;
}

export function planOrganicBuildingSite(
  map: WorldMap,
  center: MapPoint,
  type: BuildingType,
  index: number,
  occupied: MapPoint[],
): MapPoint {
  if (
    type === BuildingType.TownCenter &&
    isBuildable(map, Math.round(center.x), Math.round(center.z))
  ) {
    return { x: Math.round(center.x), z: Math.round(center.z) };
  }
  const baseRadius = districtRadius(type, index);
  const districtOffset =
    type === BuildingType.Farm
      ? 0.55
      : type === BuildingType.Mine
        ? 2.8
        : type === BuildingType.LoggingCamp
          ? 4.6
          : 0;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const angle = districtOffset + (index * 1.91 + attempt * 0.61);
    const radius = baseRadius + Math.floor(attempt / 16) * 0.8;
    const x = Math.round(center.x + Math.cos(angle) * radius);
    const z = Math.round(center.z + Math.sin(angle) * radius);
    if (!isBuildable(map, x, z)) continue;
    if (occupied.some((site) => Math.hypot(site.x - x, site.z - z) < 1.8)) continue;
    return { x, z };
  }
  return { x: Math.round(center.x), z: Math.round(center.z) };
}

export function traceVillageRoad(map: WorldMap, from: MapPoint, to: MapPoint): number[] {
  let x = Math.round(from.x);
  let z = Math.round(from.z);
  const targetX = Math.round(to.x);
  const targetZ = Math.round(to.z);
  const cells: number[] = [z * map.size + x];
  let guard = map.size * 2;
  while ((x !== targetX || z !== targetZ) && guard > 0) {
    guard -= 1;
    const dx = targetX - x;
    const dz = targetZ - z;
    const preferX = Math.abs(dx) >= Math.abs(dz);
    const candidates: MapPoint[] = preferX
      ? [
          { x: x + Math.sign(dx), z },
          { x, z: z + Math.sign(dz) },
        ]
      : [
          { x, z: z + Math.sign(dz) },
          { x: x + Math.sign(dx), z },
        ];
    const next = candidates.find((candidate) => isBuildable(map, candidate.x, candidate.z));
    if (!next) break;
    x = next.x;
    z = next.z;
    cells.push(z * map.size + x);
  }
  return cells;
}
