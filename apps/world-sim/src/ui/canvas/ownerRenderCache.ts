import type { MapData } from '@/core/map';
import type { FactionSummary } from '@/shared/types';

const DEFAULT_OWNER_CHUNK_SIZE = 384;

export interface OwnerVisualSignatureResult {
  changed: boolean;
  signature: string;
}

export interface OwnerVisualSignatureTracker {
  update(map: MapData, factions: readonly FactionSummary[]): OwnerVisualSignatureResult;
  reset(): void;
}

export interface OwnerLayerChunkTrackerOptions {
  chunkSize?: number;
}

export interface OwnerLayerChunkUpdate {
  changed: boolean;
  dirtyChunkIds: number[];
  dirtyRegionIds: number[];
  allChunkIds: number[];
}

export interface OwnerLayerChunkTracker {
  update(map: MapData, factions: readonly FactionSummary[]): OwnerLayerChunkUpdate;
  reset(): void;
  getChunkIdsForRegions(regionIds: Iterable<number>): number[];
  getRegionIdsForChunk(chunkId: number): readonly number[];
  getAllChunkIds(): readonly number[];
}

export function createOwnerVisualSignatureTracker(): OwnerVisualSignatureTracker {
  let previous: string | null = null;
  return {
    update(map, factions) {
      const signature = computeOwnerVisualSignature(map, factions);
      const changed = signature !== previous;
      previous = signature;
      return { changed, signature };
    },
    reset() {
      previous = null;
    },
  };
}

export function createOwnerLayerChunkTracker(
  options: OwnerLayerChunkTrackerOptions = {},
): OwnerLayerChunkTracker {
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? DEFAULT_OWNER_CHUNK_SIZE));
  let previousMap: MapData | null = null;
  let previousRegionVisuals = new Map<number, string>();
  let previousLabelSignature: string | null = null;
  let regionChunkIds = new Map<number, number>();
  let chunkRegionIds = new Map<number, number[]>();
  let allChunkIds: number[] = [];

  const rebuildChunks = (map: MapData) => {
    previousMap = map;
    regionChunkIds = new Map();
    chunkRegionIds = new Map();
    const columns = Math.max(1, Math.ceil(map.meta.bounds.width / chunkSize));

    for (const province of map.provinces) {
      const regionId = province.id as number;
      const cx = Math.max(0, Math.floor(province.centroid.x / chunkSize));
      const cy = Math.max(0, Math.floor(province.centroid.y / chunkSize));
      const chunkId = cy * columns + cx;
      regionChunkIds.set(regionId, chunkId);
      const regions = chunkRegionIds.get(chunkId);
      if (regions) {
        regions.push(regionId);
      } else {
        chunkRegionIds.set(chunkId, [regionId]);
      }
    }

    allChunkIds = [...chunkRegionIds.keys()].sort((a, b) => a - b);
  };

  return {
    update(map, factions) {
      if (previousMap !== map) {
        previousRegionVisuals = new Map();
        previousLabelSignature = null;
        rebuildChunks(map);
      }

      const colorByFaction = buildFactionColorMap(factions);
      const labelSignature = computeFactionLabelVisualSignature(factions);
      const labelChanged = labelSignature !== previousLabelSignature;
      const dirtyRegionIds: number[] = [];
      const dirtyChunkIds = new Set<number>();
      const nextRegionVisuals = new Map<number, string>();

      for (const province of map.provinces) {
        const regionId = province.id as number;
        const visual = ownerRegionVisualKey(province, colorByFaction);
        nextRegionVisuals.set(regionId, visual);
        if (previousRegionVisuals.get(regionId) === visual) continue;
        dirtyRegionIds.push(regionId);
        const chunkId = regionChunkIds.get(regionId);
        if (chunkId != null) dirtyChunkIds.add(chunkId);
      }

      previousRegionVisuals = nextRegionVisuals;
      previousLabelSignature = labelSignature;
      const sortedDirtyChunks = [...dirtyChunkIds].sort((a, b) => a - b);
      dirtyRegionIds.sort((a, b) => a - b);
      return {
        changed: sortedDirtyChunks.length > 0 || labelChanged,
        dirtyChunkIds: sortedDirtyChunks,
        dirtyRegionIds,
        allChunkIds,
      };
    },
    reset() {
      previousMap = null;
      previousRegionVisuals = new Map();
      previousLabelSignature = null;
      regionChunkIds = new Map();
      chunkRegionIds = new Map();
      allChunkIds = [];
    },
    getChunkIdsForRegions(regionIds) {
      const chunkIds = new Set<number>();
      for (const regionId of regionIds) {
        const chunkId = regionChunkIds.get(regionId);
        if (chunkId != null) chunkIds.add(chunkId);
      }
      return [...chunkIds].sort((a, b) => a - b);
    },
    getRegionIdsForChunk(chunkId) {
      return chunkRegionIds.get(chunkId) ?? [];
    },
    getAllChunkIds() {
      return allChunkIds;
    },
  };
}

