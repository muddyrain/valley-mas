import { BuildingType, EntityKind, Profession } from '@/shared/gameTypes';

export interface HumanAppearance {
  facing: 'screen-front';
  skinColor: string;
  hairColor: string;
  accentColor: string;
  bodyScale: readonly [number, number];
  headScale: number;
  headOffset: number;
  limbScale: readonly [number, number];
}

export interface AnimalAppearance {
  profile: 'screen-side';
  bodyColor: string;
  headColor: string;
  detailColor: string;
  bodyScale: readonly [number, number];
  headScale: readonly [number, number];
  headOffset: number;
  tailScale: readonly [number, number];
  tailOffset: number;
}

export interface OrthographicLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  up: readonly [number, number, number];
}

export interface BuildingDetail {
  scale: readonly [number, number];
  offset: readonly [number, number];
  color: string;
}

export interface BuildingAppearance {
  footprint: readonly [number, number];
  roof: readonly [number, number];
  roofLightness: number;
  details: readonly BuildingDetail[];
}

export type ResourceKind = 'wood' | 'stone' | 'food' | 'crop';

const PROFESSION_ACCENTS: Record<Profession, string> = {
  [Profession.Forager]: '#d9a34b',
  [Profession.Woodcutter]: '#7a5537',
  [Profession.Miner]: '#798b94',
  [Profession.Farmer]: '#75a84f',
  [Profession.Builder]: '#d47e42',
  [Profession.Hauler]: '#9b7559',
  [Profession.Guard]: '#505b72',
  [Profession.Blacksmith]: '#6d7780',
  [Profession.Hunter]: '#596f45',
  [Profession.Shepherd]: '#bca66d',
};

const KINGDOM_COLORS = [
  '#d8b987',
  '#cf604d',
  '#4d82c4',
  '#c5a13e',
  '#64a157',
  '#9168b8',
  '#3e9a8e',
];

const NEUTRAL_BUILDINGS: Record<BuildingType, string> = {
  [BuildingType.TownCenter]: '#c99b68',
  [BuildingType.Home]: '#b9825d',
  [BuildingType.Farm]: '#afa44f',
  [BuildingType.Storage]: '#9e7455',
  [BuildingType.Barracks]: '#8f665d',
  [BuildingType.Road]: '#8f8069',
  [BuildingType.LoggingCamp]: '#8a6547',
  [BuildingType.Mine]: '#73756f',
  [BuildingType.Workshop]: '#906d55',
  [BuildingType.CouncilHall]: '#c99b68',
  [BuildingType.Wall]: '#85877f',
  [BuildingType.Watchtower]: '#8f7355',
};

export function humanAppearance(profession: Profession): HumanAppearance {
  return {
    facing: 'screen-front',
    skinColor: '#efc7a1',
    hairColor: '#3f3028',
    accentColor: PROFESSION_ACCENTS[profession] ?? PROFESSION_ACCENTS[Profession.Forager],
    bodyScale: [0.62, 0.7],
    headScale: 0.46,
    headOffset: -0.54,
    limbScale: [0.92, 1.34],
  };
}

export function animalAppearance(kind: EntityKind): AnimalAppearance {
  if (kind === EntityKind.Chicken)
    return {
      profile: 'screen-side',
      bodyColor: '#f3ead1',
      headColor: '#d85d45',
      detailColor: '#d5a443',
      bodyScale: [0.76, 0.68],
      headScale: [0.36, 0.38],
      headOffset: 0.42,
      tailScale: [0.2, 0.28],
      tailOffset: -0.44,
    };
  if (kind === EntityKind.Cow)
    return {
      profile: 'screen-side',
      bodyColor: '#e8dcc2',
      headColor: '#5f4a3b',
      detailColor: '#352c27',
      bodyScale: [1.35, 0.72],
      headScale: [0.48, 0.45],
      headOffset: 0.7,
      tailScale: [0.2, 0.38],
      tailOffset: -0.76,
    };
  if (kind === EntityKind.Deer)
    return {
      profile: 'screen-side',
      bodyColor: '#b47b45',
      headColor: '#8c5a35',
      detailColor: '#382f28',
      bodyScale: [1.16, 0.62],
      headScale: [0.4, 0.43],
      headOffset: 0.62,
      tailScale: [0.18, 0.22],
      tailOffset: -0.68,
    };
  if (kind === EntityKind.Wolf)
    return {
      profile: 'screen-side',
      bodyColor: '#777d82',
      headColor: '#555e65',
      detailColor: '#323a40',
      bodyScale: [1.1, 0.56],
      headScale: [0.42, 0.4],
      headOffset: 0.58,
      tailScale: [0.32, 0.38],
      tailOffset: -0.66,
    };
  if (kind === EntityKind.Bear)
    return {
      profile: 'screen-side',
      bodyColor: '#805d42',
      headColor: '#6a4835',
      detailColor: '#3f2d25',
      bodyScale: [1.42, 0.88],
      headScale: [0.58, 0.54],
      headOffset: 0.72,
      tailScale: [0.22, 0.22],
      tailOffset: -0.72,
    };
  if (kind === EntityKind.Fish)
    return {
      profile: 'screen-side',
      bodyColor: '#4d9eb8',
      headColor: '#6db8ca',
      detailColor: '#286f8b',
      bodyScale: [1, 0.44],
      headScale: [0.34, 0.3],
      headOffset: 0.42,
      tailScale: [0.46, 0.4],
      tailOffset: -0.62,
    };
  return {
    profile: 'screen-side',
    bodyColor: '#eee5cf',
    headColor: '#88745d',
    detailColor: '#51483e',
    bodyScale: [1.08, 0.66],
    headScale: [0.42, 0.4],
    headOffset: 0.54,
    tailScale: [0.22, 0.24],
    tailOffset: -0.62,
  };
}

