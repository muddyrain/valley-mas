import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('desktop runtime lifecycle surface', () => {
  it('uses runtime gates instead of mounting heavy runtimes directly from App', () => {
    const appSource = readSource('src/App.tsx');

    expect(appSource).toContain('MusicRuntimeGate');
    expect(appSource).not.toContain("import MusicRuntime from './components/MusicRuntime'");
    expect(appSource).not.toContain('AIPetRuntime');
  });

  it('does not load resource data from the desktop root', () => {
    const appSource = readSource('src/App.tsx');
    const finderSource = readSource('src/apps/FinderWindow.tsx');
    const safariSource = readSource('src/apps/SafariWindow.tsx');
    const spotlightSource = readSource('src/spotlight/Spotlight.tsx');
    const blogSource = readSource('src/apps/BlogWindow.tsx');

    expect(appSource).not.toContain('useResourceStore');
    expect(appSource).not.toContain('loadResources()');
    expect(appSource).not.toContain('useBlogStore');
    expect(appSource).not.toContain('loadPosts()');
    expect(finderSource).toContain('loadResources');
    expect(safariSource).toContain('loadResources');
    expect(spotlightSource).toContain('loadResources');
    expect(blogSource).toContain('loadPosts');
  });

  it('keeps audio runtime behind a lazy gate and removes the pet runtime', () => {
    const musicGateSource = readSource('src/components/MusicRuntimeGate.tsx');

    expect(existsSync('src/ai-pet/AIPetRuntimeGate.tsx')).toBe(false);
    expect(musicGateSource).toContain('runtimeEnabled');
    expect(musicGateSource).toContain('runningAppIds.includes');
    expect(musicGateSource).toContain('shouldRunMusicRuntime');
    expect(musicGateSource).toContain('MusicRuntime');
  });

  it('keeps focus timer runtime behind window and pending-work gates', () => {
    const focusRuntimeSource = readSource('src/components/FocusTimerRuntime.tsx');
    const policySource = readSource('src/components/runtimeGatePolicy.ts');

    expect(focusRuntimeSource).toContain('runningAppIds.includes');
    expect(focusRuntimeSource).toContain('focusNotifiedCompletionId');
    expect(focusRuntimeSource).toContain('markFocusCompletionNotified');
    expect(policySource).toContain('hasPendingCompletion');
  });

  it('syncs the store with real audio playback events', () => {
    const runtimeSource = readSource('src/components/MusicRuntime.tsx');
    const onPlayingIndex = runtimeSource.indexOf('onPlaying={() =>');

    expect(onPlayingIndex).toBeGreaterThan(-1);
    expect(runtimeSource.indexOf('setPlaying(true)', onPlayingIndex)).toBeGreaterThan(
      onPlayingIndex,
    );
  });

  it('delays visible music loading indicators to avoid playback flicker', () => {
    const musicWindowSource = readSource('src/apps/MusicWindow.tsx');
    const musicMenuSource = readSource('src/components/MusicMenuItem.tsx');
    const notificationSource = readSource('src/components/NotificationCenter.tsx');

    expect(musicWindowSource).toContain('useDelayedFlag(isBuffering)');
    expect(musicMenuSource).toContain('useDelayedFlag(isBuffering)');
    expect(notificationSource).toContain('useDelayedFlag(musicBuffering)');
  });

  it('keeps the menu bar music surface lightweight before activation', () => {
    const menuSource = readSource('src/components/MenuBar.tsx');
    const musicMenuSource = readSource('src/components/MusicMenuItem.tsx');

    expect(menuSource).toContain('MusicMenuItemGate');
    expect(menuSource).not.toContain('<MusicMenuItem />');
    expect(musicMenuSource).toContain('runtimeEnabled');
    expect(musicMenuSource).toContain('MusicMenuItemGate');
    expect(musicMenuSource).toContain('menu-music__idle');
  });

  it('does not pass desktop app content as Window children', () => {
    const managerSource = readSource('src/components/window/WindowManager.tsx');
    const windowSource = readSource('src/components/window/Window.tsx');

    expect(managerSource).not.toContain('<Window key={w.id} state={w}>');
    expect(managerSource).toContain('appId={w.appId}');
    expect(windowSource).toContain('DesktopAppHost');
    expect(windowSource).toContain('renderDesktopApp');
  });

  it('loads window apps through lazy renderers instead of the desktop entry bundle', () => {
    const renderersSource = readSource('src/apps/appRenderers.tsx');

    expect(renderersSource).toContain('lazy(() => import');
    expect(renderersSource).toContain('Suspense');
    expect(renderersSource).not.toContain("import FinderWindow from './FinderWindow'");
    expect(renderersSource).not.toContain("import DiceCupWindow from './DiceCupWindow'");
  });

  it('keeps Launchpad heavy subscriptions behind an open gate', () => {
    const launchpadSource = readSource('src/components/Launchpad.tsx');

    expect(launchpadSource).toContain('function LaunchpadPanel');
    // LaunchpadPanel is rendered inside PlushPop, gated by isOpen ternary in PlushPresence
    expect(launchpadSource).toMatch(/PlushPresence[\s\S]*?PlushPop[\s\S]*?LaunchpadPanel/);
    expect(launchpadSource.indexOf('const query = useLaunchpadStore')).toBeGreaterThan(
      launchpadSource.indexOf('function LaunchpadPanel'),
    );
    expect(launchpadSource.indexOf('const runningAppIds = useWindowStore')).toBeGreaterThan(
      launchpadSource.indexOf('function LaunchpadPanel'),
    );
  });

  it('keeps menu bar focused-window subscriptions primitive', () => {
    const menuSource = readSource('src/components/MenuBar.tsx');

    expect(menuSource).toContain('focusedAppId');
    expect(menuSource).toContain('focusedId');
    expect(menuSource).not.toContain('windows.find');
  });

  it('coalesces window drag and resize writes with animation frames', () => {
    const windowSource = readSource('src/components/window/Window.tsx');
    const resizeHandlesSource = readSource('src/ui/ResizeHandles.tsx');

    expect(windowSource).toContain('requestAnimationFrame');
    expect(windowSource).toContain('cancelAnimationFrame');
    expect(resizeHandlesSource).toContain('requestAnimationFrame');
    expect(resizeHandlesSource).toContain('cancelAnimationFrame');
  });

  it('moves global desktop listeners and notification polling behind gates', () => {
    const appSource = readSource('src/App.tsx');
    const globalEventsSource = readSource('src/components/DesktopGlobalEvents.tsx');
    const notificationGateSource = readSource('src/components/NotificationPollingGate.tsx');

    expect(appSource).toContain('DesktopGlobalEvents');
    expect(appSource).toContain('NotificationPollingGate');
    expect(appSource).not.toContain('setInterval');
    expect(appSource).not.toContain('addEventListener');
    expect(globalEventsSource).toContain('addEventListener');
    expect(notificationGateSource).toContain('setInterval');
    expect(notificationGateSource).toContain('visibilityState');
  });

  it('keeps the menu clock in a dedicated gate', () => {
    const menuSource = readSource('src/components/MenuBar.tsx');
    const clockGateSource = readSource('src/components/ClockGate.tsx');

    expect(menuSource).toContain('ClockGate');
    expect(menuSource).not.toContain('setInterval');
    expect(clockGateSource).toContain('setInterval');
  });

  it('keeps minimized foreground apps unmounted from DesktopAppHost', () => {
    const desktopAppsSource = readSource('src/apps/desktopApps.ts');
    const windowSource = readSource('src/components/window/Window.tsx');

    expect(desktopAppsSource).toContain('runtimePolicy');
    expect(desktopAppsSource).toContain('foreground-only');
    expect(windowSource).toContain('lifecycleState');
    expect(windowSource).toContain('runtimePolicy');
    expect(windowSource).toContain('return null');
  });

  it('does not subscribe Spotlight to resources while closed', () => {
    const spotlightSource = readSource('src/spotlight/Spotlight.tsx');

    expect(spotlightSource).toContain('function SpotlightGate');
    expect(spotlightSource).toContain('function SpotlightPanel');
    expect(spotlightSource.indexOf('useResourceStore((s) => s.resources)')).toBeGreaterThan(
      spotlightSource.indexOf('function SpotlightPanel'),
    );
  });

  it('does not load Safari resource shortcuts while a page is open', () => {
    const safariSource = readSource('src/apps/SafariWindow.tsx');

    expect(safariSource).toContain('!currentUrl');
    expect(safariSource).toContain('scheduleIdleWork');
    expect(safariSource).not.toContain('useEffect(() => {\n    void loadResources();');
  });

  it('keeps Finder scroll persistence off the hot scroll path', () => {
    const finderSource = readSource('src/apps/FinderWindow.tsx');
    const storeSource = readSource('src/store/finderStore.ts');

    expect(finderSource).toContain('rememberScrollTop');
    expect(finderSource).not.toContain(
      'rememberViewState({ scrollTop: e.currentTarget.scrollTop })',
    );
    expect(storeSource).toContain('createDebouncedStorageWriter');
  });

  it('uses async lazy image decoding by default', () => {
    const plushImageSource = readSource('src/ui/PlushImage.tsx');

    expect(plushImageSource).toContain("loading = 'lazy'");
    expect(plushImageSource).toContain("decoding = 'async'");
  });

  it('keeps the system shell on neutral light theme tokens', () => {
    const themeSource = readSource('src/styles/theme.css');
    const windowSource = readSource('src/components/window/Window.css');
    const menuSource = readSource('src/components/MenuBar.css');
    const dockSource = readSource('src/components/Dock.css');
    const launchpadSource = readSource('src/components/Launchpad.css');
    const spotlightSource = readSource('src/spotlight/Spotlight.css');

    expect(themeSource).toContain('--system-bg: #fafafa');
    expect(themeSource).toContain('--system-titlebar');
    expect(themeSource).toContain('--background: var(--system-bg)');
    expect(themeSource).toContain('--popover: var(--system-popover)');
    expect(themeSource).toContain('--ring: var(--system-ring)');
    expect(windowSource).toContain('background: var(--system-titlebar)');
    expect(windowSource).toContain('background: var(--system-panel-strong)');
    expect(menuSource).toContain('background: var(--system-popover)');
    expect(dockSource).toContain('background: var(--system-popover)');
    expect(launchpadSource).toContain('outline: 3px solid var(--system-ring)');
    expect(spotlightSource).toContain('background: var(--system-popover)');
  });

  it('keeps app window surfaces on shared neutral app tokens', () => {
    const themeSource = readSource('src/styles/theme.css');
    const primitivesSource = readSource('src/ui/PlushPrimitives.css');
    const finderSource = readSource('src/apps/FinderWindow.css');
    const blogSource = readSource('src/apps/BlogWindow.css');
    const dockAppsSource = readSource('src/apps/DockAppWindows.css');
    const miniAppsSource = readSource('src/apps/MiniApps.css');

    expect(themeSource).toContain('--app-panel');
    expect(themeSource).toContain('--app-card');
    expect(themeSource).toContain('--app-field');
    expect(themeSource).toContain('--app-primary: var(--system-text)');
    expect(primitivesSource).toContain('.plush-app-panel');
    expect(primitivesSource).toContain('.plush-app-card');
    expect(primitivesSource).toContain('.plush-app-toolbar');
    expect(primitivesSource).toContain('.plush-app-field');
    expect(finderSource).toContain('Neutral Light app surface consolidation');
    expect(blogSource).toContain('Neutral Light app surface consolidation');
    expect(dockAppsSource).toContain('Neutral Light app surface consolidation');
    expect(miniAppsSource).toContain('Neutral Light app surface consolidation');
    expect(dockAppsSource).toContain('background: var(--app-card)');
    expect(miniAppsSource).toContain('background: var(--app-card)');
  });
});
