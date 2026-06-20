import { memo, useRef, useState } from 'react';
import { renderDesktopApp } from '../../apps/appRenderers';
import { getDesktopAppRuntimePolicy } from '../../apps/desktopApps';
import { type AppId, useWindowStore, type WindowState } from '../../store/windowStore';
import ResizeHandles from '../../ui/ResizeHandles';
import TrafficLights from '../../ui/TrafficLights';
import './Window.css';

interface Props {
  state: WindowState;
  appId: AppId;
}

const CLOSE_ANIM_MS = 220;

function Window({ state, appId }: Props) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const isFocused = useWindowStore((s) => s.focusedId === state.id);

  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    x: number;
    y: number;
    frame: number | null;
  } | null>(null);
  const closingRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);

  function handleClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    window.setTimeout(() => closeWindow(state.id), CLOSE_ANIM_MS);
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (state.maximized) return;
    focusWindow(state.id);
    dragRef.current = {
      offsetX: e.clientX - state.x,
      offsetY: e.clientY - state.y,
      x: state.x,
      y: state.y,
      frame: null,
    };
    const flushMove = () => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.frame = null;
      moveWindow(state.id, drag.x, drag.y);
    };
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.x = ev.clientX - drag.offsetX;
      drag.y = Math.max(28, ev.clientY - drag.offsetY);
      if (drag.frame === null) drag.frame = window.requestAnimationFrame(flushMove);
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (drag && drag.frame !== null) {
        window.cancelAnimationFrame(drag.frame);
        moveWindow(state.id, drag.x, drag.y);
      }
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleMaximize() {
    toggleMaximize(state.id, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  return (
    <div
      className={`window ${isFocused ? 'is-focused' : 'is-blurred'} ${state.maximized ? 'is-maximized' : ''} ${state.minimized ? 'is-minimized' : ''} ${isClosing ? 'is-closing' : ''}`}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.zIndex,
      }}
      onPointerDown={() => focusWindow(state.id)}
    >
      <div className="window__titlebar" onPointerDown={startDrag} onDoubleClick={handleMaximize}>
        <TrafficLights
          active={isFocused}
          onClose={handleClose}
          onMinimize={() => minimizeWindow(state.id)}
          onMaximize={handleMaximize}
        />
        <div className="window__title">{state.title}</div>
        <div className="window__titlebar-spacer" />
      </div>
      <div className="window__body">
        <DesktopAppHost appId={appId} lifecycleState={state.lifecycleState} />
      </div>
      {!state.maximized && !isClosing && (
        <ResizeHandles
          rect={{ x: state.x, y: state.y, width: state.width, height: state.height }}
          onResize={(rect) => resizeWindow(state.id, rect)}
          onResizeStart={() => focusWindow(state.id)}
        />
      )}
    </div>
  );
}

export default memo(Window);

const DesktopAppHost = memo(function DesktopAppHost({
  appId,
  lifecycleState,
}: {
  appId: AppId;
  lifecycleState: WindowState['lifecycleState'];
}) {
  const runtimePolicy = getDesktopAppRuntimePolicy(appId);
  if (lifecycleState === 'minimized' && runtimePolicy === 'foreground-only') return null;
  return <>{renderDesktopApp(appId)}</>;
});
