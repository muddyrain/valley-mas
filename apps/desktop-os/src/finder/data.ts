import type { ServerResource } from '../api/resources';

export type FinderPath =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'ai'
  | 'design'
  | 'development'
  | 'inspiration'
  | 'downloads';

export type FinderItemKind = 'folder' | 'resource' | 'note' | 'link';
export type FinderPrimaryAction = 'preview' | 'open';

export interface FinderAction {
  label: string;
  detail: string;
}

export interface FinderItem {
  id: string;
  kind: FinderItemKind;
  title: string;
  subtitle: string;
  body: string;
  icon: string;
  tags?: string[];
  targetPath?: FinderPath;
  reference?: string;
  status?: string;
  highlights?: string[];
  actions?: FinderAction[];
  previewImage?: string;
  previewUrl?: string;
  mediaKind?: 'image';
  publicUrl?: string;
  resourceId?: string;
  downloadCount?: number;
  favoriteCount?: number;
  viewCount?: number;
  isFavorited?: boolean;
  creatorName?: string;
  createdAt?: string;
  extension?: string;
  size?: number;
  primaryAction?: FinderPrimaryAction;
}

export interface FinderSection {
  path: FinderPath;
  label: string;
  icon: string;
  description?: string;
  group: 'library' | 'smart';
}

export const FINDER_SECTIONS: FinderSection[] = [
  {
    path: 'all',
    label: '全部资源',
    icon: '/folders/cloud.png',
    description: '公开资源与账号可见资源',
    group: 'library',
  },
  {
    path: 'favorites',
    label: '我的收藏',
    icon: '/icons/favorites-star.png',
    description: '已收藏的资源',
    group: 'library',
  },
  {
    path: 'recent',
    label: '最近浏览',
    icon: '/folders/desktop.png',
    description: '最近更新与访问线索',
    group: 'library',
  },
  {
    path: 'downloads',
    label: '下载资料',
    icon: '/folders/downloads.png',
    description: '下载记录与待整理资料',
    group: 'library',
  },
  {
    path: 'ai',
    label: 'AI 工具',
    icon: '/icons/stationery.png',
    description: '模型、提示词和对话资源',
    group: 'smart',
  },
  {
    path: 'design',
    label: '设计资源',
    icon: '/folders/pictures.png',
    description: '视觉、图标、字体和素材',
    group: 'smart',
  },
  {
    path: 'development',
    label: '开发资源',
    icon: '/folders/applications.png',
    description: '代码、文档和工程工具',
    group: 'smart',
  },
  {
    path: 'inspiration',
    label: '灵感收藏',
    icon: '/folders/archive.png',
    description: '产品、交互与创意参考',
    group: 'smart',
  },
];

export const PATH_LABEL: Record<FinderPath, string> = {
  all: '全部资源',
  favorites: '我的收藏',
  recent: '最近浏览',
  ai: 'AI 工具',
  design: '设计资源',
  development: '开发资源',
  inspiration: '灵感收藏',
  downloads: '下载资料',
};

