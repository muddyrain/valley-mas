import { describe, expect, it } from 'vitest';
import { BuildingType, EntityKind, Profession } from '@/shared/gameTypes';
import {
  animalAppearance,
  buildingAppearance,
  buildingKingdomColor,
  comfortableFocusZoom,
  humanAgeScale,
  humanAppearance,
  kingdomColor,
  orthographicLayout,
  resourceVisible,
} from './entityAppearance';

describe('top-down entity appearance', () => {
  it('gives residents a readable body, face and profession accent', () => {
    const farmer = humanAppearance(Profession.Farmer);
    const guard = humanAppearance(Profession.Guard);

    expect(farmer.skinColor).toMatch(/^#/);
    expect(farmer.bodyScale[1]).toBeGreaterThan(farmer.bodyScale[0]);
    expect(farmer.facing).toBe('screen-front');
    expect(farmer.headOffset).toBeLessThan(-farmer.bodyScale[1] / 2);
    expect(farmer.limbScale[1]).toBeGreaterThan(farmer.bodyScale[1]);
    expect(farmer.accentColor).not.toBe(guard.accentColor);
    expect(guard.headScale).toBeGreaterThan(0);
  });

  it('keeps children visibly smaller while adults share a stable pixel scale', () => {
    expect(humanAgeScale(0)).toBeLessThan(humanAgeScale(12));
    expect(humanAgeScale(12)).toBeLessThan(humanAgeScale(18));
    expect(humanAgeScale(18)).toBe(humanAgeScale(55));
  });

  it('uses a distinct silhouette and palette for every animal kind', () => {
    const kinds = [
      EntityKind.Chicken,
      EntityKind.Sheep,
      EntityKind.Cow,
      EntityKind.Deer,
      EntityKind.Wolf,
      EntityKind.Bear,
    ];
    const appearances = kinds.map(animalAppearance);

    expect(new Set(appearances.map((appearance) => appearance.bodyColor)).size).toBe(6);
    expect(new Set(appearances.map((appearance) => appearance.bodyScale.join(':'))).size).toBe(6);
    expect(appearances.every((appearance) => appearance.profile === 'screen-side')).toBe(true);
    expect(
      appearances.every((appearance) => appearance.bodyScale[0] > appearance.bodyScale[1]),
    ).toBe(true);
    expect(appearances.every((appearance) => appearance.headOffset > 0)).toBe(true);
    expect(appearances.every((appearance) => appearance.tailOffset < 0)).toBe(true);
    expect(animalAppearance(EntityKind.Bear).bodyScale[0]).toBeGreaterThan(
      animalAppearance(EntityKind.Wolf).bodyScale[0],
    );
    expect(animalAppearance(EntityKind.Deer).tailScale[0]).toBeGreaterThan(0);
  });

  it('shares kingdom identity across residents and buildings with a neutral fallback', () => {
    expect(kingdomColor(0)).toBe('#d8b987');
    expect(kingdomColor(1)).not.toBe(kingdomColor(2));
    expect(buildingKingdomColor(1, 0)).not.toBe(buildingKingdomColor(2, 0));
    expect(buildingKingdomColor(0, 0)).toBe('#c99b68');
  });

  it('uses distinct layered models for every building type', () => {
    const townCenter = buildingAppearance(BuildingType.TownCenter);
    const home = buildingAppearance(BuildingType.Home);
    const farm = buildingAppearance(BuildingType.Farm);
    const storage = buildingAppearance(BuildingType.Storage);
    const barracks = buildingAppearance(BuildingType.Barracks);
    const road = buildingAppearance(BuildingType.Road);

    expect(townCenter.footprint[0]).toBeGreaterThan(home.footprint[0]);
    expect(townCenter.roof[0]).toBeGreaterThan(storage.roof[0]);
    expect(farm.roof).toEqual([0, 0]);
    expect(farm.details).toHaveLength(3);
    expect(storage.details.map((detail) => detail.offset)).not.toEqual(
      barracks.details.map((detail) => detail.offset),
    );
    expect(road.footprint[0] / road.footprint[1]).toBeGreaterThan(3);
    expect(road.details).toHaveLength(1);
  });

  it('thins resource icons with a stable cell hash instead of frame randomness', () => {
    const treeCount = Array.from({ length: 1_000 }, (_, cell) =>
      resourceVisible(cell, 'wood', 20),
    ).filter(Boolean).length;

    expect(resourceVisible(42, 'wood', 0)).toBe(false);
    expect(resourceVisible(42, 'wood', 20)).toBe(resourceVisible(42, 'wood', 20));
    expect(treeCount).toBeGreaterThan(140);
    expect(treeCount).toBeLessThan(240);
    expect(resourceVisible(18, 'crop', 1)).toBe(true);
  });
});

describe('orthographic top-down layout', () => {
  it('centers the complete flat world without perspective tilt', () => {
    const layout = orthographicLayout(2_560, 1_155, 128);

    expect(layout.position).toEqual([64, 160, 64]);
    expect(layout.target).toEqual([64, 0, 64]);
    expect(layout.up).toEqual([0, 0, -1]);
    expect(layout.top).toBeGreaterThanOrEqual(64);
    expect(layout.top).toBeLessThanOrEqual(66);
    expect(layout.bottom).toBeLessThanOrEqual(-64);
    expect(layout.right - layout.left).toBeGreaterThan(128);
    expect(comfortableFocusZoom(128)).toBeGreaterThanOrEqual(5.8);
    expect(comfortableFocusZoom(128)).toBeLessThanOrEqual(6.2);
  });
});
