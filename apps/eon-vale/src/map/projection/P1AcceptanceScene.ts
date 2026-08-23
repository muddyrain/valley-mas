import { CHUNK_SIZE, CHUNKS_PER_AXIS, type WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, type RenderChunkPlan } from './MapProjection';

export const P1_TEMPERATE_COAST_SCENE = Object.freeze({
  templateId: 'continent',
  seed: 0x1a2b3c4d,
  chunkIndex: 74,
  chunkX: 640,
  chunkY: 256,
});

export function isP1TemperateCoastSnapshot(snapshot: WorldSnapshot): boolean {
  return (
    snapshot.metadata.templateId === P1_TEMPERATE_COAST_SCENE.templateId &&
    snapshot.metadata.seed === P1_TEMPERATE_COAST_SCENE.seed
  );
}

export function compileP1TemperateCoastScene(
  snapshot: WorldSnapshot,
  catalog: VisualCatalog,
): RenderChunkPlan {
  if (!isP1TemperateCoastSnapshot(snapshot)) {
    throw new Error('P1 temperate coast fixture requires its fixed template and seed');
  }
  const expectedIndex =
    (P1_TEMPERATE_COAST_SCENE.chunkY / CHUNK_SIZE) * CHUNKS_PER_AXIS +
    P1_TEMPERATE_COAST_SCENE.chunkX / CHUNK_SIZE;
  if (expectedIndex !== P1_TEMPERATE_COAST_SCENE.chunkIndex) {
    throw new Error('P1 temperate coast fixture coordinate is inconsistent');
  }
  return compileChunkPlan(snapshot, catalog, P1_TEMPERATE_COAST_SCENE.chunkIndex);
}
