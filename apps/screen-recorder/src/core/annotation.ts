import type { Point } from './geometry';

export type AnnotationColor = '#2563eb' | '#ef4444' | '#111827' | '#ffffff';
export type AnnotationStrokeWidth = 2 | 4 | 8;
export type AnnotationTextScale = 1 | 1.5 | 2;
export type AnnotationMosaicSize = 8 | 16 | 24;

export type AnnotationAction =
  | {
      type: 'rectangle' | 'ellipse' | 'arrow';
      start: Point;
      end: Point;
      color: AnnotationColor;
      strokeWidth: AnnotationStrokeWidth;
    }
  | {
      type: 'pen';
      points: Point[];
      color: AnnotationColor;
      strokeWidth: AnnotationStrokeWidth;
    }
  | {
      type: 'mosaic';
      points: Point[];
      mosaicSize: AnnotationMosaicSize;
    }
  | {
      type: 'text';
      at: Point;
      text: string;
      color: AnnotationColor;
      fontScale: AnnotationTextScale;
    };

export type AnnotationTool = AnnotationAction['type'];

export type MosaicBlock = { x: number; y: number; size: number };
export type AnnotationSize = { width: number; height: number };

export function findTextAnnotationAt(
  history: readonly AnnotationAction[],
  point: Point,
  measure: (action: Extract<AnnotationAction, { type: 'text' }>) => AnnotationSize,
  padding = 6,
): number {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const action = history[index];
    if (action.type !== 'text') continue;
    const size = measure(action);
    if (
      point.x >= action.at.x - padding &&
      point.x <= action.at.x + size.width + padding &&
      point.y >= action.at.y - padding &&
      point.y <= action.at.y + size.height + padding
    ) {
      return index;
    }
  }
  return -1;
}

export function moveTextAnnotation(
  history: readonly AnnotationAction[],
  index: number,
  at: Point,
): AnnotationAction[] {
  const action = history[index];
  if (!action || action.type !== 'text') return [...history];
  return history.map((item, itemIndex) => (itemIndex === index ? { ...action, at } : item));
}

export function resizeTextAnnotation(
  history: readonly AnnotationAction[],
  index: number,
  fontScale: AnnotationTextScale,
): AnnotationAction[] {
  const action = history[index];
  if (!action || action.type !== 'text') return [...history];
  return history.map((item, itemIndex) => (itemIndex === index ? { ...action, fontScale } : item));
}

export function clampTextAnnotationPosition(
  at: Point,
  text: AnnotationSize,
  canvas: AnnotationSize,
): Point {
  return {
    x: Math.max(0, Math.min(at.x, Math.max(0, canvas.width - text.width))),
    y: Math.max(0, Math.min(at.y, Math.max(0, canvas.height - text.height))),
  };
}

export function createTextAnnotation(
  value: string,
  at: Point,
  color: AnnotationColor,
  fontScale: AnnotationTextScale = 1,
): AnnotationAction | undefined {
  const text = value.trim();
  return text ? { type: 'text', at, text, color, fontScale } : undefined;
}

export function getTextFontSize(canvasScale: number, fontScale: AnnotationTextScale): number {
  return Math.max(18, Math.round(20 * canvasScale * fontScale));
}

export function createMosaicAnnotation(
  points: Point[],
  mosaicSize: AnnotationMosaicSize,
): AnnotationAction {
  return { type: 'mosaic', points, mosaicSize };
}

export function getMosaicBlocks(
  points: readonly Point[],
  bounds: { width: number; height: number },
  blockSize: number,
): MosaicBlock[] {
  const size = Math.max(1, Math.min(Math.floor(blockSize), bounds.width, bounds.height));
  if (points.length === 0 || bounds.width < 1 || bounds.height < 1) return [];

  const samples: Point[] = [points[0]];
  const step = Math.max(1, size / 2);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const segments = Math.max(1, Math.ceil(distance / step));
    for (let segment = 1; segment <= segments; segment += 1) {
      const progress = segment / segments;
      samples.push({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      });
    }
  }

  const blocks = new Map<string, MosaicBlock>();
  const radius = size * 1.5;
  for (const point of samples) {
    for (let y = point.y - radius; y <= point.y + radius; y += size) {
      for (let x = point.x - radius; x <= point.x + radius; x += size) {
        const left = Math.max(0, Math.min(bounds.width - size, Math.floor(x / size) * size));
        const top = Math.max(0, Math.min(bounds.height - size, Math.floor(y / size) * size));
        blocks.set(`${left}:${top}`, { x: left, y: top, size });
      }
    }
  }
  return [...blocks.values()];
}

export function addAnnotation(
  history: readonly AnnotationAction[],
  action: AnnotationAction,
): AnnotationAction[] {
  return [...history, action];
}

export function undoAnnotation(history: readonly AnnotationAction[]): AnnotationAction[] {
  return history.slice(0, -1);
}
