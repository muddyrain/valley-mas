import { BuildingType, EntityKind, ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import type { WorldViewLevel } from './strategicView';

interface PixelAssetProfile {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export const FORMAL_PIXEL_ASSETS = Object.freeze({
  resident: {
    width: 24,
    height: 32,
    anchorX: 0.5,
    anchorY: 1,
    directions: 4,
  },
  animal: { width: 24, height: 24, anchorX: 0.5, anchorY: 1, directions: 2 },
  largeAnimal: { width: 32, height: 24, anchorX: 0.5, anchorY: 1, directions: 2 },
  tree: { width: 32, height: 48, anchorX: 0.5, anchorY: 1 },
  building: { width: 48, height: 48, anchorX: 0.5, anchorY: 1 },
} as const satisfies Record<string, PixelAssetProfile & { directions?: number }>);

export interface AnimalVisualProfile {
  silhouette: string;
  colors: readonly [body: string, head: string, detail: string];
  large: boolean;
}

const ANIMAL_VISUAL_PROFILES: Record<Exclude<EntityKind, EntityKind.Human>, AnimalVisualProfile> = {
  [EntityKind.Chicken]: {
    silhouette: 'round-bird',
    colors: ['#f3ead1', '#d85d45', '#d5a443'],
    large: false,
  },
  [EntityKind.Sheep]: {
    silhouette: 'wool-cloud',
    colors: ['#eee5cf', '#88745d', '#51483e'],
    large: false,
  },
  [EntityKind.Cow]: {
    silhouette: 'broad-cattle',
    colors: ['#e8dcc2', '#5f4a3b', '#352c27'],
    large: true,
  },
  [EntityKind.Deer]: {
    silhouette: 'antler-runner',
    colors: ['#b47b45', '#8c5a35', '#382f28'],
    large: false,
  },
  [EntityKind.Wolf]: {
    silhouette: 'lean-predator',
    colors: ['#777d82', '#555e65', '#323a40'],
    large: false,
  },
  [EntityKind.Bear]: {
    silhouette: 'heavy-bear',
    colors: ['#805d42', '#6a4835', '#3f2d25'],
    large: true,
  },
  [EntityKind.Fish]: {
    silhouette: 'fork-tail-fish',
    colors: ['#4d9eb8', '#6db8ca', '#286f8b'],
    large: false,
  },
};

export function animalVisualProfile(kind: EntityKind): AnimalVisualProfile {
  return (
    ANIMAL_VISUAL_PROFILES[kind as Exclude<EntityKind, EntityKind.Human>] ??
    ANIMAL_VISUAL_PROFILES[EntityKind.Sheep]
  );
}

export interface BuildingVisualProfile {
  silhouette: string;
  role: 'civic' | 'home' | 'production' | 'storage' | 'defense' | 'infrastructure';
}

export const BUILDING_VISUAL_PROFILES: Record<BuildingType, BuildingVisualProfile> = {
  [BuildingType.TownCenter]: { silhouette: 'civic-hall-bell', role: 'civic' },
  [BuildingType.Home]: { silhouette: 'south-gable-home', role: 'home' },
  [BuildingType.Farm]: { silhouette: 'furrow-field', role: 'production' },
  [BuildingType.Storage]: { silhouette: 'raised-granary', role: 'storage' },
  [BuildingType.Barracks]: { silhouette: 'banner-longhouse', role: 'defense' },
  [BuildingType.Road]: { silhouette: 'stone-road', role: 'infrastructure' },
  [BuildingType.LoggingCamp]: { silhouette: 'timber-yard', role: 'production' },
  [BuildingType.Mine]: { silhouette: 'rock-adit', role: 'production' },
  [BuildingType.Workshop]: { silhouette: 'chimney-workshop', role: 'production' },
  [BuildingType.CouncilHall]: { silhouette: 'civic-hall-columns', role: 'civic' },
  [BuildingType.Wall]: { silhouette: 'crenellated-wall', role: 'defense' },
  [BuildingType.Watchtower]: { silhouette: 'banner-watchtower', role: 'defense' },
};

export interface VisualLodProfile {
  terrainPixelsPerCell: 1 | 4;
  entityMode: 'hidden' | 'sampled' | 'full';
  resourceMode: 'cluster' | 'simplified' | 'detailed';
  buildingMode: 'settlement-outline' | 'simplified' | 'detailed';
  fullEntityAnimation: boolean;
  splitTreeCanopy: boolean;
}

export const VISUAL_LOD_PROFILES: Record<WorldViewLevel, VisualLodProfile> = {
  world: {
    terrainPixelsPerCell: 1,
    entityMode: 'hidden',
    resourceMode: 'cluster',
    buildingMode: 'settlement-outline',
    fullEntityAnimation: false,
    splitTreeCanopy: false,
  },
  settlement: {
    terrainPixelsPerCell: 4,
    entityMode: 'sampled',
    resourceMode: 'simplified',
    buildingMode: 'simplified',
    fullEntityAnimation: false,
    splitTreeCanopy: false,
  },
  resident: {
    terrainPixelsPerCell: 4,
    entityMode: 'full',
    resourceMode: 'detailed',
    buildingMode: 'detailed',
    fullEntityAnimation: true,
    splitTreeCanopy: true,
  },
};

export interface ResourceVisualProfile {
  draw: VisualLodProfile['resourceMode'];
  splitCanopy: boolean;
}

export function resourceVisualProfile(
  kind: ResourceNodeKind,
  stage: ResourceNodeStage,
  level: WorldViewLevel,
): ResourceVisualProfile {
  const lod = VISUAL_LOD_PROFILES[level];
  return {
    draw: lod.resourceMode,
    splitCanopy:
      lod.splitTreeCanopy && kind === ResourceNodeKind.Tree && stage === ResourceNodeStage.Mature,
  };
}

export function selectedTreeCanopyAlpha(
  treeX: number,
  treeZ: number,
  selectedX?: number,
  selectedZ?: number,
): number {
  if (selectedX === undefined || selectedZ === undefined) return 1;
  const depth = treeZ - selectedZ;
  return Math.abs(treeX - selectedX) <= 1.75 && depth >= 0.75 && depth <= 2.75 ? 0.28 : 1;
}
