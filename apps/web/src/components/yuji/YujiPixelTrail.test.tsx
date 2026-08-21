/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPointerBus, createScrollBus } from '@/features/yuji-stage/stageBus';
import {
  YujiStageContext,
  type YujiStageContextValue,
} from '@/features/yuji-stage/YujiStageContext';
import YujiPixelTrail from './YujiPixelTrail';

function createStage(pointerBus = createPointerBus()): YujiStageContextValue {
  return {
    covers: [],
    introReleased: true,
    introSettled: true,
    loadProgress: 100,
    pointerBus,
    registerCover: () => () => undefined,
    releaseIntro: vi.fn(),
    scrollBus: createScrollBus(),
    tier: 'full',
    webglReady: true,
  };
}

function mockFinePointer(matches = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches,
      media: '(pointer: fine)',
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  mockFinePointer();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1_200 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('YujiPixelTrail', () => {
  it('keeps the native cursor and emits equally sized, grid-aligned pixels behind pointer movement', () => {
    const target = document.createElement('main');
    document.body.appendChild(target);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });

    const stage = createStage();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <YujiStageContext.Provider value={stage}>
          <YujiPixelTrail />
        </YujiStageContext.Provider>,
      ),
    );

    act(() => {
      stage.pointerBus.move(600, 320, { height: 800, left: 0, top: 0, width: 1_200 }, 16);
      stage.pointerBus.move(680, 320, { height: 800, left: 0, top: 0, width: 1_200 }, 32);
    });

    const activePixels = Array.from(
      container.querySelectorAll<HTMLElement>('.yuji-pixel-trail i'),
    ).filter((pixel) => pixel.style.animation.includes('yuji-pixel-trail-fade'));
    expect(activePixels.length).toBeGreaterThan(0);
    expect(activePixels.every((pixel) => pixel.style.width === '16px')).toBe(true);
    expect(activePixels.every((pixel) => pixel.style.height === '16px')).toBe(true);
    expect(
      activePixels.every(
        (pixel) =>
          Number.parseInt(pixel.style.left, 10) % 16 === 0 &&
          Number.parseInt(pixel.style.top, 10) % 16 === 0,
      ),
    ).toBe(true);
    const horizontalSpacing = activePixels
      .map((pixel) => Number.parseInt(pixel.style.left, 10))
      .sort((left, right) => left - right);
    expect(horizontalSpacing.slice(1)).toEqual(
      horizontalSpacing.slice(0, -1).map((left) => left + 16),
    );
    expect(activePixels[0]?.style.left).not.toBe('680px');
    expect(activePixels[0]?.style.opacity).toBe('0');
    expect(window.getComputedStyle(document.body).cursor).not.toBe('none');

    act(() => root.unmount());
    target.remove();
    container.remove();
  });

  it('does not paint while the opening fluid stage is visible or on coarse pointers', () => {
    const hero = document.createElement('section');
    hero.className = 'yuji-wordmark-hero';
    document.body.appendChild(hero);
    const header = document.createElement('header');
    document.body.appendChild(header);
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1_200,
      top: 0,
      width: 1_200,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => header),
    });

    const stage = createStage();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <YujiStageContext.Provider value={stage}>
          <YujiPixelTrail />
        </YujiStageContext.Provider>,
      ),
    );

    act(() => {
      stage.pointerBus.move(360, 240, { height: 800, left: 0, top: 0, width: 1_200 }, 16);
      stage.pointerBus.move(420, 280, { height: 800, left: 0, top: 0, width: 1_200 }, 32);
    });
    expect(
      Array.from(container.querySelectorAll<HTMLElement>('.yuji-pixel-trail i')).some((pixel) =>
        pixel.style.animation.includes('yuji-pixel-trail-fade'),
      ),
    ).toBe(false);

    act(() => root.unmount());
    hero.remove();
    header.remove();
    container.remove();

    mockFinePointer(false);
    const coarseStage = createStage();
    const coarseContainer = document.createElement('div');
    document.body.appendChild(coarseContainer);
    const coarseRoot = createRoot(coarseContainer);
    act(() =>
      coarseRoot.render(
        <YujiStageContext.Provider value={coarseStage}>
          <YujiPixelTrail />
        </YujiStageContext.Provider>,
      ),
    );
    act(() => {
      coarseStage.pointerBus.move(520, 280, { height: 800, left: 0, top: 0, width: 1_200 }, 16);
      coarseStage.pointerBus.move(600, 340, { height: 800, left: 0, top: 0, width: 1_200 }, 32);
    });
    expect(
      Array.from(coarseContainer.querySelectorAll<HTMLElement>('.yuji-pixel-trail i')).some(
        (pixel) => pixel.style.animation.includes('yuji-pixel-trail-fade'),
      ),
    ).toBe(false);

    act(() => coarseRoot.unmount());
    coarseContainer.remove();
  });
});
