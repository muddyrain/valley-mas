import type { MapData, Province } from '@/core/map';
import type { FactionId, FactionSummary } from '@/shared/types';

export interface FactionLabelAnchor {
  factionId: FactionId;
  labelX: number;
  labelY: number;
  capitalX: number;
  capitalY: number;
}

export function computeFactionLabelAnchors(
  map: MapData,
  factions: readonly FactionSummary[],
): FactionLabelAnchor[] {
  const anchors: FactionLabelAnchor[] = [];
  let fallbackCentroids: Map<number, { sx: number; sy: number; n: number }> | null = null;

  for (const faction of factions) {
    if ((faction.regions ?? 0) <= 0) continue;

    const labelProvince = getOwnedLandProvince(map, faction.centroidRegionId, faction.id);
    let labelX: number;
    let labelY: number;
    if (labelProvince) {
      labelX = labelProvince.centroid.x;
      labelY = labelProvince.centroid.y;
    } else {
      fallbackCentroids ??= buildOwnedCentroids(map);
      const owned = fallbackCentroids.get(faction.id as unknown as number);
      if (!owned || owned.n === 0) continue;
      labelX = owned.sx / owned.n;
      labelY = owned.sy / owned.n;
    }

    const capitalProvince = getOwnedLandProvince(map, faction.capitalRegionId, faction.id);
    anchors.push({
      factionId: faction.id,
      labelX,
      labelY,
      capitalX: capitalProvince?.centroid.x ?? labelX,
      capitalY: capitalProvince?.centroid.y ?? labelY,
    });
  }

  return anchors;
}

function getOwnedLandProvince(
  map: MapData,
  regionId: FactionSummary['centroidRegionId'],
  factionId: FactionId,
): Province | null {
  if (regionId == null) return null;
  const province = map.provinces[regionId as unknown as number];
  if (!province || province.terrain === 'ocean' || province.ownerFactionId !== factionId) return null;
  return province;
}

function buildOwnedCentroids(map: MapData): Map<number, { sx: number; sy: number; n: number }> {
  const aggregate = new Map<number, { sx: number; sy: number; n: number }>();
  for (const province of map.provinces) {
    if (province.terrain === 'ocean' || province.ownerFactionId == null) continue;
    const key = province.ownerFactionId as unknown as number;
    const acc = aggregate.get(key);
    if (acc) {
      acc.sx += province.centroid.x;
      acc.sy += province.centroid.y;
      acc.n += 1;
    } else {
      aggregate.set(key, { sx: province.centroid.x, sy: province.centroid.y, n: 1 });
    }
  }
  return aggregate;
}
