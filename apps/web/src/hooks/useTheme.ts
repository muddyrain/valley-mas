import { useEffect, useMemo, useState } from 'react';
import { type ResolvedThemeMode, resolveThemeMode, useThemeStore } from '@/stores/useThemeStore';

export function useTheme() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const toggleMode = useThemeStore((state) => state.toggleMode);
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(() => resolveThemeMode('system'));

  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemMode = () => setSystemMode(resolveThemeMode('system'));

    syncSystemMode();
    mediaQuery.addEventListener('change', syncSystemMode);
    return () => mediaQuery.removeEventListener('change', syncSystemMode);
  }, [mode]);

  const resolvedMode = mode === 'system' ? systemMode : mode;

  return useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark: resolvedMode === 'dark',
      setMode,
      toggleMode,
    }),
    [mode, resolvedMode, setMode, toggleMode],
  );
}
