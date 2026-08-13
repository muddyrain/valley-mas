import { describe, expect, it, vi } from 'vitest';
import { showLongScreenshotWindow } from './long-screenshot-window';

function createWindow(destroyed = false) {
  const showInactive = vi.fn();
  let readyToShow: (() => void) | undefined;
  return {
    target: {
      isDestroyed: () => destroyed,
      once: (_event: 'ready-to-show', listener: () => void) => {
        readyToShow = listener;
      },
      showInactive,
    },
    emitReadyToShow: () => readyToShow?.(),
    showInactive,
  };
}

describe('showLongScreenshotWindow', () => {
  it('waits for the renderer and applies final bounds before the first show', () => {
    const fixture = createWindow();
    const beforeShow = vi.fn();

    showLongScreenshotWindow(fixture.target, beforeShow);

    expect(beforeShow).not.toHaveBeenCalled();
    expect(fixture.showInactive).not.toHaveBeenCalled();

    fixture.emitReadyToShow();

    expect(beforeShow).toHaveBeenCalledOnce();
    expect(fixture.showInactive).toHaveBeenCalledOnce();
    expect(beforeShow.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.showInactive.mock.invocationCallOrder[0],
    );
  });

  it('does not show a window that was destroyed before the renderer became ready', () => {
    const fixture = createWindow(true);

    showLongScreenshotWindow(fixture.target);
    fixture.emitReadyToShow();

    expect(fixture.showInactive).not.toHaveBeenCalled();
  });
});
