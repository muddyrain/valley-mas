import type { MapData } from '@/core/map';
import type { FactionSummary } from '@/shared/types';

const DEFAULT_BORDER_CHUNK_SIZE = 384;

export interface BorderLayerChunkTrackerOptions {
  chunkSize?: number;
}

export interface BorderLayerChunkUpdate {
  changed: boolean;
  dirtyChunkIds: number[];
  dirtyEdgeIds: number[];
  allChunkIds: number[];
}

export interface BorderLayerChunkTracker {
  update(map: MapData, factions: readonly FactionSummary[]): BorderLayerChunkUpdate;
  reset(): void;
  getEdgeIdsForChunk(chunkId: number): readonly number[];
  getAllChunkIds(): readonly number[];
}

export function createBorderLayerChunkTracker(
  options: BorderLayerChunkTrackerOptions = {},
): BorderLayerChunkTracker {
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? DEFAULT_BORDER_CHUNK_SIZE));
  let previousMap: MapData | null = null;
  let previousEdgeVisuals = new Map<number, string>();
  let edgeChunkIds = new Map<number, number>();
  let chunkEdgeIds = new Map<number, number[]>();
  let allChunkIds: number[] = [];

  const rebuildChunks = (map: MapData) => {
    previousMap = map;
    edgeChunkIds = new Map();
    chunkEdgeIds = new Map();
    const columns = Math.max(1, Math.ceil(map.meta.bounds.width / chunkSize));

    for (let edgeId = 0; edgeId < map.borders.length; edgeId++) {
      const edge = map.borders[edgeId];
      const mx = (edge.a.x + edge.b.x) / 2;
      const my = (edge.a.y + edge.b.y) / 2;
      const cx = Math.max(0, Math.floor(mx / chunkSize));
      const cy = Math.max(0, Math.floor(my / chunkSize));
      const chunkId = cy * columns + cx;
      edgeChunkIds.set(edgeId, chunkId);
      const edges = chunkEdgeIds.get(chunkId);
      if (edges) {
        edges.push(edgeId);
      } else {
        chunkEdgeIds.set(chunkId, [edgeId]);
      }
    }

    allChunkIds = [...chunkEdgeIds.keys()].sort((a, b) => a - b);
  };

  return {
    update(map, factions) {
      if (previousMap !== map) {
        previousEdgeVisuals = new Map();
        rebuildChunks(map);
      }

      const colorByFaction = buildFactionColorMap(factions);
      const dirtyEdgeIds: number[] = [];
      const dirtyChunkIds = new Set<number>();
      const nextEdgeVisuals = new Map<number, string>();

      for (let edgeId = 0; edgeId < map.borders.length; edgeId++) {
        const visual = borderEdgeVisualKey(map, edgeId, colorByFaction);
        nextEdgeVisuals.set(edgeId, visual);
        if (previousEdgeVisuals.get(edgeId) === visual) continue;
        dirtyEdgeIds.push(edgeId);
        const chunkId = edgeChunkIds.get(edgeId);
        if (chunkId != null) dirtyChunkIds.add(chunkId);
      }

      previousEdgeVisuals = nextEdgeVisuals;
      return {
        changed: dirtyEdgeIds.length > 0,
        dirtyChunkIds: [...dirtyChunkIds].sort((a, b) => a - b),
        dirtyEdgeIds,
        allChunkIds,
      };
    },
    reset() {
      previousMap = null;
      previousEdgeVisuals = new Map();
      edgeChunkIds = new Map();
      chunkEdgeIds = new Map();
      allChunkIds = [];
    },
    getEdgeIdsForChunk(chunkId) {
      return chunkEdgeIds.get(chunkId) ?? [];
    },
    getAllChunkIds() {
      return allChunkIds;
    },
  };
}

function borderEdgeVisualKey(
  map: MapData,
  edgeId: number,
  colorByFaction: ReadonlyMap<number, string>,
): string {
  const edge = map.borders[edgeId];
  if (!edge) return 'missing';
  if (edge.right == null) return 'outer';

  const leftOwner = provinceDrawableOwner(map.provinces[edge.left as number]);
  const rightOwner = provinceDrawableOwner(map.provinces[edge.right as number]);
  if (leftOwner != null && rightOwner != null && leftOwner === rightOwner) return 'skip';
  if (leftOwner == null && rightOwner == null) return 'none';

  const refOwner = leftOwner ?? rightOwner;
  return `border:${refOwner ?? 'none'}:${refOwner == null ? '' : (colorByFaction.get(refOwner) ?? '')}`;
}

function provinceDrawableOwner(province: MapData['provinces'][number] | undefined): number | null {
  if (!province || province.terrain === 'ocean') return null;
  return province.ownerFactionId == null ? null : (province.ownerFactionId as number);
}

function buildFactionColorMap(factions: readonly FactionSummary[]): Map<number, string> {
  const colorByFaction = new Map<number, string>();
  for (const faction of factions) {
    colorByFaction.set(faction.id as number, faction.colorHex);
  }
  return colorByFaction;
}
