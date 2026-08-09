import { BookOpen, Bot, Film, Home, ImageIcon, LibraryBig, Sparkles, Wrench } from 'lucide-react';

export const navigationGroups = [
  {
    label: '浏览',
    items: [
      { to: '/', label: '首页', icon: Home },
      { to: '/blog', label: '博客', icon: BookOpen },
      { to: '/resources', label: '资源', icon: ImageIcon },
    ],
  },
  {
    label: '创作',
    items: [
      { to: '/workbench', label: '智能体', icon: Bot },
      { to: '/workbench/images', label: 'AI 图片', icon: Sparkles },
      { to: '/workbench/gifs', label: '动态表情', icon: Film },
      { to: '/workbench/resources', label: 'AI 资源', icon: LibraryBig },
    ],
  },
  {
    label: '工具',
    items: [{ to: '/tools/format', label: '实用工具', icon: Wrench }],
  },
] as const;

export function isNavigationActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  if (to === '/workbench') {
    return pathname === to || pathname.startsWith('/workbench/apps/');
  }
  if (to === '/workbench/images') return pathname === to;
  if (to === '/workbench/gifs') return pathname === to;
  if (to === '/workbench/resources') {
    return (
      pathname === to ||
      pathname === '/workbench/create' ||
      pathname.startsWith('/workbench/edit/') ||
      pathname.startsWith('/workbench/templates/')
    );
  }
  return pathname.startsWith(to);
}
