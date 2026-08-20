import {
  ArrowUpRight,
  Check,
  Circle,
  Download,
  Grid3X3,
  Move,
  PenLine,
  Pin,
  Pipette,
  ScanLine,
  Square,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AnnotationStylePopover } from './AnnotationStylePopover';
import { Button, type ButtonProps } from './components/ui/button';
import { Tooltip } from './components/ui/tooltip';
import {
  type AnnotationAction,
  type AnnotationColor,
  type AnnotationMosaicSize,
  type AnnotationStrokeWidth,
  type AnnotationTextScale,
  type AnnotationTool,
  addAnnotation,
  clampTextAnnotationPosition,
  createMosaicAnnotation,
  createTextAnnotation,
  findTextAnnotationAt,
  getMosaicBlocks,
  getTextFontSize,
  moveTextAnnotation,
  resizeTextAnnotation,
  undoAnnotation,
} from './core/annotation';
import { colorFormatForShift, formatPickedColor, type RgbColor, rgbToHex } from './core/color';
import type { Point, Rectangle } from './core/geometry';
import { getScreenshotToolbarPosition } from './core/screenshot-toolbar';
import { adjustSelection, type SelectionHandle } from './core/selection-adjustment';
import { createSelectionMaskRects } from './core/selection-mask';
import type { ScreenshotEditPlan } from './shared/contracts';
import { useShiftColorFormat } from './useShiftColorFormat';

type EditorTool = AnnotationTool | 'move' | 'eyedropper';
const STYLE_TOOLS: AnnotationTool[] = ['rectangle', 'ellipse', 'arrow', 'pen', 'mosaic', 'text'];
const MOSAIC_SIZE_OPTIONS = [
  { value: 8, label: '小', dotSize: 8 },
  { value: 16, label: '中', dotSize: 12 },
  { value: 24, label: '大', dotSize: 16 },
];
const TEXT_SIZE_OPTIONS = [
  { value: 1, label: '小', dotSize: 8 },
  { value: 1.5, label: '中', dotSize: 12 },
  { value: 2, label: '大', dotSize: 16 },
];
const SCREENSHOT_SELECTION_HANDLES: SelectionHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

function ToolbarButton({
  tooltip,
  children,
  ...props
}: ButtonProps & { tooltip: string; children: ReactNode }) {
  return (
    <Tooltip content={tooltip}>
      <Button size="icon" variant="ghost" {...props}>
        {children}
      </Button>
    </Tooltip>
  );
}

function sampleCanvasColor(canvas: HTMLCanvasElement, point: Point): RgbColor | undefined {
  if (canvas.width === 0 || canvas.height === 0) return undefined;
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y)));
  const pixel = canvas
    .getContext('2d', { willReadFrequently: true })
    ?.getImageData(x, y, 1, 1).data;
  return pixel ? { r: pixel[0], g: pixel[1], b: pixel[2] } : undefined;
}

