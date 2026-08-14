import {
  BookOpen,
  FileImage,
  FilePlus2,
  Gamepad2,
  ImagePlus,
  type LucideIcon,
  Shapes,
  Wrench,
} from 'lucide-react';
import { navigationGroups } from '@/layouts/navigation';

export type SearchCommandCategory = 'pages' | 'create' | 'personal';

export interface SearchCommand {
  id: string;
  title: string;
  path: string;
  category: SearchCommandCategory;
  keywords: readonly string[];
  icon: LucideIcon;
  authOnly: boolean;
}

const AUTH_ONLY_NAV_PATHS = new Set(['/studio', '/workbench']);

const NAV_KEYWORDS: Record<string, readonly string[]> = {
  '/': ['主页', '内容首页', 'home'],
  '/articles': ['博客', '图文', '内容', 'blog'],
  '/gallery': ['壁纸', '动漫图片', '风景图片', 'resource'],
  '/studio': ['写作', '文章草稿', '图片导入', 'AI 图片', 'studio'],
  '/workbench': ['AI', 'agent', '工作流', '技能', '知识库'],
};

const navigationCommands: SearchCommand[] = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({
    id: `nav:${item.to}`,
    title: item.label,
    path: item.to,
    category: AUTH_ONLY_NAV_PATHS.has(item.to) ? ('create' as const) : ('pages' as const),
    keywords: NAV_KEYWORDS[item.to] ?? [],
    icon: item.icon,
    authOnly: AUTH_ONLY_NAV_PATHS.has(item.to),
  })),
);

const additionalCommands: SearchCommand[] = [
  {
    id: 'page:format-tools',
    title: '格式转换工具',
    path: '/tools/format',
    category: 'pages',
    keywords: ['格式', '转换', 'format', '工具'],
    icon: Wrench,
    authOnly: false,
  },
  {
    id: 'page:climber-lab',
    title: '玩具攀爬实验场',
    path: '/labs/climber',
    category: 'pages',
    keywords: ['玩具', '攀爬', '实验', 'game', 'climber'],
    icon: Gamepad2,
    authOnly: false,
  },
  {
    id: 'page:scratch-legend',
    title: '刮刮传说',
    path: '/labs/scratch-legend',
    category: 'pages',
    keywords: ['刮刮卡', '游戏', 'scratch', 'legend'],
    icon: Shapes,
    authOnly: false,
  },
  {
    id: 'personal:posts',
    title: '文章草稿',
    path: '/studio/articles',
    category: 'personal',
    keywords: ['文章管理', '图文管理', 'posts', 'drafts'],
    icon: BookOpen,
    authOnly: true,
  },
  {
    id: 'personal:resources',
    title: '导入图片',
    path: '/studio/images/import',
    category: 'personal',
    keywords: ['批量上传', '素材管理', 'resources'],
    icon: FileImage,
    authOnly: true,
  },
  {
    id: 'create:blog',
    title: '写文章',
    path: '/studio/articles/new',
    category: 'create',
    keywords: ['新建博客', 'create blog', 'markdown'],
    icon: FilePlus2,
    authOnly: true,
  },
  {
    id: 'create:image',
    title: 'AI 图片',
    path: '/studio/images',
    category: 'create',
    keywords: ['AI image', '生图', '图片创作', '文章封面'],
    icon: ImagePlus,
    authOnly: true,
  },
];

export const searchCommandCatalog: readonly SearchCommand[] = [
  ...navigationCommands,
  ...additionalCommands,
];

export function normalizeSearchQuery(value: string, maxLength = 100) {
  return Array.from(value.trim()).slice(0, maxLength).join('');
}

export function filterSearchCommands(
  commands: readonly SearchCommand[],
  query: string,
  isAuthenticated: boolean,
) {
  const normalizedQuery = normalizeSearchQuery(query).toLocaleLowerCase();
  const seenPaths = new Set<string>();

  return commands.filter((command) => {
    if (command.authOnly && !isAuthenticated) return false;
    if (seenPaths.has(command.path)) return false;

    const searchableText = [command.title, command.path, ...command.keywords]
      .join('\n')
      .toLocaleLowerCase();
    if (normalizedQuery && !searchableText.includes(normalizedQuery)) return false;

    seenPaths.add(command.path);
    return true;
  });
}

export function buildSearchResultUrl(query: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return '/search';
  const params = new URLSearchParams({ q: normalizedQuery });
  return `/search?${params.toString()}`;
}

export const SEARCH_COMMAND_CATEGORY_LABELS: Record<SearchCommandCategory, string> = {
  pages: '常用页面',
  create: '创作入口',
  personal: '个人入口',
};

export const DEFAULT_SEARCH_COMMAND_ICON = BookOpen;
