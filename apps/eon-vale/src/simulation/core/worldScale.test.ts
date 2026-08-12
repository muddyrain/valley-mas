import { describe, expect, it } from 'vitest';
import { ResourceNodeKind } from '@/shared/gameTypes';
import { loadWorldSave, serializeWorld } from '../persistence/save';
import { findNearestAvailableResourceNode } from '../resources/resourceNodes';
import { createWorldSimulation } from './worldSimulation';

describe('scalable finite worlds', () => {
  it.each([
    512, 768,
  ])('generates, indexes, saves and restores a %i-cell world without fixed-size assumptions', (mapSize) => {
    const simulation = createWorldSimulation({
      seed: `scale-${mapSize}`,
      initialHumans: 0,
      mapSize,
      preset: 'continent',
    });
    const { resourceNodes } = simulation.state;
    expect(resourceNodes.count).toBeGreaterThan(mapSize * mapSize * 0.1);
    expect(resourceNodes.count).toBeLessThan(mapSize * mapSize * 0.35);
    const nearest = findNearestAvailableResourceNode(
      resourceNodes,
      mapSize / 2,
      mapSize / 2,
      ResourceNodeKind.Tree,
      0,
      mapSize / 3,
    );
    expect(nearest).toBeGreaterThanOrEqual(0);

    const restored = loadWorldSave(serializeWorld(simulation.state));
    expect(restored.map.size).toBe(mapSize);
    expect(restored.resourceNodes.count).toBe(resourceNodes.count);
    expect(restored.resourceNodes.chunkHeads.some((nodeId) => nodeId >= 0)).toBe(true);
  }, 30_000);
});
