import { describe, expect, it } from 'vitest';
import {
  captureNearestScrollAnchor,
  getActiveLifeTraceTab,
  getLifeTraceScrollMemoryKey,
  restoreScrollMemory,
} from './lifeTraceNavigation';

function makeScrollContainer() {
  const anchors: HTMLElement[] = [];
  const container = {
    clientHeight: 600,
    scrollHeight: 1600,
    scrollTop: 0,
    append(anchor: HTMLElement) {
      anchors.push(anchor);
    },
    querySelectorAll() {
      return anchors;
    },
    scrollTo({ top }: ScrollToOptions) {
      this.scrollTop = Number(top ?? 0);
    },
    getBoundingClientRect() {
      return {
        top: 0,
        bottom: 600,
        height: 600,
        left: 0,
        right: 360,
        width: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  };
  return container as unknown as HTMLElement;
}

function addAnchor(container: HTMLElement, id: string, top: number) {
  const anchor = {
    dataset: { scrollAnchor: id },
    getBoundingClientRect() {
      return {
        top,
        bottom: top + 80,
        height: 80,
        left: 0,
        right: 320,
        width: 320,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect;
    },
  } as unknown as HTMLElement;
  (container as unknown as { append: (anchor: HTMLElement) => void }).append(anchor);
  return anchor;
}

function setScrollTop(container: HTMLElement, scrollTop: number) {
  (container as unknown as { scrollTop: number }).scrollTop = scrollTop;
}

function setScrollSize(container: HTMLElement, scrollHeight: number, clientHeight = 600) {
  const sizedContainer = container as unknown as { scrollHeight: number; clientHeight: number };
  sizedContainer.scrollHeight = scrollHeight;
  sizedContainer.clientHeight = clientHeight;
}

function getScrollTop(container: HTMLElement) {
  return (container as unknown as { scrollTop: number }).scrollTop;
}

describe('life trace navigation helpers', () => {
  it('maps nested routes to the active root tab', () => {
    expect(getActiveLifeTraceTab('/plans/plan-1')).toBe('plans');
    expect(getActiveLifeTraceTab('/ai/recipes')).toBe('ai');
    expect(getActiveLifeTraceTab('/traces/trace-1')).toBe('traces');
    expect(getActiveLifeTraceTab('/pantry')).toBe('today');
  });

  it('only enables scroll memory for stable tab roots', () => {
    expect(getLifeTraceScrollMemoryKey('/plans')).toBe('tab:plans');
    expect(getLifeTraceScrollMemoryKey('/today')).toBe('tab:today');
    expect(getLifeTraceScrollMemoryKey('/traces')).toBe('tab:traces');
    expect(getLifeTraceScrollMemoryKey('/profile')).toBe('tab:profile');
    expect(getLifeTraceScrollMemoryKey('/ai')).toBeNull();
    expect(getLifeTraceScrollMemoryKey('/ledger')).toBeNull();
    expect(getLifeTraceScrollMemoryKey('/pantry')).toBeNull();
    expect(getLifeTraceScrollMemoryKey('/pantry/abc')).toBeNull();
  });

  it('captures the nearest visible scroll anchor', () => {
    const container = makeScrollContainer();
    addAnchor(container, 'plans:a', -120);
    addAnchor(container, 'plans:b', 64);
    addAnchor(container, 'plans:c', 180);

    expect(captureNearestScrollAnchor(container)).toBe('plans:b');
  });

  it('restores by anchor first and falls back to scroll top', () => {
    const container = makeScrollContainer();
    setScrollTop(container, 240);
    addAnchor(container, 'plans:a', 240);

    restoreScrollMemory(container, { key: 'tab:plans', scrollTop: 120, anchorId: 'plans:a' });
    expect(getScrollTop(container)).toBe(468);

    restoreScrollMemory(container, { key: 'tab:plans', scrollTop: 120, anchorId: 'plans:missing' });
    expect(getScrollTop(container)).toBe(120);
  });

  it('restores an anchor to the same viewport offset it had before navigation', () => {
    const container = makeScrollContainer();
    setScrollTop(container, 900);
    addAnchor(container, 'pantry:item-1', 180);

    restoreScrollMemory(container, {
      key: '/pantry',
      scrollTop: 900,
      anchorId: 'pantry:item-1',
      anchorOffsetTop: 180,
    });

    expect(getScrollTop(container)).toBe(900);
  });

  it('waits when the saved anchor is not rendered and the page is still too short', () => {
    const container = makeScrollContainer();
    setScrollSize(container, 500, 600);

    expect(
      restoreScrollMemory(container, {
        key: '/pantry',
        scrollTop: 1200,
        anchorId: 'pantry:item-1',
      }),
    ).toBe(false);
    expect(getScrollTop(container)).toBe(0);

    setScrollSize(container, 2000, 600);
    expect(
      restoreScrollMemory(container, {
        key: '/pantry',
        scrollTop: 1200,
        anchorId: 'pantry:item-1',
      }),
    ).toBe(true);
    expect(getScrollTop(container)).toBe(1200);
  });
});
