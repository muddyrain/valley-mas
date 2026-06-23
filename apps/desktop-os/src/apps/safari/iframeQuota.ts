import type { BrowserTab } from '../../store/browserStore';

export const IFRAME_QUOTA = 4;

export function selectRenderableTabs(
  tabs: BrowserTab[],
  activeTab: BrowserTab | null,
  quota = IFRAME_QUOTA,
): BrowserTab[] {
  const withUrl = tabs.filter((t) => t.currentUrl);
  const sorted = [...withUrl].sort((a, b) => b.lastActivatedAt - a.lastActivatedAt);
  const slice = sorted.slice(0, quota);
  if (activeTab?.currentUrl && !slice.some((t) => t.id === activeTab.id)) {
    slice.push(activeTab);
  }
  return slice;
}
