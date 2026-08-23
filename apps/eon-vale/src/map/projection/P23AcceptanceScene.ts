import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, type RenderChunkPlan } from './MapProjection';

export type P23AcceptanceKind = 'tundra' | 'polar' | 'coldElevation';

export const P23_ACCEPTANCE_WORLD = Object.freeze({
  templateId: 'continent',
  seed: 8,
});

export const P23_ACCEPTANCE_CHUNKS = Object.freeze({
  tundra: 36,
  polar: 21,
  coldElevation: 38,
});

export function isP23AcceptanceSnapshot(snapshot: WorldSnapshot): boolean {
  return (
    snapshot.metadata.templateId === P23_ACCEPTANCE_WORLD.templateId &&
    snapshot.metadata.seed === P23_ACCEPTANCE_WORLD.seed
  );
}

export function compileP23AcceptanceScene(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  kind: P23AcceptanceKind,
): RenderChunkPlan {
  if (!isP23AcceptanceSnapshot(snapshot)) {
    throw new Error('P2-3 acceptance fixtures require their fixed template and seed');
  }
  return compileChunkPlan(snapshot, catalog, P23_ACCEPTANCE_CHUNKS[kind]);
}