export const FINDER_ITEMS: Record<FinderPath, FinderItem[]> = {
  all: [],
  favorites: [],
  recent: [],
  ai: [
    {
      id: 'resource-chatgpt',
      kind: 'resource',
      title: 'ChatGPT',
      subtitle: 'AI 对话',
      body: '日常问答、写作、代码协作和资料整理入口。',
      icon: '/icons/stationery.png',
      status: '在线资源',
      tags: ['Chat', 'AI'],
      publicUrl: 'https://chatgpt.com',
      highlights: ['对话', '写作', '代码协作'],
    },
    {
      id: 'resource-claude',
      kind: 'resource',
      title: 'Claude',
      subtitle: '长文本协作',
      body: '适合阅读、整理和长文档分析的 AI 工具入口。',
      icon: '/folders/documents.png',
      status: '在线资源',
      tags: ['AI', 'Docs'],
      publicUrl: 'https://claude.ai',
      highlights: ['长文本', '分析', '写作'],
    },
    {
      id: 'resource-perplexity',
      kind: 'resource',
      title: 'Perplexity',
      subtitle: '搜索与答案',
      body: '面向资料检索、来源追踪和主题调研的搜索入口。',
      icon: '/folders/cloud.png',
      status: '在线资源',
      tags: ['Search', 'Research'],
      publicUrl: 'https://www.perplexity.ai',
      highlights: ['检索', '来源', '调研'],
    },
  ],
  design: [
    {
      id: 'resource-figma-community',
      kind: 'resource',
      title: 'Figma Community',
      subtitle: '设计社区',
      body: '界面模板、组件资源和设计系统灵感。',
      icon: '/folders/pictures.png',
      status: '在线资源',
      tags: ['Figma', 'UI'],
      publicUrl: 'https://www.figma.com/community',
      highlights: ['组件', '模板', '设计系统'],
    },
    {
      id: 'resource-google-fonts',
      kind: 'resource',
      title: 'Google Fonts',
      subtitle: '字体资源',
      body: '网页字体浏览、对比和快速引用入口。',
      icon: '/folders/documents.png',
      status: '在线资源',
      tags: ['Typography'],
      publicUrl: 'https://fonts.google.com',
      highlights: ['字体', '排版', '网页'],
    },
    {
      id: 'resource-lucide',
      kind: 'resource',
      title: 'Lucide Icons',
      subtitle: '图标库',
      body: '轻量、统一的开源图标资源。',
      icon: '/icons/app-store.png',
      status: '在线资源',
      tags: ['Icons'],
      publicUrl: 'https://lucide.dev',
      highlights: ['图标', '开源', 'React'],
    },
  ],
  development: [
    {
      id: 'resource-mdn',
      kind: 'resource',
      title: 'MDN Web Docs',
      subtitle: 'Web 文档',
      body: 'HTML、CSS、JavaScript 和浏览器 API 文档入口。',
      icon: '/folders/documents.png',
      status: '在线资源',
      tags: ['Docs', 'Web'],
      publicUrl: 'https://developer.mozilla.org',
      highlights: ['HTML', 'CSS', 'JavaScript'],
    },
    {
      id: 'resource-github',
      kind: 'resource',
      title: 'GitHub',
      subtitle: '代码平台',
      body: '仓库、Issue、PR 和开源项目浏览入口。',
      icon: '/folders/shared.png',
      status: '在线资源',
      tags: ['Code', 'Git'],
      publicUrl: 'https://github.com',
      highlights: ['仓库', '协作', '开源'],
    },
    {
      id: 'resource-caniuse',
      kind: 'resource',
      title: 'Can I Use',
      subtitle: '浏览器兼容性',
      body: '查看 Web 能力在不同浏览器里的支持情况。',
      icon: '/icons/safari.png',
      status: '在线资源',
      tags: ['Browser'],
      publicUrl: 'https://caniuse.com',
      highlights: ['兼容性', '浏览器', 'Web API'],
    },
  ],
  inspiration: [
    {
      id: 'resource-landingfolio',
      kind: 'resource',
      title: 'Landingfolio',
      subtitle: '落地页灵感',
      body: '产品首页、组件和营销页面参考。',
      icon: '/folders/archive.png',
      status: '在线资源',
      tags: ['Web', 'Product'],
      publicUrl: 'https://www.landingfolio.com',
      highlights: ['首页', '组件', '产品表达'],
    },
    {
      id: 'resource-dribbble',
      kind: 'resource',
      title: 'Dribbble',
      subtitle: '视觉灵感',
      body: '图形、界面和品牌视觉参考。',
      icon: '/folders/pictures.png',
      status: '在线资源',
      tags: ['Visual'],
      publicUrl: 'https://dribbble.com',
      highlights: ['视觉', '动效', '品牌'],
    },
    {
      id: 'resource-awwwards',
      kind: 'resource',
      title: 'Awwwards',
      subtitle: '网页案例',
      body: '高质量网页设计、交互和动效案例。',
      icon: '/icons/safari.png',
      status: '在线资源',
      tags: ['Web', 'Motion'],
      publicUrl: 'https://www.awwwards.com',
      highlights: ['网页', '交互', '动效'],
    },
  ],
  downloads: [
    {
      id: 'download-web-clips',
      kind: 'note',
      title: '网页剪藏',
      subtitle: '待整理',
      body: '后续可接入云端收藏、阅读清单或浏览器剪藏。',
      icon: '/folders/downloads.png',
      status: '本地占位',
      tags: ['Clips', 'Cloud'],
      highlights: ['网页资料', '阅读清单', '收藏同步'],
    },
    {
      id: 'download-screenshots',
      kind: 'note',
      title: '截图素材',
      subtitle: '视觉资料',
      body: '桌面、应用窗口和小组件截图的整理入口。',
      icon: '/folders/pictures.png',
      status: '待补充',
      tags: ['Images'],
      highlights: ['桌面截图', '小组件', '应用窗口'],
    },
    {
      id: 'download-documents',
      kind: 'note',
      title: '文档资料',
      subtitle: '云端预留',
      body: '后续可接入账号、云端文件和下载记录。',
      icon: '/folders/documents.png',
      status: '预留',
      tags: ['Documents'],
      highlights: ['云端文件', '下载记录', '资料归档'],
    },
  ],
};

export function getFinderItems(path: FinderPath) {
  return FINDER_ITEMS[path];
}

export function getFirstFinderItem(path: FinderPath) {
  return FINDER_ITEMS[path][0] ?? null;
}

export function getFinderItem(path: FinderPath, id: string | null) {
  if (!id) return null;
  return FINDER_ITEMS[path].find((item) => item.id === id) ?? null;
}

