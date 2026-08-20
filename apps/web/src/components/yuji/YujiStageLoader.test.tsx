/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import YujiStageLoader from './YujiStageLoader';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.overflow = '';
  document.body.replaceChildren();
});

describe('YujiStageLoader', () => {
  it('holds the page until the stage is ready, then releases the entrance once', () => {
    vi.useFakeTimers();
    const onReleased = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<YujiStageLoader onReleased={onReleased} progress={38} ready={false} />);
    });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(onReleased).not.toHaveBeenCalled();

    act(() => {
      root.render(<YujiStageLoader onReleased={onReleased} progress={100} ready />);
    });
    act(() => {
      vi.advanceTimersByTime(720);
    });

    expect(onReleased).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.is-releasing')).not.toBeNull();

    act(() => vi.advanceTimersByTime(620));
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');

    act(() => root.unmount());
  });
});