export function computeOwnerVisualSignature(
  map: MapData,
  factions: readonly FactionSummary[],
): string {
  let hash = 0x811c9dc5;
  hash = mixHash(hash, map.provinces.length);

  for (const province of map.provinces) {
    hash = mixHash(hash, province.terrain === 'ocean' ? 1 : 0);
    hash = mixHash(hash, province.ownerFactionId == null ? 0 : (province.ownerFactionId as number) + 1);
  }

  const factionVisuals = factions
    .map((faction) => ({
      id: faction.id as number,
      colorHex: faction.colorHex,
      name: faction.name,
      leader: faction.leader,
      birthRegionId: faction.birthRegionId == null ? -1 : (faction.birthRegionId as number),
      capitalRegionId: faction.capitalRegionId == null ? -1 : (faction.capitalRegionId as number),
      centroidRegionId: faction.centroidRegionId == null ? -1 : (faction.centroidRegionId as number),
    }))
    .sort((a, b) => a.id - b.id);

  hash = mixHash(hash, factionVisuals.length);
  for (const faction of factionVisuals) {
    hash = mixHash(hash, faction.id);
    hash = mixString(hash, faction.colorHex);
    hash = mixString(hash, faction.name);
    hash = mixString(hash, faction.leader);
    hash = mixHash(hash, faction.birthRegionId);
    hash = mixHash(hash, faction.capitalRegionId);
    hash = mixHash(hash, faction.centroidRegionId);
  }

  return hash.toString(36);
}

function ownerRegionVisualKey(
  province: MapData['provinces'][number],
  colorByFaction: ReadonlyMap<number, string>,
): string {
  if (province.polygon.length < 3) return 'skip';
  if (province.terrain === 'ocean') return 'ocean';
  if (province.ownerFactionId == null) return 'none';
  const ownerId = province.ownerFactionId as number;
  return `${ownerId}:${colorByFaction.get(ownerId) ?? ''}`;
}

function buildFactionColorMap(factions: readonly FactionSummary[]): Map<number, string> {
  const colorByFaction = new Map<number, string>();
  for (const faction of factions) {
    colorByFaction.set(faction.id as number, faction.colorHex);
  }
  return colorByFaction;
}

function computeFactionLabelVisualSignature(factions: readonly FactionSummary[]): string {
  let hash = 0x811c9dc5;
  const visuals = factions
    .map((faction) => ({
      id: faction.id as number,
      name: faction.name,
      leader: faction.leader,
      birthRegionId: faction.birthRegionId == null ? -1 : (faction.birthRegionId as number),
      capitalRegionId: faction.capitalRegionId == null ? -1 : (faction.capitalRegionId as number),
      centroidRegionId: faction.centroidRegionId == null ? -1 : (faction.centroidRegionId as number),
    }))
    .sort((a, b) => a.id - b.id);

  hash = mixHash(hash, visuals.length);
  for (const visual of visuals) {
    hash = mixHash(hash, visual.id);
    hash = mixString(hash, visual.name);
    hash = mixString(hash, visual.leader);
    hash = mixHash(hash, visual.birthRegionId);
    hash = mixHash(hash, visual.capitalRegionId);
    hash = mixHash(hash, visual.centroidRegionId);
  }
  return hash.toString(36);
}

function mixString(hash: number, value: string): number {
  let next = mixHash(hash, value.length);
  for (let i = 0; i < value.length; i++) {
    next = mixHash(next, value.charCodeAt(i));
  }
  return next;
}

function mixHash(hash: number, value: number): number {
  return Math.imul(hash ^ value, 0x01000193) >>> 0;
}
