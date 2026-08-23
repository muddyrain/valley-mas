import { describe, expect, it } from 'vitest';

import {
  CHUNK_COUNT,
  createWorldSnapshot,
  decodeHydrology,
  encodeHydrology,
  FlowDirection,
  ObjectFormTag,
  RiverClass,
  validateWorldSnapshot,
  WaterKind,
  WORLD_CELL_COUNT,
  WORLD_SIZE,
  type WorldSnapshotDraft,
} from './WorldSnapshot';

describe('WorldSnapshot', () => {
  it('creates the confirmed immutable authority contract with a deterministic identity', () => {
    const first = createWorldSnapshot(createDraft());
    const second = createWorldSnapshot(createDraft());

    expect(first.metadata.size).toBe(WORLD_SIZE);
    expect(first.metadata.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(first.metadata.snapshotId).toBe(`continent:481516:1:${first.metadata.checksum}`);
    expect(first.metadata).toEqual(second.metadata);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.metadata)).toBe(true);
    expect(validateWorldSnapshot(first)).toEqual([]);
  });

  it('detects authority column tampering through its checksum gate', () => {
    const snapshot = createWorldSnapshot(createDraft());
    snapshot.cells.biome[0] = 255;
    expect(validateWorldSnapshot(snapshot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'cells.biome.0' }),
        expect.objectContaining({ path: 'metadata.checksum' }),
      ]),
    );
  });

  it('packs river class and eight-way flow into the hydrology byte', () => {
    const packed = encodeHydrology(WaterKind.River, RiverClass.Main, FlowDirection.SouthWest);

    expect(decodeHydrology(packed)).toEqual({
      waterKind: WaterKind.River,
      riverClass: RiverClass.Main,
      flowDirection: FlowDirection.SouthWest,
    });
    expect(() => encodeHydrology(WaterKind.Ocean, RiverClass.Tributary)).toThrow();
  });

  it('accepts stable non-tree semantic families without tree form tags', () => {
    const chunkOffsets = new Uint32Array(CHUNK_COUNT + 1);
    chunkOffsets.fill(1, 1);
    const snapshot = createWorldSnapshot({
      ...createDraft(),
      objects: {
        objectIds: new Uint32Array([1]),
        anchorCells: new Uint32Array([10]),
        semanticFamilyIds: new Uint16Array([26]),
        formTags: new Uint16Array([0]),
        variantSeeds: new Uint32Array([42]),
        chunkOffsets,
      },
    });

    expect(validateWorldSnapshot(snapshot)).toEqual([]);
  });

  it('rejects objects that violate semantic tags or chunk ordering', () => {
    const chunkOffsets = new Uint32Array(CHUNK_COUNT + 1);
    chunkOffsets.fill(2, 1);
    const draft: WorldSnapshotDraft = {
      ...createDraft(),
      objects: {
        objectIds: new Uint32Array([2, 1]),
        anchorCells: new Uint32Array([10, 9]),
        semanticFamilyIds: new Uint16Array([1, 1]),
        formTags: new Uint16Array([
          ObjectFormTag.AgeMature | ObjectFormTag.HeightStandard,
          ObjectFormTag.AgeMature | ObjectFormTag.HeightStandard,
        ]),
        variantSeeds: new Uint32Array([20, 10]),
        chunkOffsets,
      },
    };

    expect(() => createWorldSnapshot(draft)).toThrow(/sorted by anchor Y/);
  });
});

function createDraft(): WorldSnapshotDraft {
  return {
    templateId: 'continent',
    seed: 481516,
    generatorVersion: 1,
    size: WORLD_SIZE,
    cells: {
      elevation: new Uint8Array(WORLD_CELL_COUNT),
      landform: new Uint8Array(WORLD_CELL_COUNT),
      hydrology: new Uint8Array(WORLD_CELL_COUNT),
      biome: new Uint8Array(WORLD_CELL_COUNT),
      groundMaterial: new Uint8Array(WORLD_CELL_COUNT),
      environmentTheme: new Uint8Array(WORLD_CELL_COUNT),
    },
    objects: {
      objectIds: new Uint32Array(0),
      anchorCells: new Uint32Array(0),
      semanticFamilyIds: new Uint16Array(0),
      formTags: new Uint16Array(0),
      variantSeeds: new Uint32Array(0),
      chunkOffsets: new Uint32Array(CHUNK_COUNT + 1),
    },
  };
}
