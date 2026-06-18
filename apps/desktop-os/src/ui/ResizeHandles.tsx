import { useRef } from 'react';
import './ResizeHandles.css';

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  rect: Rect;
  minWidth?: number;
  minHeight?: number;
  onResize: (next: Rect) => void;
  onResizeStart?: () => void;
}

const EDGES: Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export default function ResizeHandles({
  rect,
  minWidth = 320,
  minHeight = 200,
  onResize,
  onResizeStart,
}: Props) {
  const startRef = useRef<{ rect: Rect; clientX: number; clientY: number; edge: Edge } | null>(
    null,
  );

  function startResize(edge: Edge) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      startRef.current = {
        rect: { ...rect },
        clientX: e.clientX,
        clientY: e.clientY,
        edge,
      };
      onResizeStart?.();

      const onMove = (ev: PointerEvent) => {
        if (!startRef.current) return;
        const { rect: r, clientX, clientY, edge } = startRef.current;
        const dx = ev.clientX - clientX;
        const dy = ev.clientY - clientY;
        let nx = r.x;
        let ny = r.y;
        let nw = r.width;
        let nh = r.height;

        if (edge.includes('e')) nw = r.width + dx;
        if (edge.includes('w')) {
          nw = r.width - dx;
          nx = r.x + dx;
        }
        if (edge.includes('s')) nh = r.height + dy;
        if (edge.includes('n')) {
          nh = r.height - dy;
          ny = r.y + dy;
        }

        if (nw < minWidth) {
          if (edge.includes('w')) nx -= minWidth - nw;
          nw = minWidth;
        }
        if (nh < minHeight) {
          if (edge.includes('n')) ny -= minHeight - nh;
          nh = minHeight;
        }

        onResize({ x: nx, y: ny, width: nw, height: nh });
      };
      const onUp = () => {
        startRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
  }

  return (
    <>
      {EDGES.map((edge) => (
        <div
          key={edge}
          className={`resize-handle resize-handle--${edge}`}
          onPointerDown={startResize(edge)}
        />
      ))}
    </>
  );
}
