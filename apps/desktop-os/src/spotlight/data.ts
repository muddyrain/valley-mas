import type { AppId } from '../store/windowStore';

export type SpotlightKind = 'app' | 'folder' | 'calc' | 'web';

export interface SpotlightItem {
  id: string;
  kind: SpotlightKind;
  title: string;
  subtitle?: string;
  icon: string;
  // 命中后要做什么
  action:
    | { type: 'open-app'; appId: AppId; title?: string }
    | { type: 'open-folder'; name: string }
    | { type: 'calc'; expression: string; result: string }
    | { type: 'web-search'; query: string };
}

const APPS: SpotlightItem[] = [
  {
    id: 'app-finder',
    kind: 'app',
    title: 'Finder',
    subtitle: '应用程序 — 文件浏览',
    icon: '/dock/finder.png',
    action: { type: 'open-app', appId: 'about', title: 'Finder' },
  },
  {
    id: 'app-notes',
    kind: 'app',
    title: '便签',
    subtitle: '应用程序 — Notes',
    icon: '/dock/notes.png',
    action: { type: 'open-app', appId: 'notes', title: '便签' },
  },
  {
    id: 'app-about',
    kind: 'app',
    title: '关于本机',
    subtitle: '系统信息',
    icon: '/dock/finder.png',
    action: { type: 'open-app', appId: 'about', title: '关于本机' },
  },
];

const FOLDERS: SpotlightItem[] = [
  {
    id: 'f-documents',
    kind: 'folder',
    title: '文稿',
    subtitle: '文件夹 — Documents',
    icon: '/folders/documents.png',
    action: { type: 'open-folder', name: '文稿' },
  },
  {
    id: 'f-downloads',
    kind: 'folder',
    title: '下载',
    subtitle: '文件夹 — Downloads',
    icon: '/folders/downloads.png',
    action: { type: 'open-folder', name: '下载' },
  },
  {
    id: 'f-desktop',
    kind: 'folder',
    title: '桌面',
    subtitle: '文件夹 — Desktop',
    icon: '/folders/desktop.png',
    action: { type: 'open-folder', name: '桌面' },
  },
  {
    id: 'f-pictures',
    kind: 'folder',
    title: '图片',
    subtitle: '文件夹 — Pictures',
    icon: '/folders/pictures.png',
    action: { type: 'open-folder', name: '图片' },
  },
  {
    id: 'f-music',
    kind: 'folder',
    title: '音乐',
    subtitle: '文件夹 — Music',
    icon: '/folders/music.png',
    action: { type: 'open-folder', name: '音乐' },
  },
  {
    id: 'f-videos',
    kind: 'folder',
    title: '影片',
    subtitle: '文件夹 — Videos',
    icon: '/folders/videos.png',
    action: { type: 'open-folder', name: '影片' },
  },
  {
    id: 'f-applications',
    kind: 'folder',
    title: '应用程序',
    subtitle: '文件夹 — Applications',
    icon: '/folders/applications.png',
    action: { type: 'open-folder', name: '应用程序' },
  },
  {
    id: 'f-home',
    kind: 'folder',
    title: '个人',
    subtitle: '文件夹 — Home',
    icon: '/folders/home.png',
    action: { type: 'open-folder', name: '个人' },
  },
  {
    id: 'f-cloud',
    kind: 'folder',
    title: 'iCloud Drive',
    subtitle: '云盘',
    icon: '/folders/cloud.png',
    action: { type: 'open-folder', name: 'iCloud Drive' },
  },
];

export const SPOTLIGHT_INDEX: SpotlightItem[] = [...APPS, ...FOLDERS];

const CALC_ICON = '/dock/appstore.png';

const CALC_RE = /^\s*([-+]?\d+(?:\.\d+)?)\s*([+\-*/x×÷])\s*(\d+(?:\.\d+)?)\s*$/;

function tryCalc(query: string): SpotlightItem | null {
  const m = CALC_RE.exec(query);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  const opRaw = m[2];
  const op = opRaw === 'x' || opRaw === '×' ? '*' : opRaw === '÷' ? '/' : opRaw;
  let r: number;
  switch (op) {
    case '+':
      r = a + b;
      break;
    case '-':
      r = a - b;
      break;
    case '*':
      r = a * b;
      break;
    case '/':
      if (b === 0) return null;
      r = a / b;
      break;
    default:
      return null;
  }
  const result = Number.isInteger(r) ? String(r) : String(Number(r.toFixed(6)));
  return {
    id: 'calc-result',
    kind: 'calc',
    title: result,
    subtitle: `计算 — ${a} ${opRaw} ${b}`,
    icon: CALC_ICON,
    action: { type: 'calc', expression: query.trim(), result },
  };
}

export function searchSpotlight(query: string, limit = 8): SpotlightItem[] {
  const q = query.trim();
  if (!q) return [];

  const results: SpotlightItem[] = [];

  const calc = tryCalc(q);
  if (calc) results.push(calc);

  const lower = q.toLowerCase();
  for (const item of SPOTLIGHT_INDEX) {
    if (
      item.title.toLowerCase().includes(lower) ||
      (item.subtitle ?? '').toLowerCase().includes(lower)
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
      icon: '/dock/safari.png',
      action: { type: 'web-search', query: q },
    });
  }

  return results;
}
