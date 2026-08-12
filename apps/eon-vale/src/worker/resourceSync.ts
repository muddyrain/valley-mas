import type { ResourceNodeSnapshot } from '@/render/renderTypes';
import type { ResourceNodeStore } from '@/shared/gameTypes';

function snapshotNodes(
  store: ResourceNodeStore,
  nodeIds: Uint32Array,
  full: boolean,
): ResourceNodeSnapshot {
  const length = nodeIds.length;
  const active = new Uint8Array(length);
  const kind = new Uint8Array(length);
  const positionsX = new Float32Array(length);
  const positionsZ = new Float32Array(length);
  const amount = new Uint16Array(length);
  const stage = new Uint8Array(length);
  const variant = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    const nodeId = nodeIds[index] ?? 0;
    active[index] = store.active[nodeId] ?? 0;
    kind[index] = store.kind[nodeId] ?? 0;
    positionsX[index] = store.positionsX[nodeId] ?? 0;
    positionsZ[index] = store.positionsZ[nodeId] ?? 0;
    amount[index] = store.amount[nodeId] ?? 0;
    stage[index] = store.stage[nodeId] ?? 0;
    variant[index] = store.variant[nodeId] ?? 0;
  }
  return {
    full,
    count: store.count,
    nodeIds,
    active,
    kind,
    positionsX,
    positionsZ,
    amount,
    stage,
    variant,
  };
}

export function createFullResourceSnapshot(store: ResourceNodeStore): ResourceNodeSnapshot {
  const nodeIds = Uint32Array.from({ length: store.count }, (_, nodeId) => nodeId);
  store.dirtyNodeIds.length = 0;
  return snapshotNodes(store, nodeIds, true);
}

export function drainResourceNodeDelta(store: ResourceNodeStore): ResourceNodeSnapshot | null {
  if (store.dirtyNodeIds.length === 0) return null;
  const unique = [...new Set(store.dirtyNodeIds)].filter(
    (nodeId) => nodeId >= 0 && nodeId < store.count,
  );
  unique.sort((left, right) => left - right);
  store.dirtyNodeIds.length = 0;
  return snapshotNodes(store, Uint32Array.from(unique), false);
}
