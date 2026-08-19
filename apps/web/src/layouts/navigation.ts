import { BookOpen, FlaskConical, Home, ImageIcon, PenLine, Wrench } from 'lucide-react';

export const navigationGroups = [
  {
    label: '浏览',
    items: [
      { to: '/', label: '首页', icon: Home },
      { to: '/articles', label: '文章', icon: BookOpen },
      { to: '/gallery', label: '图库', icon: ImageIcon },
    ],
  },
  {
    label: '创作',
    items: [
      { to: '/studio', label: '创作室', icon: PenLine },
      { to: '/workbench', label: '私有实验室', icon: FlaskConical },
    ],
  },
  {
    label: '工具',
    items: [{ to: '/tools/format', label: '实用工具', icon: Wrench }],
  },
] as const;

export function isNavigationActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  if (to === '/studio') return pathname === to || pathname.startsWith('/studio/');
  if (to === '/workbench') {
    return pathname === to || pathname.startsWith('/workbench/');
  }
  return pathname.startsWith(to);
}
