import { describe, expect, it } from 'vitest';
import { BuildingType, EntityKind, ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import {
  animalVisualProfile,
  BUILDING_VISUAL_PROFILES,
  FORMAL_PIXEL_ASSETS,
  resourceVisualProfile,
  selectedTreeCanopyAlpha,
  VISUAL_LOD_PROFILES,
} from './fullWorldVisuals';

describe('fifth-batch full-world visual rollout', () => {
  it('locks the accepted formal pixel sample sizes and anchors', () => {
    expect(FORMAL_PIXEL_ASSETS.resident).toMatchObject({
      width: 24,
      height: 32,
      anchorX: 0.5,
      anchorY: 1,
      directions: 4,
    });
    expect(FORMAL_PIXEL_ASSETS.animal).toMatchObject({ height: 24, anchorY: 1 });
    expect(FORMAL_PIXEL_ASSETS.tree).toMatchObject({ width: 32, height: 48, anchorY: 1 });
    expect(FORMAL_PIXEL_ASSETS.building).toMatchObject({ width: 48, height: 48, anchorY: 1 });
  });

  it('covers all seven accepted animal species with dedicated silhouettes', () => {
    const animals = [
      EntityKind.Chicken,
      EntityKind.Sheep,
      EntityKind.Cow,
      EntityKind.Deer,
      EntityKind.Wolf,
      EntityKind.Bear,
      EntityKind.Fish,
    ];
    expect(new Set(animals.map((kind) => animalVisualProfile(kind).silhouette)).size).toBe(7);
  });

  it('covers all twelve building types with intentional visual profiles', () => {
    const types = Object.values(BuildingType).filter(
      (value): value is BuildingType => typeof value === 'number',
    );
    expect(types).toHaveLength(12);
    expect(types.every((type) => BUILDING_VISUAL_PROFILES[type] !== undefined)).toBe(true);
    expect(new Set(types.map((type) => BUILDING_VISUAL_PROFILES[type].silhouette)).size).toBe(12);
  });

  it('uses dedicated world, settlement and resident LOD presentations', () => {
    expect(VISUAL_LOD_PROFILES.world).toMatchObject({ terrainPixelsPerCell: 1 });
    expect(VISUAL_LOD_PROFILES.settlement).toMatchObject({ terrainPixelsPerCell: 4 });
    expect(VISUAL_LOD_PROFILES.resident).toMatchObject({
      terrainPixelsPerCell: 4,
      fullEntityAnimation: true,
      splitTreeCanopy: true,
    });
  });

  it('only enables split canopy occlusion for detailed living trees', () => {
    expect(
      resourceVisualProfile(ResourceNodeKind.Tree, ResourceNodeStage.Mature, 'resident'),
    ).toMatchObject({ draw: 'detailed', splitCanopy: true });
    expect(
      resourceVisualProfile(ResourceNodeKind.Tree, ResourceNodeStage.Sapling, 'resident'),
    ).toMatchObject({ splitCanopy: false });
    expect(
      resourceVisualProfile(ResourceNodeKind.Stone, ResourceNodeStage.Mature, 'resident'),
    ).toMatchObject({ splitCanopy: false });
    expect(
      resourceVisualProfile(ResourceNodeKind.Tree, ResourceNodeStage.Mature, 'world'),
    ).toMatchObject({ draw: 'cluster', splitCanopy: false });
  });

  it('only fades front canopy that locally obstructs the selected resident', () => {
    expect(selectedTreeCanopyAlpha(10, 12, 10.5, 10)).toBeLessThan(1);
    expect(selectedTreeCanopyAlpha(10, 12, 15, 10)).toBe(1);
    expect(selectedTreeCanopyAlpha(10, 12, 10.5, 14)).toBe(1);
    expect(selectedTreeCanopyAlpha(10, 12)).toBe(1);
  });
});
