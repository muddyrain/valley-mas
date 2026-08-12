export type WorldLawCategory = 'life' | 'ecology' | 'civilization' | 'diplomacy' | 'nature';
export type RuleDecisionStatus = 'accepted' | 'unresolved';
export type WorldLawAvailability = 'active' | 'planned';
export type WorldLawDisablePolicy =
  | 'block-future'
  | 'finish-committed'
  | 'stop-harm'
  | 'withdraw-and-force-peace';

export interface WorldLawDefinition {
  category: WorldLawCategory;
  title: string;
  description: string;
  defaultEnabled: boolean;
  decisionStatus: RuleDecisionStatus;
  availability: WorldLawAvailability;
  disablePolicy: WorldLawDisablePolicy;
  scope: string;
  exceptions: readonly string[];
}

export const WORLD_LAW_CATALOG = {
  hunger: {
    category: 'life',
    title: '饥饿',
    description: '人类与动物需要食物，长期饥饿会损伤并最终死亡。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'block-future',
    scope: 'starvation damage and death',
    exceptions: [],
  },
  naturalOldAge: {
    category: 'life',
    title: '自然老死',
    description: '人类与动物会随年龄增长而自然死亡。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'block-future',
    scope: 'age-caused death',
    exceptions: [],
  },
  humanReproduction: {
    category: 'civilization',
    title: '人类繁衍',
    description: '满足伴侣、营养、住房和安全条件的家庭可以生育。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'finish-committed',
    scope: 'natural human conception',
    exceptions: ['direct-human-spawn-power'],
  },
  animalReproduction: {
    category: 'ecology',
    title: '动物繁衍',
    description: '满足年龄、食物和栖息地容量条件的动物可以繁殖。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'finish-committed',
    scope: 'natural animal conception',
    exceptions: ['direct-animal-spawn-power'],
  },
  animalPredation: {
    category: 'ecology',
    title: '动物捕食',
    description: '饥饿的捕食者可以追猎适合的猎物。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'stop-harm',
    scope: 'animal hunting and predation damage',
    exceptions: ['human-hunting'],
  },
  naturalAnimalReturn: {
    category: 'ecology',
    title: '动物自然回归',
    description: '曾经出现过的物种在数量过低且存在适生环境时，可以小群重新出现。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'active',
    disablePolicy: 'block-future',
    scope: 'ambient return of previously present species',
    exceptions: ['direct-animal-spawn-power'],
  },
  kingdomExpansion: {
    category: 'civilization',
    title: '王国扩张',
    description: '满足人口、家庭与资源条件的聚落可以迁居并建立新聚落。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'finish-committed',
    scope: 'ai settlement expansion',
    exceptions: [],
  },
  diplomacyAndWar: {
    category: 'diplomacy',
    title: '外交与战争',
    description: '王国可以结盟、宣战、议和并征服聚落。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'withdraw-and-force-peace',
    scope: 'war declarations and combat damage',
    exceptions: ['peace-power'],
  },
  naturalDisasters: {
    category: 'nature',
    title: '自然灾害',
    description: '世界可以按自然规则发生会影响环境与生命的灾害。',
    defaultEnabled: true,
    decisionStatus: 'accepted',
    availability: 'planned',
    disablePolicy: 'block-future',
    scope: 'ambient disaster generation',
    exceptions: ['direct-disaster-powers'],
  },
  civilizationRestart: {
    category: 'civilization',
    title: '文明重启',
    description: '人类灭绝足够久后，迎来一批新的文明奠基者。',
    defaultEnabled: false,
    decisionStatus: 'accepted',
    availability: 'active',
    disablePolicy: 'block-future',
    scope: 'post-extinction founder spawn',
    exceptions: ['direct-human-spawn-power'],
  },
} as const satisfies Record<string, WorldLawDefinition>;

export type WorldLawId = keyof typeof WORLD_LAW_CATALOG;
export type WorldLaws = { [Law in WorldLawId]: boolean };

export const WORLD_LAW_IDS = Object.freeze(Object.keys(WORLD_LAW_CATALOG) as WorldLawId[]);

export const WORLD_LAW_UI_IDS = Object.freeze(
  WORLD_LAW_IDS.filter((law) => WORLD_LAW_CATALOG[law].availability === 'active'),
);

export function createDefaultWorldLaws(): WorldLaws {
  return Object.fromEntries(
    WORLD_LAW_IDS.map((law) => [law, WORLD_LAW_CATALOG[law].defaultEnabled]),
  ) as WorldLaws;
}

export function isWorldLawId(value: string): value is WorldLawId {
  return Object.hasOwn(WORLD_LAW_CATALOG, value);
}
