import type { ServerResource } from '../api/resources';
import { DESKTOP_APP_LIST } from '../apps/desktopApps';
import {
  FINDER_SECTIONS,
  type FinderPath,
  finderIdForResource,
  getResourceSpotlightItems,
  PATH_LABEL,
} from '../finder/data';
import type { AppId } from '../store/windowStore';
import { evaluateCalcExpression } from '../tools/calc';

export type SpotlightKind = 'app' | 'folder' | 'resource' | 'calc' | 'web';

export interface SpotlightItem {
  id: string;
  kind: SpotlightKind;
  title: string;
  subtitle?: string;
  icon: string;
  keywords?: string[];
  // 命中后要做什么
  action:
    | { type: 'open-app'; appId: AppId }
    | { type: 'open-finder'; path: FinderPath; selectedId: string | null }
    | { type: 'calc'; expression: string; result: string }
    | { type: 'web-search'; query: string };
}

const APPS: SpotlightItem[] = [
  {
    id: 'app-finder',
    kind: 'app',
    title: 'Finder',
    subtitle: '应用程序 — 在线资源',
    icon: '/icons/finder.png',
    action: { type: 'open-finder', path: 'all', selectedId: null },
  },
  ...DESKTOP_APP_LIST.filter((app) => app.id !== 'finder').map((app) => ({
    id: `app-${app.id}`,
    kind: 'app' as const,
    title: app.title,
    subtitle: categoryLabel(app.category),
    icon: app.icon,
    keywords: app.keywords,
    action: { type: 'open-app' as const, appId: app.id },
  })),
];

const FOLDERS: SpotlightItem[] = [
  ...FINDER_SECTIONS.map((section) => ({
    id: `f-${section.path}`,
    kind: 'folder' as const,
    title: PATH_LABEL[section.path],
    subtitle: section.group === 'smart' ? 'Finder 智能分类' : 'Finder 资源库',
    icon: section.icon,
    action: { type: 'open-finder' as const, path: section.path, selectedId: null },
  })),
];

const RESOURCES: SpotlightItem[] = getResourceSpotlightItems().map((item) => ({
  id: `spotlight-${item.id}`,
  kind: 'resource',
  title: item.title,
  subtitle: item.subtitle,
  icon: item.icon,
  action: { type: 'open-finder', path: item.path, selectedId: item.id },
}));

export const SPOTLIGHT_INDEX: SpotlightItem[] = [...APPS, ...FOLDERS, ...RESOURCES];

function tryCalc(query: string): SpotlightItem | null {
  const calc = evaluateCalcExpression(query);
  if (!calc) return null;
  return {
    id: 'calc-result',
    kind: 'calc',
    title: calc.result,
    subtitle: `计算 — ${calc.expression}`,
    icon: '/icons/calculator.png',
    action: { type: 'calc', expression: calc.expression, result: calc.result },
  };
}

export function searchSpotlight(
  query: string,
  resources: ServerResource[] = [],
  limit = 8,
): SpotlightItem[] {
  const q = query.trim();
  if (!q) return [];

  const results: SpotlightItem[] = [];

  const calc = tryCalc(q);
  if (calc) results.push(calc);

  const lower = q.toLowerCase();
  const resourceItems: SpotlightItem[] = resources.map((resource) => ({
    id: `server-spotlight-${resource.id}`,
    kind: 'resource' as const,
    title: resource.title,
    subtitle: resource.description || resource.creatorName || '在线资源',
    icon: resource.thumbnailUrl || '/folders/cloud.png',
    keywords: resource.tags?.map((tag) => tag.name) ?? [],
    action: {
      type: 'open-finder' as const,
      path: 'all' as FinderPath,
      selectedId: finderIdForResource(resource.id),
    },
  }));

  for (const item of [...SPOTLIGHT_INDEX, ...resourceItems]) {
    if (
      item.title.toLowerCase().includes(lower) ||
      (item.subtitle ?? '').toLowerCase().includes(lower) ||
      (item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(lower))
    ) {
      results.push(item);
    }
    if (results.length >= limit) break;
  }

  if (results.length < limit) {
    results.push({
      id: 'web-search',
      kind: 'web',
      title: `搜索网页：${q}`,
      subtitle: '使用默认搜索引擎',
      icon: '/icons/safari.png',
      action: { type: 'web-search', query: q },
    });
  }

  return results;
}

function categoryLabel(category: string) {
  if (category === 'tool') return '小工具';
  if (category === 'game') return '小游戏';
  if (category === 'content') return '应用程序';
  return '系统应用';
}
