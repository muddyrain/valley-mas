import type { FinderPath } from '../finder/data';
import { useFinderStore } from '../store/finderStore';
import { useWindowStore } from '../store/windowStore';
import { getDefaultWindowOptions } from './desktopApps';

export function useRevealInFinder() {
  const revealItem = useFinderStore((s) => s.revealItem);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);

  return (path: FinderPath, selectedId: string | null) => {
    revealItem(path, selectedId);
    restoreOrFocus('finder', getDefaultWindowOptions('finder'));
  };
}
