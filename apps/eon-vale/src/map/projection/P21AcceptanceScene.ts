import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, type RenderChunkPlan } from './MapProjection';

export type P21AcceptanceKind = 'rainforest' | 'wetland';

export const P21_ACCEPTANCE_WORLD = Object.freeze({
  templateId: 'continent',
  seed: 0x1a2b3c4d,
});

export const P21_ACCEPTANCE_CHUNKS = Object.freeze({
  rainforest: 147,
  wetland: 201,
});

export function isP21AcceptanceSnapshot(snapshot: WorldSnapshot): boolean {
  return (
    snapshot.metadata.templateId === P21_ACCEPTANCE_WORLD.templateId &&
    snapshot.metadata.seed === P21_ACCEPTANCE_WORLD.seed
  );
}

export function compileP21AcceptanceScene(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  kind: P21AcceptanceKind,
): RenderChunkPlan {
  if (!isP21AcceptanceSnapshot(snapshot)) {
    throw new Error('P2-1 acceptance fixtures require their fixed template and seed');
  }
  return compileChunkPlan(snapshot, catalog, P21_ACCEPTANCE_CHUNKS[kind]);
}
