import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type Point, type Rectangle, validateSelection } from './core/geometry';
import type { SelectionHandle } from './core/selection-adjustment';
import {
  beginSelectionGesture,
  type SelectionGesture,
  updateSelectionGesture,
} from './core/selection-controller';
import { canStartSelectionGesture } from './core/selection-gesture';
import { findWindowTargetAt, type WindowTarget } from './core/window-target';

const HANDLES: SelectionHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function SelectionOverlay() {
  const gestureRef = useRef<SelectionGesture | undefined>(undefined);
  const hoverPointRef = useRef<Point | undefined>(undefined);
  const [selection, setSelection] = useState<Rectangle>();
  const [error, setError] = useState<string>();
  const [purpose, setPurpose] = useState<'recording' | 'screenshot'>('recording');
  const [configuring, setConfiguring] = useState(false);
  const [windowTargets, setWindowTargets] = useState<WindowTarget[]>([]);
  const [suggestedTarget, setSuggestedTarget] = useState<WindowTarget>();

  useLayoutEffect(() => {
    window.screenRecorder.selectionReady();
  }, []);

  useEffect(() => {
    if (configuring) return;
    let active = true;
    let refreshCount = 0;
    const loadTargets = () =>
      window.screenRecorder
        .getWindowTargets()
        .then((targets) => {
          if (!active) return;
          setWindowTargets(targets);
          const hoverPoint = hoverPointRef.current;
          if (hoverPoint && !gestureRef.current) {
            const target = findWindowTargetAt(targets, hoverPoint);
            setSuggestedTarget(target);
            setSelection(target?.rect);
          }
        })
        .catch(() => undefined);
    void loadTargets();
    const refreshTimer = window.setInterval(() => {
      refreshCount += 1;
      void loadTargets();
      if (refreshCount >= 20) window.clearInterval(refreshTimer);
    }, 300);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [configuring]);

  useEffect(() => {
    const applySnapshot = (
      snapshot: Awaited<ReturnType<typeof window.screenRecorder.getSnapshot>>,
    ) => {
      if (snapshot.selectionPurpose === 'recording' || snapshot.selectionPurpose === 'screenshot') {
        setPurpose(snapshot.selectionPurpose);
      }
      const isConfiguring = snapshot.state === 'configuring' && snapshot.plan?.mode === 'region';
      setConfiguring(isConfiguring);
      if (isConfiguring && snapshot.plan?.selection && !gestureRef.current) {
        setSelection({
          x: snapshot.plan.selection.x - snapshot.plan.display.bounds.x,
          y: snapshot.plan.selection.y - snapshot.plan.display.bounds.y,
          width: snapshot.plan.selection.width,
          height: snapshot.plan.selection.height,
        });
      }
    };
    void window.screenRecorder.getSnapshot().then(applySnapshot);
    return window.screenRecorder.onSnapshot(applySnapshot);
  }, []);

  useEffect(() => {
    const cancel = () =>
      configuring
        ? window.screenRecorder.cancelConfiguredRecording()
        : window.screenRecorder.cancelSelection();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void cancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [configuring]);

  const bounds = (): Rectangle => ({
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const pointFromEvent = (event: React.PointerEvent): Point => ({
    x: Math.min(Math.max(0, event.clientX), window.innerWidth),
    y: Math.min(Math.max(0, event.clientY), window.innerHeight),
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canStartSelectionGesture(event.button, event.isPrimary)) return;
    if ((event.target as HTMLElement).closest('.capture-mode-toolbar')) return;
    const point = pointFromEvent(event);
    const handleElement = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-selection-handle]',
    );
    const handle = handleElement?.dataset.selectionHandle as SelectionHandle | undefined;
    if (
      configuring &&
      selection &&
      (handle || (event.target as HTMLElement).closest('.selection-box'))
    ) {
      gestureRef.current = beginSelectionGesture({
        point,
        handle: handle ?? 'move',
        selection,
      });
    } else {
      gestureRef.current = beginSelectionGesture({
        point,
        suggestedSelection: suggestedTarget?.rect,
      });
      setSelection(suggestedTarget?.rect);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setError(undefined);
  };

  const switchPurpose = async (next: 'recording' | 'screenshot') => {
    if (next === purpose || configuring) return;
    setError(undefined);
    setSelection(undefined);
    try {
      await window.screenRecorder.switchSelectionPurpose(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法切换捕获模式');
    }
  };

  const selectionForGesture = (gesture: SelectionGesture, point: Point): Rectangle =>
    updateSelectionGesture(gesture, point, bounds());

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const point = pointFromEvent(event);
    hoverPointRef.current = point;
    if (gesture) {
      setSuggestedTarget(undefined);
      setSelection(selectionForGesture(gesture, point));
      return;
    }
    if (!configuring) {
      const target = findWindowTargetAt(windowTargets, point);
      setSuggestedTarget(target);
      setSelection(target?.rect);
    }
  };

  const onPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canStartSelectionGesture(event.button, event.isPrimary)) return;
    const gesture = gestureRef.current;
    gestureRef.current = undefined;
    if (!gesture) return;
    const rect = selectionForGesture(gesture, pointFromEvent(event));
    setSuggestedTarget(undefined);
    setSelection(rect);
    try {
      validateSelection(rect);
      if (configuring) await window.screenRecorder.updateConfiguredSelection(rect);
      else await window.screenRecorder.confirmSelection(rect);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '选区无效');
    }
  };

  const cancelFromRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    gestureRef.current = undefined;
    setSelection(undefined);
    if (configuring) void window.screenRecorder.cancelConfiguredRecording();
    else void window.screenRecorder.cancelSelection();
  };

  return (
    <div
      className={`selection-overlay selection-overlay-ready${selection ? ' selection-overlay-has-selection' : ''}${configuring ? ' selection-overlay-configuring' : ''}`}
      onContextMenu={cancelFromRightClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => void onPointerUp(event)}
    >
      {!configuring && (
        <div className="capture-mode-toolbar" role="tablist" aria-label="捕获模式">
          <button
            type="button"
            role="tab"
            aria-selected={purpose === 'screenshot'}
            className={purpose === 'screenshot' ? 'capture-mode-active' : undefined}
            onClick={() => void switchPurpose('screenshot')}
          >
            截图
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={purpose === 'recording'}
            className={purpose === 'recording' ? 'capture-mode-active' : undefined}
            onClick={() => void switchPurpose('recording')}
          >
            录屏
          </button>
        </div>
      )}
      <div className="selection-help">
        {configuring ? '拖动选区或控制点调整 · 右键取消' : '拖拽选择区域 · 右键或 Esc 取消'}
      </div>
      {selection && (
        <div
          className={`selection-box${configuring ? ' selection-box-configuring' : ''}`}
          style={{
            left: selection.x,
            top: selection.y,
            width: selection.width,
            height: selection.height,
          }}
        >
          <span className="selection-size">
            {suggestedTarget ? `${suggestedTarget.title} · ` : ''}
            {Math.round(selection.width)} × {Math.round(selection.height)}
          </span>
          {configuring &&
            HANDLES.map((handle) => (
              <i
                key={handle}
                className={`selection-handle selection-handle-${handle}`}
                data-selection-handle={handle}
              />
            ))}
        </div>
      )}
      {error && <div className="selection-error">{error}</div>}
    </div>
  );
}