function drawLine(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  headSize: number,
): void {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.lineTo(
    end.x - headSize * Math.cos(angle - Math.PI / 6),
    end.y - headSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headSize * Math.cos(angle + Math.PI / 6),
    end.y - headSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function renderAction(
  ctx: CanvasRenderingContext2D,
  action: AnnotationAction,
  scale: number,
): void {
  ctx.save();
  if (action.type !== 'mosaic') {
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineWidth =
      action.type === 'text' ? Math.max(2, 3 * scale) : Math.max(1, action.strokeWidth * scale);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (action.type === 'rectangle') {
    ctx.strokeRect(
      action.start.x,
      action.start.y,
      action.end.x - action.start.x,
      action.end.y - action.start.y,
    );
  } else if (action.type === 'ellipse') {
    const centerX = (action.start.x + action.end.x) / 2;
    const centerY = (action.start.y + action.end.y) / 2;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      Math.abs(action.end.x - action.start.x) / 2,
      Math.abs(action.end.y - action.start.y) / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (action.type === 'arrow') {
    drawArrow(ctx, action.start, action.end, Math.max(12, 16 * scale));
  } else if (action.type === 'pen') {
    drawLine(ctx, action.points);
  } else if (action.type === 'mosaic') {
    const blockSize = Math.max(6, Math.round(action.mosaicSize * scale));
    const source = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const block of getMosaicBlocks(
      action.points,
      { width: ctx.canvas.width, height: ctx.canvas.height },
      blockSize,
    )) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let samples = 0;
      for (let y = block.y; y < block.y + block.size; y += 2) {
        for (let x = block.x; x < block.x + block.size; x += 2) {
          const offset = (y * source.width + x) * 4;
          red += source.data[offset];
          green += source.data[offset + 1];
          blue += source.data[offset + 2];
          alpha += source.data[offset + 3];
          samples += 1;
        }
      }
      ctx.fillStyle = `rgba(${Math.round(red / samples)}, ${Math.round(green / samples)}, ${Math.round(blue / samples)}, ${alpha / samples / 255})`;
      ctx.fillRect(block.x, block.y, block.size, block.size);
    }
  } else if (action.type === 'text') {
    ctx.font = `${getTextFontSize(scale, action.fontScale)}px "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(action.text, action.at.x, action.at.y);
  }
  ctx.restore();
}

type ScreenshotEditorProps = {
  visible?: boolean;
  onCanvasReady?: () => void;
};

export function ScreenshotEditor({ visible = true, onCanvasReady }: ScreenshotEditorProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | undefined>(undefined);
  const revealedRef = useRef(false);
  const canvasReadyRef = useRef(false);
  const startRef = useRef<Point | undefined>(undefined);
  const selectionMoveRef = useRef<
    | {
        handle: SelectionHandle;
        pointerStart: Point;
        selection: Rectangle;
        latest: Rectangle;
      }
    | undefined
  >(undefined);
  const textDragRef = useRef<
    | {
        index: number;
        pointerStart: Point;
        originalAt: Point;
        size: { width: number; height: number };
      }
    | undefined
  >(undefined);
  const historyRef = useRef<AnnotationAction[]>([]);
  const [plan, setPlan] = useState<ScreenshotEditPlan>();
  const [selectionPreview, setSelectionPreview] = useState<Rectangle>();
  const [selectionMoving, setSelectionMoving] = useState(false);
  const [tool, setTool] = useState<EditorTool>('move');
  const [color, setColor] = useState<AnnotationColor>('#2563eb');
  const [strokeWidth, setStrokeWidth] = useState<AnnotationStrokeWidth>(4);
  const [mosaicSize, setMosaicSize] = useState<AnnotationMosaicSize>(16);
  const [textScale, setTextScale] = useState<AnnotationTextScale>(1);
  const [stylePopoverTool, setStylePopoverTool] = useState<AnnotationTool>();
  const [history, setHistory] = useState<AnnotationAction[]>([]);
  const [draft, setDraft] = useState<AnnotationAction>();
  const [textInput, setTextInput] = useState<{ pixel: Point; local: Point; value: string }>();
  const [textHovering, setTextHovering] = useState(false);
  const [movingText, setMovingText] = useState(false);
  const [selectedTextIndex, setSelectedTextIndex] = useState(-1);
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [longScreenshotStarting, setLongScreenshotStarting] = useState(false);
  const [pickedColor, setPickedColor] = useState<{
    color: RgbColor;
    local: Point;
  }>();
  const pickedColorFormat = useShiftColorFormat();

  const redraw = useCallback(
    (actions = history, preview = draft) => {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      if (!canvas || !image || !plan) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const scale = canvas.width / plan.selection.width;
      for (const action of actions) renderAction(ctx, action, scale);
      if (preview) renderAction(ctx, preview, scale);
    },
    [draft, history, plan],
  );

  const applyEditPlan = useCallback(async (nextPlan: ScreenshotEditPlan) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('无法读取截图画面'));
      image.src = nextPlan.imageDataUrl;
    });
    imageRef.current = image;
    setPlan(nextPlan);
  }, []);

  useEffect(() => {
    void window.screenRecorder
      .getScreenshotEditPlan()
      .then(applyEditPlan)
      .catch((caught) => setError(caught instanceof Error ? caught.message : '截图任务已失效'));
  }, [applyEditPlan]);

  useEffect(() => {
    if (!plan || !canvasRef.current || !imageRef.current) return;
    canvasRef.current.width = plan.pixelSize.width;
    canvasRef.current.height = plan.pixelSize.height;
    redraw();
    if (!canvasReadyRef.current) {
      canvasReadyRef.current = true;
      onCanvasReady?.();
    }
  }, [plan, redraw, onCanvasReady]);

  useEffect(() => {
    if (visible && plan && !revealedRef.current) {
      revealedRef.current = true;
      void window.screenRecorder.revealScreenshotEditor(plan.operationId).catch((caught) => {
        setError(caught instanceof Error ? caught.message : '无法显示截图结果');
      });
    }
  }, [plan, visible]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    if (textInput) textInputRef.current?.focus();
  }, [textInput]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && plan) {
        void window.screenRecorder.cancelScreenshotEdit(plan.operationId);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const next = undoAnnotation(historyRef.current);
        historyRef.current = next;
        setHistory(next);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [plan]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
      y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
    };
  };

  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const measureTextAnnotation = (action: Extract<AnnotationAction, { type: 'text' }>) => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) return { width: 0, height: 0 };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: 0, height: 0 };
    const fontSize = getTextFontSize(canvas.width / plan.selection.width, action.fontScale);
    ctx.font = `${fontSize}px "Segoe UI", sans-serif`;
    return { width: ctx.measureText(action.text).width, height: fontSize };
  };

  const beginSelectionAdjustment = (
    event: React.PointerEvent<HTMLElement>,
    handle: SelectionHandle,
  ) => {
    if (!plan || working || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectionMoveRef.current = {
      handle,
      pointerStart: { x: event.clientX, y: event.clientY },
      selection: plan.selection,
      latest: plan.selection,
    };
    setSelectionPreview(plan.selection);
    setSelectionMoving(true);
    setSelectedTextIndex(-1);
  };

  const updateSelectionAdjustment = (event: React.PointerEvent<HTMLElement>): boolean => {
    const selectionMove = selectionMoveRef.current;
    if (!selectionMove) return false;
    const next = adjustSelection(
      selectionMove.selection,
      selectionMove.handle,
      { x: event.clientX, y: event.clientY },
      { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
      selectionMove.pointerStart,
    );
    selectionMove.latest = next;
    setSelectionPreview(next);
    return true;
  };

  const finishSelectionAdjustment = async (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const selectionMove = selectionMoveRef.current;
    if (!selectionMove || !plan) return;
    selectionMoveRef.current = undefined;
    setWorking(true);
    try {
      const nextPlan = await window.screenRecorder.updateScreenshotSelection(
        plan.operationId,
        selectionMove.latest,
      );
      await applyEditPlan(nextPlan);
      setSelectionPreview(undefined);
      setError(undefined);
    } catch (caught) {
      setSelectionPreview(undefined);
      setError(caught instanceof Error ? caught.message : '无法调整截图选区');
    } finally {
      setSelectionMoving(false);
      setWorking(false);
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const point = pointFromEvent(event);
    setStylePopoverTool(undefined);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'move' && plan) {
      beginSelectionAdjustment(event, 'move');
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'eyedropper') {
      const sampled = sampleCanvasColor(event.currentTarget, point);
      if (sampled) {
        setPickedColor({ color: sampled, local: localPoint(event) });
        void window.screenRecorder.copyColor(
          formatPickedColor(sampled, colorFormatForShift(event.shiftKey)),
        );
      }
      return;
    }
    if (tool === 'text') {
      const textIndex = findTextAnnotationAt(historyRef.current, point, measureTextAnnotation);
      const action = historyRef.current[textIndex];
      if (action?.type === 'text') {
        textDragRef.current = {
          index: textIndex,
          pointerStart: point,
          originalAt: action.at,
          size: measureTextAnnotation(action),
        };
        setSelectedTextIndex(textIndex);
        setTextScale(action.fontScale);
        setStylePopoverTool('text');
        setTextHovering(true);
        setMovingText(true);
        setTextInput(undefined);
        return;
      }
      setSelectedTextIndex(-1);
      startRef.current = point;
      return;
    }
    if (tool === 'move') return;
    startRef.current = point;
    setSelectedTextIndex(-1);
    setDraft(
      tool === 'mosaic'
        ? createMosaicAnnotation([point], mosaicSize)
        : tool === 'pen'
          ? { type: tool, points: [point], color, strokeWidth }
          : { type: tool, start: point, end: point, color, strokeWidth },
    );
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (updateSelectionAdjustment(event)) return;
    const point = pointFromEvent(event);
    if (tool === 'eyedropper') {
      const sampled = sampleCanvasColor(event.currentTarget, point);
      if (sampled) {
        setPickedColor({
          color: sampled,
          local: localPoint(event),
        });
      }
      return;
    }
    const textDrag = textDragRef.current;
    if (textDrag) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const at = clampTextAnnotationPosition(
        {
          x: textDrag.originalAt.x + point.x - textDrag.pointerStart.x,
          y: textDrag.originalAt.y + point.y - textDrag.pointerStart.y,
        },
        textDrag.size,
        { width: canvas.width, height: canvas.height },
      );
      const next = moveTextAnnotation(historyRef.current, textDrag.index, at);
      historyRef.current = next;
      setHistory(next);
      return;
    }
    if (tool === 'text' && !startRef.current) {
      setTextHovering(findTextAnnotationAt(historyRef.current, point, measureTextAnnotation) >= 0);
    }
    if (!startRef.current || !draft) return;
    if (draft.type === 'pen' || draft.type === 'mosaic') {
      setDraft({ ...draft, points: [...draft.points, point] });
    } else if (draft.type === 'rectangle' || draft.type === 'ellipse' || draft.type === 'arrow') {
      setDraft({ ...draft, end: point });
    }
  };

  const onPointerUp = async (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (selectionMoveRef.current) {
      await finishSelectionAdjustment(event);
      return;
    }
    if (textDragRef.current) {
      textDragRef.current = undefined;
      setMovingText(false);
      return;
    }
    if (tool === 'text' && startRef.current) {
      const pixel = startRef.current;
      startRef.current = undefined;
      setTextInput({ pixel, local: localPoint(event), value: '' });
      return;
    }
    startRef.current = undefined;
    selectionMoveRef.current = undefined;
    if (!draft) return;
    const next = addAnnotation(historyRef.current, draft);
    historyRef.current = next;
    setHistory(next);
    setDraft(undefined);
  };

  const cancelPointerGesture = () => {
    startRef.current = undefined;
    selectionMoveRef.current = undefined;
    setSelectionPreview(undefined);
    setSelectionMoving(false);
    textDragRef.current = undefined;
    setDraft(undefined);
    setMovingText(false);
    setTextHovering(false);
  };

  const commitText = () => {
    const action = textInput
      ? createTextAnnotation(textInput.value, textInput.pixel, color, textScale)
      : undefined;
    if (action) {
      const next = addAnnotation(historyRef.current, action);
      historyRef.current = next;
      setHistory(next);
    }
    setTextInput(undefined);
  };

  const undo = () => {
    const next = undoAnnotation(historyRef.current);
    historyRef.current = next;
    setHistory(next);
  };

  const prepareAnnotationsForExport = async () => {
    let actions = historyRef.current;
    const textAction = textInput
      ? createTextAnnotation(textInput.value, textInput.pixel, color, textScale)
      : undefined;
    if (textAction) {
      actions = addAnnotation(actions, textAction);
      historyRef.current = actions;
      setHistory(actions);
    }
    if (textInput) setTextInput(undefined);
    redraw(actions, undefined);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  };

  const createPng = async (): Promise<ArrayBuffer> => {
    const canvas = canvasRef.current;
    if (!canvas || !plan) throw new Error('截图画布尚未就绪');
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('无法生成截图文件');
    return blob.arrayBuffer();
  };

  const save = async (choosePath = false) => {
    if (!plan) return;
    setWorking(true);
    setError(undefined);
    try {
      await prepareAnnotationsForExport();
      const png = await createPng();
      if (choosePath) {
        const result = await window.screenRecorder.saveScreenshotAs(plan.operationId, png);
        if (!result.saved) setWorking(false);
      } else {
        await window.screenRecorder.saveScreenshot(plan.operationId, png);
      }
    } catch (caught) {
      setWorking(false);
      setError(caught instanceof Error ? caught.message : '无法保存截图');
    }
  };

  const startLongScreenshot = async () => {
    if (!plan) return;
    setWorking(true);
    setLongScreenshotStarting(true);
    setError(undefined);
    try {
      await prepareAnnotationsForExport();
      await window.screenRecorder.startLongScreenshot(plan.operationId, await createPng());
    } catch (caught) {
      setWorking(false);
      setLongScreenshotStarting(false);
      setError(caught instanceof Error ? caught.message : '无法开始长截图');
    }
  };

  const pinScreenshot = async () => {
    if (!plan) return;
    setWorking(true);
    setError(undefined);
    try {
      await prepareAnnotationsForExport();
      await window.screenRecorder.pinScreenshot(plan.operationId, await createPng());
    } catch (caught) {
      setWorking(false);
      setError(caught instanceof Error ? caught.message : '无法固定截图');
    }
  };

  if (!plan) {
    return visible ? (
      <div className="screenshot-editor-loading">{error || '正在准备截图…'}</div>
    ) : null;
  }

  const visibleSelection = selectionPreview ?? plan.selection;
  const toolbarPosition = getScreenshotToolbarPosition(visibleSelection, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const selectionMaskRects = createSelectionMaskRects(
    { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
    visibleSelection,
  );
  const selectedText = history[selectedTextIndex];
  const selectedTextSize =
    selectedText?.type === 'text' ? measureTextAnnotation(selectedText) : undefined;
  const preserveFrozenSelection = tool === 'move' && history.length === 0;

  return (
    <div
      className={`screenshot-editor-overlay${visible ? '' : ' screenshot-editor-pending'}${longScreenshotStarting ? ' screenshot-editor-long-starting' : ''}`}
      onContextMenu={(event) => {
        event.preventDefault();
        void window.screenRecorder.cancelScreenshotEdit(plan.operationId);
      }}
    >
      <img
        className="screenshot-frozen-frame"
        src={plan.displayImageDataUrl}
        alt=""
        draggable={false}
      />
      {selectionMaskRects.map((rect, index) => (
        <div
          className="screenshot-editor-mask"
          key={index}
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        />
      ))}
      <div
        className={`screenshot-canvas-wrap screenshot-canvas-tool-${tool}${preserveFrozenSelection ? ' screenshot-canvas-frozen' : ''}${selectionMoving ? ' screenshot-selection-moving' : ''}${textHovering ? ' screenshot-canvas-text-movable' : ''}${movingText ? ' screenshot-canvas-text-moving' : ''}`}
        style={{
          left: visibleSelection.x,
          top: visibleSelection.y,
          width: visibleSelection.width,
          height: visibleSelection.height,
        }}
      >
        <span className="screenshot-size-label">
          {Math.round(visibleSelection.width)} × {Math.round(visibleSelection.height)}
        </span>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => void onPointerUp(event)}
          onPointerCancel={cancelPointerGesture}
          onPointerLeave={() => {
            if (!movingText) setTextHovering(false);
          }}
        />
        {tool === 'move' &&
          SCREENSHOT_SELECTION_HANDLES.map((handle) => (
            <i
              key={handle}
              className={`selection-handle selection-handle-${handle} screenshot-selection-handle`}
              data-screenshot-selection-handle={handle}
              aria-hidden="true"
              onPointerDown={(event) => beginSelectionAdjustment(event, handle)}
              onPointerMove={updateSelectionAdjustment}
              onPointerUp={(event) => void finishSelectionAdjustment(event)}
              onPointerCancel={cancelPointerGesture}
            />
          ))}
        {selectedText?.type === 'text' && selectedTextSize && (
          <i
            className="screenshot-text-selection"
            style={{
              left: (selectedText.at.x / plan.pixelSize.width) * visibleSelection.width,
              top: (selectedText.at.y / plan.pixelSize.height) * visibleSelection.height,
              width: (selectedTextSize.width / plan.pixelSize.width) * visibleSelection.width,
              height: (selectedTextSize.height / plan.pixelSize.height) * visibleSelection.height,
            }}
          />
        )}
        {textInput && (
          <input
            ref={textInputRef}
            className="screenshot-text-input"
            style={{ left: textInput.local.x, top: textInput.local.y, color }}
            placeholder="输入文字"
            value={textInput.value}
            onChange={(event) => setTextInput({ ...textInput, value: event.target.value })}
            onBlur={commitText}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setTextInput(undefined);
            }}
          />
        )}
        {tool === 'eyedropper' && pickedColor && (
          <div
            className="screenshot-color-picker-card"
            style={{
              left: Math.max(0, Math.min(visibleSelection.width - 196, pickedColor.local.x + 14)),
              top: Math.max(0, Math.min(visibleSelection.height - 92, pickedColor.local.y + 14)),
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span style={{ backgroundColor: rgbToHex(pickedColor.color) }} />
            <div>
              <strong>{formatPickedColor(pickedColor.color, pickedColorFormat)}</strong>
              <small>
                {pickedColorFormat === 'hex'
                  ? formatPickedColor(pickedColor.color, 'rgb')
                  : rgbToHex(pickedColor.color)}
              </small>
            </div>
            <kbd className="color-picker-shortcut">
              {pickedColorFormat === 'hex' ? 'Shift · RGB' : '松开 · HEX'}
            </kbd>
          </div>
        )}
      </div>

      <div
        className="screenshot-toolbar"
        style={toolbarPosition}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ToolbarButton
          tooltip="移动选区"
          aria-label="移动选区"
          className={tool === 'move' ? 'screenshot-tool-active' : undefined}
          onClick={() => {
            setTool('move');
            setStylePopoverTool(undefined);
            setSelectedTextIndex(-1);
          }}
        >
          <Move aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        {(
          [
            ['rectangle', '方框', Square],
            ['ellipse', '圆框', Circle],
            ['arrow', '箭头', ArrowUpRight],
            ['pen', '画笔', PenLine],
            ['mosaic', '马赛克', Grid3X3],
            ['text', '文字', Type],
          ] as const
        ).map(([value, label, Icon]) => (
          <ToolbarButton
            key={value}
            tooltip={label}
            aria-label={label}
            className={tool === value ? 'screenshot-tool-active' : undefined}
            onClick={() => {
              setTool(value);
              setStylePopoverTool((current) =>
                STYLE_TOOLS.includes(value) && current !== value ? value : undefined,
              );
              if (value !== 'text') setSelectedTextIndex(-1);
            }}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
          </ToolbarButton>
        ))}
        <ToolbarButton
          tooltip="吸色"
          aria-label="吸色"
          className={tool === 'eyedropper' ? 'screenshot-tool-active' : undefined}
          onClick={() => {
            setTool('eyedropper');
            setStylePopoverTool(undefined);
            setSelectedTextIndex(-1);
          }}
        >
          <Pipette aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        {stylePopoverTool && (
          <AnnotationStylePopover
            toolLabel={
              stylePopoverTool === 'rectangle'
                ? '方框'
                : stylePopoverTool === 'ellipse'
                  ? '圆框'
                  : stylePopoverTool === 'arrow'
                    ? '箭头'
                    : stylePopoverTool === 'pen'
                      ? '画笔'
                      : stylePopoverTool === 'mosaic'
                        ? '马赛克'
                        : '文字'
            }
            color={stylePopoverTool === 'mosaic' ? undefined : color}
            strokeWidth={
              ['rectangle', 'ellipse', 'arrow', 'pen'].includes(stylePopoverTool)
                ? strokeWidth
                : undefined
            }
            sizeValue={
              stylePopoverTool === 'mosaic'
                ? mosaicSize
                : stylePopoverTool === 'text'
                  ? textScale
                  : undefined
            }
            sizeLabel={
              stylePopoverTool === 'mosaic' ? '大小' : stylePopoverTool === 'text' ? '字号' : '粗细'
            }
            sizeOptions={
              stylePopoverTool === 'mosaic'
                ? MOSAIC_SIZE_OPTIONS
                : stylePopoverTool === 'text'
                  ? TEXT_SIZE_OPTIONS
                  : undefined
            }
            anchorOffset={
              (Math.max(
                0,
                ['rectangle', 'ellipse', 'arrow', 'pen', 'mosaic', 'text'].indexOf(
                  stylePopoverTool,
                ),
              ) +
                1) *
              42
            }
            onColorChange={setColor}
            onStrokeWidthChange={setStrokeWidth}
            onSizeChange={(value) => {
              if (stylePopoverTool === 'mosaic') {
                setMosaicSize(value as AnnotationMosaicSize);
                return;
              }
              if (stylePopoverTool === 'text') {
                const nextScale = value as AnnotationTextScale;
                setTextScale(nextScale);
                if (selectedTextIndex >= 0) {
                  const next = resizeTextAnnotation(
                    historyRef.current,
                    selectedTextIndex,
                    nextScale,
                  );
                  historyRef.current = next;
                  setHistory(next);
                }
              }
            }}
          />
        )}
        <span className="screenshot-toolbar-divider" />
        <ToolbarButton
          tooltip="固定在桌面最前方"
          aria-label="固定截图"
          disabled={working}
          onClick={() => void pinScreenshot()}
        >
          <Pin aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          tooltip="撤销"
          aria-label="撤销"
          disabled={history.length === 0}
          onClick={undo}
        >
          <Undo2 aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          tooltip="长截图"
          aria-label="长截图"
          disabled={working}
          onClick={() => void startLongScreenshot()}
        >
          <ScanLine aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          tooltip="另存为 PNG"
          aria-label="保存截图文件"
          disabled={working}
          onClick={() => void save(true)}
        >
          <Download aria-hidden="true" size={19} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          tooltip="取消"
          aria-label="取消截图"
          onClick={() => void window.screenRecorder.cancelScreenshotEdit(plan.operationId)}
        >
          <X aria-hidden="true" size={20} strokeWidth={1.8} />
        </ToolbarButton>
        <ToolbarButton
          tooltip="完成并复制"
          aria-label="保存并复制截图"
          disabled={working}
          onClick={() => void save()}
        >
          <Check aria-hidden="true" size={20} strokeWidth={2} />
        </ToolbarButton>
      </div>
      {error && <div className="screenshot-editor-error">{error}</div>}
    </div>
  );
}
