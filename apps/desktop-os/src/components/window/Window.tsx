import { useRef, useState } from 'react';
import { useWindowStore, type WindowState } from '../../store/windowStore';
import ResizeHandles from '../../ui/ResizeHandles';
import TrafficLights from '../../ui/TrafficLights';
import './Window.css';

interface Props {
  state: WindowState;
  children?: React.ReactNode;
}

const CLOSE_ANIM_MS = 220;

export default function Window({ state, children }: Props) {
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const focusedId = useWindowStore((s) => s.focusedId);

  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const closingRef = useRef(false);
  const [isClosing, setIsClosing] = useState(false);
  const isFocused = focusedId === state.id;

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
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      moveWindow(
        state.id,
        ev.clientX - dragRef.current.offsetX,
        Math.max(28, ev.clientY - dragRef.current.offsetY),
      );
    };
    const onUp = () => {
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
      <div className="window__body">{children}</div>
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
