import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreset = 'amber' | 'rose' | 'ocean' | 'forest';

export const THEME_OPTIONS: Array<{
  value: ThemePreset;
  label: string;
  description: string;
  preview: [string, string];
}> = [
  {
    value: 'rose',
    label: '雾粉',
    description: '更柔和，也更偏轻盈',
    preview: ['#c87485', '#fff1f4'],
  },
  {
    value: 'amber',
    label: '暖金',
    description: '温润、干净、适合内容型页面',
    preview: ['#cb8b3c', '#fff5e9'],
  },
  {
    value: 'ocean',
    label: '海蓝',
    description: '更清爽，适合偏工具感的浏览',
    preview: ['#3d7eb5', '#edf6ff'],
  },
  {
    value: 'forest',
    label: '苔绿',
    description: '更安静，适合长时间阅读',
    preview: ['#5b8d6c', '#eff8f1'],
  },
];

interface ThemeState {
  theme: ThemePreset;
  setTheme: (theme: ThemePreset) => void;
}

export const applyThemeToDocument = (theme: ThemePreset) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'rose',
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
    }),
    {
      name: 'valley_theme',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    },
  ),
);
