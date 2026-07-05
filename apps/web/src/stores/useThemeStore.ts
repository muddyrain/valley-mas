import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      setMode: (mode) => {
        applyThemeToDocument(mode);
        set({ mode });
      },
      toggleMode: () => {
        const next = get().mode === 'dark' ? 'light' : 'dark';
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
          return { mode: p.mode as ThemeMode };
        }
        // Migrate from old theme/accent system
        if (p && typeof p === 'object') {
          return { mode: 'dark' as ThemeMode };
        }
        return { mode: 'dark' as ThemeMode };
      },
    },
  ),
);
