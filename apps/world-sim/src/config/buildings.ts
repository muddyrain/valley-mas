import type { ResourceType } from '../world/testMap';

export type BuildingType = 'campfire' | 'hut' | 'warehouse' | 'farm';

export type BuildingDef = {
  id: BuildingType;
  name: string;
  hp: number;
  cost: Partial<Record<ResourceType, number>>;
  buildProgressRequired: number;
  color: number;
};

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  campfire: {
    id: 'campfire',
    name: '篝火',
    hp: 30,
    cost: {
      wood: 4,
    },
    buildProgressRequired: 50,
    color: 0xffcd75,
  },
  hut: {
    id: 'hut',
    name: '木屋',
    hp: 50,
    cost: {
      wood: 10,
    },
    buildProgressRequired: 100,
    color: 0xc0a080,
  },
  warehouse: {
    id: 'warehouse',
    name: '仓库',
    hp: 80,
    cost: {
      wood: 12,
      stone: 4,
    },
    buildProgressRequired: 130,
    color: 0x94b0c2,
  },
  farm: {
    id: 'farm',
    name: '农场',
    hp: 45,
    cost: {
      wood: 6,
    },
    buildProgressRequired: 80,
    color: 0x38b764,
  },
};