export function getResourceSpotlightItems() {
  return Object.entries(FINDER_ITEMS).flatMap(([path, items]) =>
    items
      .filter((item) => item.kind === 'resource' || item.kind === 'link')
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        icon: item.icon,
        publicUrl: item.publicUrl,
        path: path as FinderPath,
      })),
  );
}

const RESOURCE_BROWSER_PATHS: FinderPath[] = [
  'all',
  'favorites',
  'recent',
  'downloads',
  'ai',
  'design',
  'development',
  'inspiration',
];

const PATH_KEYWORDS: Partial<Record<FinderPath, string[]>> = {
  ai: ['ai', 'gpt', 'chat', 'prompt', 'model', '模型', '提示词', '对话'],
  design: ['design', 'ui', 'figma', 'icon', 'wallpaper', 'avatar', '设计', '图标', '壁纸', '头像'],
  development: ['dev', 'code', 'github', 'docs', 'web', '开发', '代码', '文档', '前端'],
  inspiration: ['idea', 'inspiration', 'dynamic', 'emoji', '灵感', '参考', '动效', '表情'],
};

export function isServerResourcePath(path: FinderPath) {
  return RESOURCE_BROWSER_PATHS.includes(path);
}

export function resourceToFinderItem(resource: ServerResource): FinderItem {
  const tags = resource.tags?.map((tag) => tag.name).filter(Boolean) ?? [];
  const isImage = isImageResource(resource);
  return {
    id: finderIdForResource(resource.id),
    kind: 'resource',
    title: resource.title,
    subtitle: resource.creatorName ? `来自 ${resource.creatorName}` : resource.type,
    body: resource.description || '在线资源',
    icon: resource.thumbnailUrl || iconForResourceType(resource.type),
    tags,
    status: resource.isFavorited ? '已收藏' : '在线资源',
    publicUrl: resource.url,
    previewImage: resource.thumbnailUrl || (isImage ? resource.url : undefined),
    previewUrl: isImage ? resource.url || resource.thumbnailUrl : undefined,
    mediaKind: isImage ? 'image' : undefined,
    resourceId: resource.id,
    downloadCount: resource.downloadCount,
    favoriteCount: resource.favoriteCount,
    viewCount: resource.viewCount,
    isFavorited: resource.isFavorited,
    creatorName: resource.creatorName,
    createdAt: resource.createdAt,
    extension: resource.extension,
    size: resource.size,
    primaryAction: isImage ? 'preview' : 'open',
    highlights: [
      resource.type,
      resource.downloadCount !== undefined ? `${resource.downloadCount} 次下载` : '',
      resource.favoriteCount !== undefined ? `${resource.favoriteCount} 次收藏` : '',
    ].filter(Boolean),
  };
}

export function finderIdForResource(resourceId: string) {
  return `server-resource-${resourceId}`;
}

interface ResourceActivity {
  recentResourceIds?: string[];
  downloadedResourceIds?: string[];
}

export function filterResourcesForPath(
  path: FinderPath,
  resources: ServerResource[],
  activity: ResourceActivity = {},
) {
  if (path === 'favorites') return resources.filter((resource) => resource.isFavorited);
  if (path === 'recent') {
    return orderResourcesByIds(resources, activity.recentResourceIds ?? []);
  }
  if (path === 'downloads') {
    return orderResourcesByIds(resources, activity.downloadedResourceIds ?? []);
  }
  if (path === 'all') return resources;
  const keywords = PATH_KEYWORDS[path];
  if (!keywords) return resources;
  return resources.filter((resource) => {
    const text = [
      resource.title,
      resource.description,
      resource.type,
      ...(resource.tags?.map((tag) => tag.name) ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
}

function orderResourcesByIds(resources: ServerResource[], orderedIds: string[]) {
  if (orderedIds.length === 0) return [];
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  return orderedIds.flatMap((id) => {
    const resource = resourceById.get(id);
    return resource ? [resource] : [];
  });
}

function iconForResourceType(type: string) {
  switch (type) {
    case 'wallpaper':
    case 'background':
    case 'dynamic':
      return '/folders/pictures.png';
    case 'avatar':
    case 'emoji':
      return '/icons/eco-leaf.png';
    default:
      return '/folders/cloud.png';
  }
}

function isImageResource(resource: ServerResource) {
  const type = resource.type.toLowerCase();
  const extension = resource.extension?.toLowerCase();
  const imageTypes = new Set([
    'image',
    'wallpaper',
    'background',
    'dynamic',
    'avatar',
    'emoji',
    'icon',
    'illustration',
    'photo',
    'screenshot',
  ]);
  const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg']);
  if (imageTypes.has(type)) return true;
  if (extension && imageExtensions.has(extension)) return true;
  return resource.url.match(/\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i) !== null;
}
