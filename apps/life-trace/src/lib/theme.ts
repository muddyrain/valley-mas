export type AppTheme = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'life-trace-theme';

export function getStoredTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'system';
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', theme === 'light');
}

export function setStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
  applyTheme(theme);
}

export function getThemeDisplayName(theme: AppTheme): string {
  switch (theme) {
    case 'system':
      return '跟随系统';
    case 'light':
      return '浅色模式';
    case 'dark':
      return '深色模式';
  }
}
