import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, type RenderChunkPlan } from './MapProjection';

export type P22AcceptanceKind = 'savanna' | 'desert';

export const P22_ACCEPTANCE_WORLD = Object.freeze({
  templateId: 'continent',
  seed: 8,
});

export const P22_ACCEPTANCE_CHUNKS = Object.freeze({
  savanna: 126,
  desert: 141,
});

export function isP22AcceptanceSnapshot(snapshot: WorldSnapshot): boolean {
  return (
    snapshot.metadata.templateId === P22_ACCEPTANCE_WORLD.templateId &&
    snapshot.metadata.seed === P22_ACCEPTANCE_WORLD.seed
  );
}

export function compileP22AcceptanceScene(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  kind: P22AcceptanceKind,
): RenderChunkPlan {
  if (!isP22AcceptanceSnapshot(snapshot)) {
    throw new Error('P2-2 acceptance fixtures require their fixed template and seed');
  }
  return compileChunkPlan(snapshot, catalog, P22_ACCEPTANCE_CHUNKS[kind]);
}
