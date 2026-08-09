import {
  Bell,
  BookOpen,
  Download,
  FileImage,
  FilePlus2,
  FolderKanban,
  Gamepad2,
  Heart,
  ImagePlus,
  type LucideIcon,
  Shapes,
  Sparkles,
  User,
  Users,
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

const AUTH_ONLY_NAV_PATHS = new Set([
  '/workbench',
  '/workbench/images',
  '/workbench/gifs',
  '/workbench/resources',
]);

const NAV_KEYWORDS: Record<string, readonly string[]> = {
  '/': ['主页', '内容首页', 'home'],
  '/blog': ['文章', '图文', '内容', 'blog'],
  '/resources': ['壁纸', '头像', '素材', 'resource'],
  '/workbench': ['AI', 'agent', '项目'],
  '/workbench/images': ['AI image', '生图', '图片创作'],
  '/workbench/gifs': ['GIF', '动图', 'motion sticker'],
  '/workbench/resources': ['提示词', '技能', '知识库', 'workflow'],
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
    id: 'personal:my-space',
    title: '我的创作空间',
    path: '/my-space',
    category: 'personal',
    keywords: ['创作者', '空间', 'workspace'],
    icon: Sparkles,
    authOnly: true,
  },
  {
    id: 'personal:posts',
    title: '内容管理',
    path: '/my-space/posts',
    category: 'personal',
    keywords: ['文章管理', '图文管理', 'posts'],
    icon: FolderKanban,
    authOnly: true,
  },
  {
    id: 'personal:resources',
    title: '资源管理',
    path: '/my-space/resources',
    category: 'personal',
    keywords: ['素材管理', 'resources'],
    icon: FileImage,
    authOnly: true,
  },
  {
    id: 'create:blog',
    title: '创建博客',
    path: '/my-space/blog-create',
    category: 'create',
    keywords: ['写文章', '新建博客', 'create blog'],
    icon: FilePlus2,
    authOnly: true,
  },
  {
    id: 'create:image-text',
    title: '创建图文',
    path: '/my-space/image-text',
    category: 'create',
    keywords: ['新建图文', '图片文字', 'create image text'],
    icon: ImagePlus,
    authOnly: true,
  },
  {
    id: 'personal:profile',
    title: '个人资料',
    path: '/profile',
    category: 'personal',
    keywords: ['账户', '头像', 'profile'],
    icon: User,
    authOnly: true,
  },
  {
    id: 'personal:favorites',
    title: '我的收藏',
    path: '/favorites',
    category: 'personal',
    keywords: ['喜欢', '收藏夹', 'favorites'],
    icon: Heart,
    authOnly: true,
  },
  {
    id: 'personal:follows',
    title: '我的关注',
    path: '/follows',
    category: 'personal',
    keywords: ['关注列表', 'following'],
    icon: Users,
    authOnly: true,
  },
  {
    id: 'personal:downloads',
    title: '下载记录',
    path: '/downloads',
    category: 'personal',
    keywords: ['下载历史', 'downloads'],
    icon: Download,
    authOnly: true,
  },
  {
    id: 'personal:notifications',
    title: '通知中心',
    path: '/notifications',
    category: 'personal',
    keywords: ['消息', '提醒', 'notifications'],
    icon: Bell,
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
