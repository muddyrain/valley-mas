import {
  AgentState,
  BuildingType,
  DiplomacyState,
  EntityKind,
  Profession,
  VillageTier,
} from '@/shared/gameTypes';

export const ENTITY_LABELS: Record<number, string> = {
  [EntityKind.Human]: '人类',
  [EntityKind.Chicken]: '鸡',
  [EntityKind.Sheep]: '羊',
  [EntityKind.Cow]: '牛',
  [EntityKind.Deer]: '鹿',
  [EntityKind.Wolf]: '狼',
  [EntityKind.Bear]: '熊',
  [EntityKind.Fish]: '鱼',
};

export const STATE_LABELS: Record<number, string> = {
  [AgentState.Idle]: '观察四周',
  [AgentState.Wander]: '探索',
  [AgentState.FindFood]: '寻找食物',
  [AgentState.Eat]: '进食',
  [AgentState.Rest]: '休息',
  [AgentState.GatherWood]: '采集木材',
  [AgentState.GatherStone]: '开采石料',
  [AgentState.Farm]: '耕作',
  [AgentState.Haul]: '搬运物资',
  [AgentState.Build]: '建造',
  [AgentState.Repair]: '修复',
  [AgentState.Flee]: '逃离危险',
  [AgentState.Guard]: '守卫',
  [AgentState.Chase]: '追击',
  [AgentState.Attack]: '战斗',
  [AgentState.Home]: '回家',
};

export const PROFESSION_LABELS: Record<number, string> = {
  [Profession.Forager]: '采集者',
  [Profession.Woodcutter]: '伐木工',
  [Profession.Miner]: '矿工',
  [Profession.Farmer]: '农夫',
  [Profession.Builder]: '建造者',
  [Profession.Hauler]: '搬运工',
  [Profession.Guard]: '守卫',
  [Profession.Blacksmith]: '铁匠',
  [Profession.Hunter]: '猎人',
  [Profession.Shepherd]: '牧人',
};

export const TIER_LABELS: Record<number, string> = {
  [VillageTier.Camp]: '营地',
  [VillageTier.Hamlet]: '村落',
  [VillageTier.Town]: '城镇',
  [VillageTier.CityState]: '城邦',
};

export const BUILDING_LABELS: Record<number, string> = {
  [BuildingType.TownCenter]: '城镇中心',
  [BuildingType.Home]: '住宅',
  [BuildingType.Farm]: '农田',
  [BuildingType.Storage]: '仓库',
  [BuildingType.Barracks]: '兵营',
  [BuildingType.Road]: '道路',
  [BuildingType.LoggingCamp]: '伐木场',
  [BuildingType.Mine]: '矿场',
  [BuildingType.Workshop]: '工坊',
  [BuildingType.CouncilHall]: '议事厅',
  [BuildingType.Wall]: '城墙',
  [BuildingType.Watchtower]: '哨塔',
};

export const DIPLOMACY_LABELS: Record<number, string> = {
  [DiplomacyState.Peace]: '和平',
  [DiplomacyState.Alliance]: '结盟',
  [DiplomacyState.War]: '战争',
};
