import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldRunFocusTimerRuntime } from '../src/components/runtimeGatePolicy';
import {
  deriveActiveAppIds,
  deriveRunningAppIds,
  deriveVisibleAppIds,
  useWindowStore,
} from '../src/store/windowStore';

const initialWindowState = {
  windows: [],
  topZ: 10,
  focusedId: null,
  focusedAppId: null,
  lastRects: {},
  runningAppIds: [],
  visibleAppIds: [],
  activeAppIds: [],
};

describe('desktop window lifecycle', () => {
  afterEach(() => {
    useWindowStore.setState(initialWindowState);
    vi.unstubAllGlobals();
  });

  it('derives unique running app ids from open windows', () => {
    expect(
      deriveRunningAppIds([
        buildWindow('finder-1', 'finder'),
        buildWindow('finder-2', 'finder'),
        buildWindow('music-1', 'music'),
      ]),
    ).toEqual(['finder', 'music']);
  });

  it('derives visible and active app ids from non-minimized windows', () => {
    const windows = [
      buildWindow('finder-1', 'finder'),
      buildWindow('music-1', 'music', { minimized: true, lifecycleState: 'minimized' }),
      buildWindow('finder-2', 'finder'),
    ];

    expect(deriveVisibleAppIds(windows)).toEqual(['finder']);
    expect(deriveActiveAppIds(windows)).toEqual(['finder']);
  });

  it('updates running apps only when windows open or close', () => {
    vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900 });
    const store = useWindowStore.getState();

    const finderId = store.openWindow('finder');
    const musicId = useWindowStore.getState().openWindow('music');

    expect(useWindowStore.getState().runningAppIds).toEqual(['finder', 'music']);

    useWindowStore.getState().focusWindow(finderId);
    useWindowStore.getState().moveWindow(finderId, 120, 96);
    useWindowStore.getState().resizeWindow(finderId, { width: 900 });
    useWindowStore.getState().minimizeWindow(finderId);

    expect(useWindowStore.getState().runningAppIds).toEqual(['finder', 'music']);
    expect(useWindowStore.getState().visibleAppIds).toEqual(['music']);
    expect(useWindowStore.getState().activeAppIds).toEqual(['music']);

    useWindowStore.getState().closeWindow(musicId);

    expect(useWindowStore.getState().runningAppIds).toEqual(['finder']);
    expect(useWindowStore.getState().visibleAppIds).toEqual([]);
    expect(useWindowStore.getState().activeAppIds).toEqual([]);
  });

  it('tracks focused app id without changing it on move or resize', () => {
    vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900 });
    const store = useWindowStore.getState();

    const finderId = store.openWindow('finder');

    expect(useWindowStore.getState().focusedAppId).toBe('finder');

    useWindowStore.getState().moveWindow(finderId, 180, 140);
    useWindowStore.getState().resizeWindow(finderId, { width: 920, height: 580 });

    expect(useWindowStore.getState().focusedAppId).toBe('finder');

    useWindowStore.getState().openWindow('music');
    expect(useWindowStore.getState().focusedAppId).toBe('music');

    useWindowStore.getState().focusWindow(finderId);
    expect(useWindowStore.getState().focusedAppId).toBe('finder');
    expect(useWindowStore.getState().windows.find((w) => w.id === finderId)?.lifecycleState).toBe(
      'active',
    );
  });

  it('keeps focus timer runtime mounted only for an open window or active countdown', () => {
    expect(
      shouldRunFocusTimerRuntime({
        isFocusWindowRunning: false,
        focusStatus: 'idle',
        hasPendingCompletion: false,
      }),
    ).toBe(false);
    expect(
      shouldRunFocusTimerRuntime({
        isFocusWindowRunning: true,
        focusStatus: 'idle',
        hasPendingCompletion: false,
      }),
    ).toBe(true);
    expect(
      shouldRunFocusTimerRuntime({
        isFocusWindowRunning: false,
        focusStatus: 'running',
        hasPendingCompletion: false,
      }),
    ).toBe(true);
    expect(
      shouldRunFocusTimerRuntime({
        isFocusWindowRunning: false,
        focusStatus: 'paused',
        hasPendingCompletion: false,
      }),
    ).toBe(false);
    expect(
      shouldRunFocusTimerRuntime({
        isFocusWindowRunning: false,
        focusStatus: 'idle',
        hasPendingCompletion: true,
      }),
    ).toBe(true);
  });
});

function buildWindow(
  id: string,
  appId: 'finder' | 'music',
  override: Partial<ReturnType<typeof buildWindowBase>> = {},
) {
  return { ...buildWindowBase(id, appId), ...override };
}

function buildWindowBase(id: string, appId: 'finder' | 'music') {
  return {
    id,
    appId,
    title: appId,
    x: 0,
    y: 0,
    width: 640,
    height: 420,
    zIndex: 10,
    minimized: false,
    maximized: false,
    lifecycleState: 'active' as const,
  };
}
