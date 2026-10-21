import { type AnnotationAction, getMosaicBlocks, getTextFontSize } from '../core/annotation';
import type { Point, Rectangle } from '../core/geometry';

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
    const blocks = getMosaicBlocks(
      action.points,
      { width: ctx.canvas.width, height: ctx.canvas.height },
      blockSize,
      action.gridOffset,
    );
    if (blocks.length === 0) {
      ctx.restore();
      return;
    }
    let left = ctx.canvas.width;
    let top = ctx.canvas.height;
    let right = 0;
    let bottom = 0;
    for (const block of blocks) {
      left = Math.min(left, block.x);
      top = Math.min(top, block.y);
      right = Math.max(right, block.x + block.size);
      bottom = Math.max(bottom, block.y + block.size);
    }
    const source = ctx.getImageData(left, top, right - left, bottom - top);
    for (const block of blocks) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let samples = 0;
      for (let y = block.y; y < block.y + block.size; y += 2) {
        for (let x = block.x; x < block.x + block.size; x += 2) {
          const offset = ((y - top) * source.width + x - left) * 4;
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

export class ScreenshotCanvasRenderer {
  private cache:
    | {
        image: HTMLImageElement;
        source: Rectangle;
        actions: readonly AnnotationAction[];
        scale: number;
        canvas: HTMLCanvasElement;
      }
    | undefined;

  render(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    source: Rectangle,
    actions: readonly AnnotationAction[],
    preview: AnnotationAction | undefined,
    scale: number,
  ): void {
    const { width, height } = context.canvas;
    const cached = this.cache;
    if (
      !cached ||
      cached.image !== image ||
      cached.source !== source ||
      cached.actions !== actions ||
      cached.scale !== scale ||
      cached.canvas.width !== width ||
      cached.canvas.height !== height
    ) {
      const canvas = cached?.canvas ?? document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const base = canvas.getContext('2d', { willReadFrequently: true });
      if (!base) throw new Error('无法创建标注画布');
      base.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, width, height);
      for (const action of actions) renderAction(base, action, scale);
      this.cache = { image, source, actions, scale, canvas };
    }
    context.clearRect(0, 0, width, height);
    if (this.cache) context.drawImage(this.cache.canvas, 0, 0);
    if (preview) renderAction(context, preview, scale);
  }
}