export function kingdomColor(kingdomId: number): string {
  if (kingdomId <= 0) return KINGDOM_COLORS[0] ?? '#d8b987';
  return KINGDOM_COLORS[((kingdomId - 1) % (KINGDOM_COLORS.length - 1)) + 1] ?? '#d8b987';
}

export function buildingKingdomColor(kingdomId: number, type: BuildingType): string {
  if (kingdomId <= 0) return NEUTRAL_BUILDINGS[type] ?? NEUTRAL_BUILDINGS[BuildingType.Home];
  const factor =
    type === BuildingType.TownCenter
      ? 1.12
      : type === BuildingType.Farm
        ? 1.18
        : type === BuildingType.Barracks
          ? 0.72
          : type === BuildingType.Road
            ? 0.64
            : type === BuildingType.Storage
              ? 0.82
              : 0.96;
  return shadeHex(kingdomColor(kingdomId), factor);
}

export function buildingAppearance(type: BuildingType): BuildingAppearance {
  if (type === BuildingType.TownCenter)
    return {
      footprint: [2.6, 2.6],
      roof: [1.92, 1.92],
      roofLightness: 0.42,
      details: [
        { scale: [0.3, 1.6], offset: [0, 0], color: '#fff0bf' },
        { scale: [1.6, 0.3], offset: [0, 0], color: '#fff0bf' },
        { scale: [0.54, 0.38], offset: [0, 1.05], color: '#5f4635' },
      ],
    };
  if (type === BuildingType.Home)
    return {
      footprint: [1.62, 1.5],
      roof: [1.18, 1.04],
      roofLightness: 0.34,
      details: [
        { scale: [0.18, 0.92], offset: [0, 0], color: '#fff0c2' },
        { scale: [0.34, 0.26], offset: [0, 0.63], color: '#5c4032' },
      ],
    };
  if (type === BuildingType.Farm)
    return {
      footprint: [2.5, 2.28],
      roof: [0, 0],
      roofLightness: 0,
      details: [
        { scale: [1.9, 0.24], offset: [0, -0.62], color: '#596f3b' },
        { scale: [1.9, 0.24], offset: [0, 0], color: '#718c46' },
        { scale: [1.9, 0.24], offset: [0, 0.62], color: '#596f3b' },
      ],
    };
  if (type === BuildingType.Storage)
    return {
      footprint: [1.95, 1.82],
      roof: [1.5, 1.36],
      roofLightness: 0.28,
      details: [
        { scale: [0.88, 0.2], offset: [0, -0.22], color: '#f1d79d' },
        { scale: [0.88, 0.2], offset: [0, 0.22], color: '#f1d79d' },
        { scale: [0.36, 0.3], offset: [0, 0.72], color: '#513b2f' },
      ],
    };
  if (type === BuildingType.Barracks)
    return {
      footprint: [2.4, 1.92],
      roof: [1.86, 1.38],
      roofLightness: 0.22,
      details: [
        { scale: [0.22, 1.06], offset: [-0.5, 0], color: '#f3d69b' },
        { scale: [0.22, 1.06], offset: [0.5, 0], color: '#f3d69b' },
        { scale: [0.46, 0.34], offset: [0, 0.78], color: '#4c3935' },
      ],
    };
  return {
    footprint: [2.5, 0.64],
    roof: [0, 0],
    roofLightness: 0,
    details: [{ scale: [1.92, 0.12], offset: [0, 0], color: '#d1bea0' }],
  };
}

export function resourceVisible(cell: number, kind: ResourceKind, amount: number): boolean {
  if (amount <= 0) return false;
  if (kind === 'crop') return true;
  const threshold = kind === 'wood' ? 19 : kind === 'stone' ? 15 : 13;
  let hash = (cell + 0x9e3779b9) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97) >>> 0;
  hash = (hash ^ (hash >>> 15)) >>> 0;
  return hash % 100 < threshold;
}

export function humanAgeScale(age: number): number {
  if (age < 6) return 0.62;
  if (age < 14) return 0.8;
  return 1;
}

export function comfortableFocusZoom(worldSize: number): number {
  return Math.max(5.8, Math.min(6.2, worldSize / 21));
}

export function orthographicLayout(
  width: number,
  height: number,
  worldSize: number,
): OrthographicLayout {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const halfHeight = worldSize * 0.51;
  const halfWidth = halfHeight * aspect;
  const center = worldSize / 2;
  return {
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
    bottom: -halfHeight,
    position: [center, 160, center],
    target: [center, 0, center],
    up: [0, 0, -1],
  };
}

function shadeHex(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 0xff) * factor)));
  return `#${channel(16).toString(16).padStart(2, '0')}${channel(8)
    .toString(16)
    .padStart(2, '0')}${channel(0).toString(16).padStart(2, '0')}`;
}
