import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, type RenderChunkPlan } from './MapProjection';

export type P12AcceptanceKind = 'bridge' | 'elevation' | 'corruption';

export const P12_ACCEPTANCE_WORLD = Object.freeze({
  templateId: 'continent',
  seed: 0x1a2b3c4d,
});

export const P12_ACCEPTANCE_CHUNKS = Object.freeze({
  bridge: 180,
  elevation: 118,
  corruption: 166,
});

export function isP12AcceptanceSnapshot(snapshot: WorldSnapshot): boolean {
  return (
    snapshot.metadata.templateId === P12_ACCEPTANCE_WORLD.templateId &&
    snapshot.metadata.seed === P12_ACCEPTANCE_WORLD.seed
  );
}

export function findP12AcceptanceChunks(
  snapshot: WorldSnapshot,
): Readonly<Record<P12AcceptanceKind, number>> {
  if (!isP12AcceptanceSnapshot(snapshot)) {
    throw new Error('P1-2 acceptance fixtures require their fixed template and seed');
  }
  return P12_ACCEPTANCE_CHUNKS;
}

export function compileP12AcceptanceScene(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
  kind: P12AcceptanceKind,
): RenderChunkPlan {
  return compileChunkPlan(snapshot, catalog, findP12AcceptanceChunks(snapshot)[kind]);
}
