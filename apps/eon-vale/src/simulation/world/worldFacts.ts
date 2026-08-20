export type WorldSize = 128 | 256 | 384;
export type WorldPreset = 'archipelago' | 'continent' | 'ocean';

export enum ElevationBand {
  DeepOcean = 0,
  ShallowWater = 1,
  Land = 2,
  Mountain = 3,
}

export enum SurfaceHabitat {
  Sand = 0,
  Grassland = 1,
  WoodlandSoil = 2,
  Desert = 3,
  Snow = 4,
}

export interface NaturalContentOptions {
  vegetation: boolean;
  resources: boolean;
  animals: boolean;
}

export interface SettleableRegion {
  centerCell: number;
  buildableCells: number;
  nearbyTrees: number;
  nearbyWildFood: number;
  nearbyStone: number;
  nearbyMetal: number;
}

export interface WorldRepairRecord {
  centerCell: number;
  terrainCells: number[];
  resourceCells: number[];
}

export interface SettleabilityReport {
  requiredRegions: number;
  regions: SettleableRegion[];
  repairs: WorldRepairRecord[];
}

export interface WorldFacts {
  size: WorldSize;
  preset: WorldPreset;
  elevation: Float32Array;
  surface: Uint8Array;
  moisture: Uint8Array;
  temperature: Uint8Array;
  naturalContent: NaturalContentOptions;
  revision: number;
  dirtyCells: number[];
  settleability: SettleabilityReport;
}

export const DEFAULT_NATURAL_CONTENT: Readonly<NaturalContentOptions> = Object.freeze({
  vegetation: true,
  resources: true,
  animals: true,
});

export function requiredSettleableRegions(size: WorldSize): number {
  if (size === 128) return 2;
  if (size === 256) return 4;
  return 6;
}

export function elevationBandAt(elevation: number): ElevationBand {
  if (elevation < -0.96) return ElevationBand.DeepOcean;
  if (elevation < 0.12) return ElevationBand.ShallowWater;
  if (elevation > 3.84) return ElevationBand.Mountain;
  return ElevationBand.Land;
}

export function isBuildableCell(world: WorldFacts, cell: number): boolean {
  return elevationBandAt(world.elevation[cell] ?? -4) === ElevationBand.Land;
}
