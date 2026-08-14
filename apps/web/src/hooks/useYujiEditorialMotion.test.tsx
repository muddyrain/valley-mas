/** @vitest-environment jsdom */

import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromTo, matchMedia, revert, selector } = vi.hoisted(() => {
  const revert = vi.fn();
  return {
    fromTo: vi.fn(),
    matchMedia: vi.fn(() => ({
      add: (_query: string, callback: () => void) => callback(),
      revert,
    })),
    revert,
    selector: vi.fn((root: HTMLElement) => (query: string) => [
      ...root.querySelectorAll<HTMLElement>(query),
    ]),
  };
});

vi.mock('gsap', () => ({
  gsap: {
    fromTo,
    matchMedia,
    set: vi.fn(),
    to: vi.fn(),
    utils: { selector },
  },
}));

import { useYujiEditorialMotion } from './useYujiEditorialMotion';

function MotionFixture() {
  const rootRef = useRef<HTMLDivElement>(null);
  useYujiEditorialMotion(rootRef, 'ready');
  return (
    <div ref={rootRef}>
      <h1 data-yuji-reveal="intro">雨迹</h1>
      <figure data-yuji-reveal="media">影像</figure>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('useYujiEditorialMotion', () => {
  it('scopes motion to the page and reverts it on unmount', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<MotionFixture />));

    expect(matchMedia).toHaveBeenCalled();
    expect(fromTo).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('[data-yuji-revealed="true"]')).toHaveLength(2);

    act(() => root.unmount());
    expect(revert).toHaveBeenCalledOnce();
  });
});
