import { useEffect, useRef, useState } from 'react';

import { createMapSession, type MapSession, type MapSessionState } from '@/map';
import { P21_ACCEPTANCE_WORLD } from '@/map/projection/P21AcceptanceScene';
import { P22_ACCEPTANCE_WORLD } from '@/map/projection/P22AcceptanceScene';
import { P23_ACCEPTANCE_WORLD } from '@/map/projection/P23AcceptanceScene';
import { MapEntryShell } from './MapEntryShell';

type MapDebugMode = 'off' | 'ground' | 'biome' | 'terrain' | 'chunk' | 'autotile';

const debugModes: ReadonlyArray<{ readonly id: MapDebugMode; readonly label: string }> = [
  { id: 'off', label: '关闭' },
  { id: 'ground', label: '地表' },
  { id: 'biome', label: '生境' },
  { id: 'terrain', label: '地形' },
  { id: 'chunk', label: '分块' },
  { id: 'autotile', label: '遮罩' },
];

interface PendingFocus {
  readonly eventName: 'map-focus-p2-1' | 'map-focus-p2-2' | 'map-focus-p2-3';
  readonly detail: string;
  readonly world: { readonly templateId: string; readonly seed: number };
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<MapSession | null>(null);
  const [sessionState, setSessionState] = useState<MapSessionState | null>(null);
  const [debugMode, setDebugMode] = useState<MapDebugMode>('off');
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);

  useEffect(() => {
    let disposed = false;
    let mapSession: MapSession | undefined;
    let unsubscribe: (() => void) | undefined;
    const startId = window.setTimeout(() => {
      if (disposed || canvasRef.current === null) return;
      mapSession = createMapSession(canvasRef.current);
      unsubscribe = mapSession.subscribe(setSessionState);
      setSession(mapSession);
    }, 0);
    return () => {
      disposed = true;
      window.clearTimeout(startId);
      unsubscribe?.();
      mapSession?.destroy();
    };
  }, []);

  useEffect(() => {
    if (sessionState?.status === 'template-selection') {
      setPendingFocus(null);
      return;
    }
    if (
      pendingFocus === null ||
      sessionState?.status !== 'world' ||
      sessionState.templateId !== pendingFocus.world.templateId ||
      sessionState.seed !== pendingFocus.world.seed
    ) {
      return;
    }
    window.dispatchEvent(new CustomEvent(pendingFocus.eventName, { detail: pendingFocus.detail }));
    setPendingFocus(null);
  }, [pendingFocus, sessionState]);

  useEffect(() => {
    const gameWindow = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (milliseconds: number) => void;
    };
    gameWindow.render_game_to_text = () =>
      JSON.stringify({
        coordinateSystem: 'origin top-left; x east; y south; one logical cell is 4 pixels',
        session: sessionState,
        renderer: window.__eonMapRuntime?.getDebugState() ?? null,
      });
    gameWindow.advanceTime = (milliseconds) => window.__eonMapRuntime?.advanceTime(milliseconds);
    return () => {
      delete gameWindow.render_game_to_text;
      delete gameWindow.advanceTime;
    };
  }, [sessionState]);

  useEffect(() => {
    const toggleFullscreen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat) return;
      if (document.fullscreenElement !== null) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    };
    window.addEventListener('keydown', toggleFullscreen);
    return () => window.removeEventListener('keydown', toggleFullscreen);
  }, []);

  const changeDebugMode = (mode: MapDebugMode) => {
    setDebugMode(mode);
    window.dispatchEvent(new CustomEvent('map-debug-mode', { detail: mode }));
  };

  const focusAcceptanceScene = (focus: PendingFocus) => {
    if (session === null) return;
    if (
      sessionState?.status === 'world' &&
      sessionState.templateId === focus.world.templateId &&
      sessionState.seed === focus.world.seed
    ) {
      window.dispatchEvent(new CustomEvent(focus.eventName, { detail: focus.detail }));
      return;
    }
    setPendingFocus(focus);
    session.generate(focus.world);
  };

  return (
    <main className="eon-shell">
      <canvas ref={canvasRef} className="world-canvas" aria-label="世界地图" />
      {session !== null && <MapEntryShell session={session} />}
      {sessionState?.status === 'world' && (
        <aside className="map-debug" aria-label="地图调试">
          <span className="map-debug__title">地图预览</span>
          <div className="map-debug__modes">
            {debugModes.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={debugMode === id ? 'is-active' : undefined}
                data-debug-mode={id}
                onClick={() => changeDebugMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="map-debug__focus">
            <button
              type="button"
              data-focus="world"
              onClick={() => window.dispatchEvent(new Event('map-focus-world'))}
            >
              世界
            </button>
            <button
              type="button"
              data-focus="region"
              onClick={() => window.dispatchEvent(new Event('map-focus-region'))}
            >
              区域
            </button>
            <button
              type="button"
              data-focus="rainforest"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-1',
                  detail: 'rainforest',
                  world: P21_ACCEPTANCE_WORLD,
                })
              }
            >
              雨林
            </button>
            <button
              type="button"
              data-focus="wetland"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-1',
                  detail: 'wetland',
                  world: P21_ACCEPTANCE_WORLD,
                })
              }
            >
              湿地
            </button>
            <button
              type="button"
              data-focus="savanna"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-2',
                  detail: 'savanna',
                  world: P22_ACCEPTANCE_WORLD,
                })
              }
            >
              草原
            </button>
            <button
              type="button"
              data-focus="desert"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-2',
                  detail: 'desert',
                  world: P22_ACCEPTANCE_WORLD,
                })
              }
            >
              沙漠
            </button>
            <button
              type="button"
              data-focus="tundra"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-3',
                  detail: 'tundra',
                  world: P23_ACCEPTANCE_WORLD,
                })
              }
            >
              苔原
            </button>
            <button
              type="button"
              data-focus="polar"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-3',
                  detail: 'polar',
                  world: P23_ACCEPTANCE_WORLD,
                })
              }
            >
              极地
            </button>
            <button
              type="button"
              data-focus="cold-elevation"
              onClick={() =>
                focusAcceptanceScene({
                  eventName: 'map-focus-p2-3',
                  detail: 'coldElevation',
                  world: P23_ACCEPTANCE_WORLD,
                })
              }
            >
              寒岭
            </button>
          </div>
        </aside>
      )}
    </main>
  );
}
