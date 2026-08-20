import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type Point, type Rectangle, validateSelection } from './core/geometry';
import type { SelectionHandle } from './core/selection-adjustment';
import {
  beginSelectionGesture,
  type SelectionGesture,
  updateSelectionGesture,
} from './core/selection-controller';
import { canStartSelectionGesture } from './core/selection-gesture';
import { shouldShowSelectionLabel } from './core/selection-label';
import { createSelectionMaskRects } from './core/selection-mask';
import { findWindowTargetAtOrDisplay, type WindowTarget } from './core/window-target';
import type { ScreenshotDisplayFrame } from './shared/contracts';

const HANDLES: SelectionHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function getDisplayBounds(): Rectangle {
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
}

type SelectionOverlayProps = {
  interactive?: boolean;
  purpose: 'recording' | 'screenshot';
  displayId?: string;
};

export function SelectionOverlay({
  interactive = true,
  purpose,
  displayId,
}: SelectionOverlayProps) {
  const gestureRef = useRef<SelectionGesture | undefined>(undefined);
  const hoverPointRef = useRef<Point | undefined>(undefined);
  const pendingSelectionRef = useRef<Rectangle | undefined>(undefined);
  const selectionFrameRef = useRef<number | undefined>(undefined);
  const selectionDisplayIdRef = useRef<string | undefined>(undefined);
  const [selection, setSelection] = useState<Rectangle>();
  const [error, setError] = useState<string>();
  const [frozenFrame, setFrozenFrame] = useState<ScreenshotDisplayFrame>();
  const [configuring, setConfiguring] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [windowTargets, setWindowTargets] = useState<WindowTarget[]>([]);
  const [suggestedTarget, setSuggestedTarget] = useState<WindowTarget>();
  const [activeDisplayId, setActiveDisplayId] = useState<string>();

  useLayoutEffect(() => {
    if (!interactive || purpose === 'screenshot') return;
    setFrozenFrame(undefined);
    window.screenRecorder.selectionReady();
  }, [interactive, purpose]);

  useEffect(() => {
    if (!interactive || purpose !== 'screenshot' || !displayId) return;
    let active = true;
    setFrozenFrame(undefined);
    void window.screenRecorder
      .getScreenshotDisplayFrame()
      .then(async (frame) => {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('无法读取截图固定画面'));
          image.src = frame.imageDataUrl;
        });
        if (!active) return;
        setFrozenFrame(frame);
        requestAnimationFrame(() => {
          if (active) window.screenRecorder.selectionReady();
        });
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : '无法准备截图固定画面');
        window.screenRecorder.selectionReady();
      });
    return () => {
      active = false;
    };
  }, [displayId, interactive, purpose]);

  useEffect(
    () => () => {
      if (selectionFrameRef.current !== undefined) {
        cancelAnimationFrame(selectionFrameRef.current);
      }
      window.screenRecorder.setSelectionGestureActive(false);
    },
    [],
  );

  useEffect(() => {
    if (configuring || !activeDisplayId) return;
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
            const target = findWindowTargetAtOrDisplay(targets, hoverPoint, getDisplayBounds());
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
  }, [activeDisplayId, configuring]);

  useEffect(() => {
    const applySnapshot = (
      snapshot: Awaited<ReturnType<typeof window.screenRecorder.getSnapshot>>,
    ) => {
      const nextDisplayId = snapshot.selectionDisplay?.id;
      if (selectionDisplayIdRef.current !== nextDisplayId) {
        gestureRef.current = undefined;
        hoverPointRef.current = undefined;
        pendingSelectionRef.current = undefined;
        if (selectionFrameRef.current !== undefined) {
          cancelAnimationFrame(selectionFrameRef.current);
          selectionFrameRef.current = undefined;
        }
        setSelection(undefined);
        setGestureActive(false);
        setSuggestedTarget(undefined);
        setWindowTargets([]);
        setActiveDisplayId(nextDisplayId);
      }
      selectionDisplayIdRef.current = nextDisplayId;
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
      if (event.key === 'Escape') {
        gestureRef.current = undefined;
        setGestureActive(false);
        window.screenRecorder.setSelectionGestureActive(false);
        void cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [configuring]);

  const scheduleSelection = (rect: Rectangle | undefined) => {
    pendingSelectionRef.current = rect;
    if (selectionFrameRef.current !== undefined) return;
    selectionFrameRef.current = requestAnimationFrame(() => {
      selectionFrameRef.current = undefined;
      setSelection(pendingSelectionRef.current);
    });
  };

  const flushSelection = (rect: Rectangle | undefined) => {
    if (selectionFrameRef.current !== undefined) {
      cancelAnimationFrame(selectionFrameRef.current);
      selectionFrameRef.current = undefined;
    }
    pendingSelectionRef.current = rect;
    setSelection(rect);
  };

  const pointFromEvent = (event: React.PointerEvent): Point => ({
    x: Math.min(Math.max(0, event.clientX), window.innerWidth),
    y: Math.min(Math.max(0, event.clientY), window.innerHeight),
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (!canStartSelectionGesture(event.button, event.isPrimary)) return;
    if ((event.target as HTMLElement).closest('.capture-mode-toolbar')) return;
    event.currentTarget.classList.add('selection-overlay-gesture-active');
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
      const target = findWindowTargetAtOrDisplay(windowTargets, point, getDisplayBounds());
      gestureRef.current = beginSelectionGesture({
        point,
        suggestedSelection: target.rect,
      });
      setSuggestedTarget(target);
      setSelection(target.rect);
    }
    setGestureActive(true);
    window.screenRecorder.setSelectionGestureActive(true);
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
    updateSelectionGesture(gesture, point, getDisplayBounds());

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const gesture = gestureRef.current;
    const point = pointFromEvent(event);
    hoverPointRef.current = point;
    if (gesture) {
      setSuggestedTarget(undefined);
      scheduleSelection(selectionForGesture(gesture, point));
      return;
    }
    if (!configuring) {
      const target = findWindowTargetAtOrDisplay(windowTargets, point, getDisplayBounds());
      setSuggestedTarget(target);
      scheduleSelection(target?.rect);
    }
  };

  const onPointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (!canStartSelectionGesture(event.button, event.isPrimary)) return;
    const gesture = gestureRef.current;
    gestureRef.current = undefined;
    if (!gesture) return;
    const rect = selectionForGesture(gesture, pointFromEvent(event));
    setSuggestedTarget(undefined);
    flushSelection(rect);
    try {
      validateSelection(rect);
      if (configuring) await window.screenRecorder.updateConfiguredSelection(rect);
      else await window.screenRecorder.confirmSelection(rect);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '选区无效');
    } finally {
      setGestureActive(false);
      window.screenRecorder.setSelectionGestureActive(false);
    }
  };

  const cancelFromRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (!interactive) return;
    gestureRef.current = undefined;
    setGestureActive(false);
    window.screenRecorder.setSelectionGestureActive(false);
    flushSelection(undefined);
    if (configuring) void window.screenRecorder.cancelConfiguredRecording();
    else void window.screenRecorder.cancelSelection();
  };

  const maskRects = createSelectionMaskRects(getDisplayBounds(), selection);

  return (
    <div
      className={`selection-overlay selection-overlay-ready${selection ? ' selection-overlay-has-selection' : ''}${configuring ? ' selection-overlay-configuring' : ''}${gestureActive ? ' selection-overlay-gesture-active' : ''}${interactive ? '' : ' selection-overlay-handoff'}`}
      onContextMenu={cancelFromRightClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => void onPointerUp(event)}
      onPointerCancel={() => {
        gestureRef.current = undefined;
        setGestureActive(false);
        window.screenRecorder.setSelectionGestureActive(false);
        setSuggestedTarget(undefined);
        flushSelection(undefined);
      }}
    >
      {purpose === 'screenshot' && frozenFrame && (
        <img
          className="screenshot-frozen-frame"
          src={frozenFrame.imageDataUrl}
          alt=""
          draggable={false}
        />
      )}
      {maskRects.map((rect, index) => (
        <div
          className="selection-mask"
          // The mask rectangles keep a stable DOM layer while pointer movement only updates geometry.
          key={index}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        />
      ))}
      {!configuring && !gestureActive && (
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
      {!gestureActive && (
        <div className="selection-help">
          {configuring ? '拖动选区或控制点调整 · 右键取消' : '拖拽选择区域 · 右键或 Esc 取消'}
        </div>
      )}
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
          {shouldShowSelectionLabel(selection, suggestedTarget !== undefined) && (
            <span className="selection-size">
              {suggestedTarget ? `${suggestedTarget.title} · ` : ''}
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </span>
          )}
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
