import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedThemeMode = Exclude<ThemeMode, 'system'>;

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const resolvedMode = resolveThemeMode(mode);
  document.documentElement.classList.toggle('dark', resolvedMode === 'dark');
  document.documentElement.style.colorScheme = resolvedMode;
};

export const resolveThemeMode = (mode: ThemeMode): ResolvedThemeMode => {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => {
        applyThemeToDocument(mode);
        set({ mode });
      },
      toggleMode: () => {
        const next = resolveThemeMode(get().mode) === 'dark' ? 'light' : 'dark';
        applyThemeToDocument(next);
        set({ mode: next });
      },
    }),
    {
      name: 'valley_theme',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      migrate: (persisted: unknown) => {
        const p = persisted as Record<string, unknown>;
        if (p && typeof p === 'object' && 'mode' in p) {
          const mode = p.mode;
          if (mode === 'dark' || mode === 'light' || mode === 'system') {
            return { mode };
          }
        }
        return { mode: 'system' as ThemeMode };
      },
    },
  ),
);
