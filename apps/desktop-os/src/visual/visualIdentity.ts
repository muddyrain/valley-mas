import type { DesktopApp, DesktopAppCategory, DesktopAppId } from '../apps/desktopApps';
import type { FinderItem, FinderPath } from '../finder/data';

export type CompanionId = 'resource' | 'mail' | 'weather' | 'music' | 'tool' | 'collect';
export type RarityTone = 'common' | 'fine' | 'rare' | 'legendary';
export type VisualGroup = 'system' | 'content' | 'tool' | 'game';

export const COMPANION_SHEET = '/companions/valley-companions-v1.png';
export const BADGE_SHEET = '/badges/collectible-badges-v1.png';
export const SCENE_PREMIUM_VALLEY = '/scenes/premium-cozy-valley-v1.png';

export interface VisualIdentity {
  companionId: CompanionId;
  rarityTone: RarityTone;
  visualGroup: VisualGroup;
}

const CATEGORY_COMPANIONS: Record<DesktopAppCategory, CompanionId> = {
  system: 'collect',
  content: 'resource',
  tool: 'tool',
  game: 'collect',
};

const APP_VISUALS: Partial<Record<DesktopAppId, VisualIdentity>> = {
  finder: { companionId: 'resource', rarityTone: 'legendary', visualGroup: 'system' },
  mail: { companionId: 'mail', rarityTone: 'rare', visualGroup: 'content' },
  weather: { companionId: 'weather', rarityTone: 'rare', visualGroup: 'tool' },
  music: { companionId: 'music', rarityTone: 'fine', visualGroup: 'content' },
  downloads: { companionId: 'resource', rarityTone: 'fine', visualGroup: 'system' },
  safari: { companionId: 'resource', rarityTone: 'fine', visualGroup: 'system' },
  aiTools: { companionId: 'collect', rarityTone: 'legendary', visualGroup: 'tool' },
  notes: { companionId: 'collect', rarityTone: 'fine', visualGroup: 'tool' },
  account: { companionId: 'mail', rarityTone: 'fine', visualGroup: 'system' },
  settings: { companionId: 'tool', rarityTone: 'rare', visualGroup: 'system' },
};

const FINDER_PATH_VISUALS: Record<FinderPath, VisualIdentity> = {
  all: { companionId: 'resource', rarityTone: 'legendary', visualGroup: 'system' },
  favorites: { companionId: 'collect', rarityTone: 'rare', visualGroup: 'content' },
  recent: { companionId: 'resource', rarityTone: 'fine', visualGroup: 'content' },
  downloads: { companionId: 'resource', rarityTone: 'fine', visualGroup: 'system' },
  ai: { companionId: 'collect', rarityTone: 'legendary', visualGroup: 'tool' },
  design: { companionId: 'music', rarityTone: 'rare', visualGroup: 'content' },
  development: { companionId: 'tool', rarityTone: 'rare', visualGroup: 'tool' },
  inspiration: { companionId: 'collect', rarityTone: 'legendary', visualGroup: 'content' },
};

export function getAppVisualIdentity(app: Pick<DesktopApp, 'id' | 'category'>): VisualIdentity {
  return (
    APP_VISUALS[app.id] ?? {
      companionId: CATEGORY_COMPANIONS[app.category],
      rarityTone: app.category === 'game' ? 'rare' : 'common',
      visualGroup: app.category,
    }
  );
}

export function getFinderPathVisualIdentity(path: FinderPath): VisualIdentity {
  return FINDER_PATH_VISUALS[path];
}

export function getFinderItemVisualIdentity(item: FinderItem): VisualIdentity {
  if (item.isFavorited)
    return { companionId: 'collect', rarityTone: 'rare', visualGroup: 'content' };
  if (item.kind === 'note') return { companionId: 'tool', rarityTone: 'fine', visualGroup: 'tool' };
  if (item.tags?.some((tag) => /design|ui|visual|figma|视觉|设计/i.test(tag))) {
    return { companionId: 'music', rarityTone: 'rare', visualGroup: 'content' };
  }
  if (item.tags?.some((tag) => /ai|prompt|chat|模型|提示词/i.test(tag))) {
    return { companionId: 'collect', rarityTone: 'legendary', visualGroup: 'tool' };
  }
  return {
    companionId: 'resource',
    rarityTone: item.previewImage ? 'rare' : 'fine',
    visualGroup: 'system',
  };
}

export function rarityLabel(rarity: RarityTone) {
  switch (rarity) {
    case 'common':
      return '普通';
    case 'fine':
      return '精致';
    case 'rare':
      return '稀有';
    case 'legendary':
      return '传说';
  }
}
