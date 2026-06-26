import type { AppTab } from '@/types';

export type ScrollMemoryEntry = {
  key: string;
  scrollTop: number;
  anchorId: string;
  anchorOffsetTop?: number;
};

const tabRootPaths: Record<AppTab, string> = {
  today: '/today',
  plans: '/plans',
  ai: '/ai',
  traces: '/traces',
  profile: '/profile',
};

const listRouteSearchKeys: Record<string, string[]> = {
  '/pantry': ['householdId', 'status', 'category', 'q', 'sort'],
  '/ledger': ['month', 'category', 'direction'],
  '/shopping': ['status'],
  '/recurring-payments': ['status'],
  '/places': ['new', 'inboxItemId'],
  '/media-diary': ['status', 'new', 'inboxItemId'],
};

export function getActiveLifeTraceTab(pathname: string): AppTab {
  if (pathname === '/plans' || pathname.startsWith('/plans/')) {
    return 'plans';
  }
  if (pathname === '/ai' || pathname.startsWith('/ai/')) {
    return 'ai';
  }
  if (pathname === '/traces' || pathname.startsWith('/traces/')) {
    return 'traces';
  }
  if (pathname === '/profile') {
    return 'profile';
  }
  return 'today';
}

export function isLifeTraceTabRoute(pathname: string) {
  return Object.values(tabRootPaths).includes(pathname);
}

export function getLifeTraceScrollKey(pathname: string, search = '') {
  if (isLifeTraceTabRoute(pathname)) {
    return `tab:${getActiveLifeTraceTab(pathname)}`;
  }

  const searchKeys = listRouteSearchKeys[pathname];
  if (!searchKeys?.length || !search) {
    return pathname;
  }

  const searchParams = new URLSearchParams(search);
  const stableSearch = new URLSearchParams();
  for (const key of searchKeys) {
    const value = searchParams.get(key);
    if (value) {
      stableSearch.set(key, value);
    }
  }

  const stableSearchText = stableSearch.toString();
  return stableSearchText ? `${pathname}?${stableSearchText}` : pathname;
}

export function captureNearestScrollAnchor(container: HTMLElement) {
  return captureNearestScrollAnchorSnapshot(container)?.anchorId ?? '';
}

function getAnchorSnapshot(container: HTMLElement, anchor: HTMLElement) {
  const anchorId = anchor.dataset.scrollAnchor ?? '';
  if (!anchorId) {
    return null;
  }

  return {
    anchorId,
    anchorOffsetTop: anchor.getBoundingClientRect().top - container.getBoundingClientRect().top,
  };
}

function captureNearestScrollAnchorSnapshot(container: HTMLElement) {
  const anchors = Array.from(container.querySelectorAll<HTMLElement>('[data-scroll-anchor]'));
  if (anchors.length === 0) {
    return null;
  }

  const containerTop = container.getBoundingClientRect().top;
  const threshold = containerTop + 96;
  let nearest = anchors[0];

  for (const anchor of anchors) {
    if (anchor.getBoundingClientRect().top <= threshold) {
      nearest = anchor;
    } else {
      break;
    }
  }

  return getAnchorSnapshot(container, nearest);
}

export function captureScrollMemory(
  container: HTMLElement,
  key: string,
  preferredAnchor?: HTMLElement | null,
): ScrollMemoryEntry {
  const anchorSnapshot =
    preferredAnchor && container.contains(preferredAnchor)
      ? getAnchorSnapshot(container, preferredAnchor)
      : captureNearestScrollAnchorSnapshot(container);

  return {
    key,
    scrollTop: container.scrollTop,
    anchorId: anchorSnapshot?.anchorId ?? '',
    anchorOffsetTop: anchorSnapshot?.anchorOffsetTop ?? 0,
  };
}

export function restoreScrollMemory(container: HTMLElement, entry?: ScrollMemoryEntry) {
  if (!entry) {
    container.scrollTo({ top: 0, behavior: 'instant' });
    return true;
  }

  if (entry.anchorId) {
    const anchor = Array.from(container.querySelectorAll<HTMLElement>('[data-scroll-anchor]')).find(
      (element) => element.dataset.scrollAnchor === entry.anchorId,
    );
    if (anchor) {
      const containerTop = container.getBoundingClientRect().top;
      const anchorTop = anchor.getBoundingClientRect().top;
      const anchorOffsetTop = entry.anchorOffsetTop ?? 12;
      container.scrollTo({
        top: Math.max(0, container.scrollTop + anchorTop - containerTop - anchorOffsetTop),
        behavior: 'instant',
      });
      return true;
    }

    if (entry.scrollTop > container.scrollHeight - container.clientHeight) {
      return false;
    }
  }

  container.scrollTo({ top: Math.max(0, entry.scrollTop), behavior: 'instant' });
  return true;
}
