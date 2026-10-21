import { describe, expect, it } from 'vitest';
import {
  type AnnotationAction,
  addAnnotation,
  clampTextAnnotationPosition,
  createMosaicAnnotation,
  createTextAnnotation,
  findTextAnnotationAt,
  getMosaicBlocks,
  getTextFontSize,
  moveTextAnnotation,
  rebaseAnnotations,
  resizeTextAnnotation,
  undoAnnotation,
} from './annotation';

describe('screenshot annotation history', () => {
  const rectangle: AnnotationAction = {
    type: 'rectangle',
    start: { x: 10, y: 20 },
    end: { x: 100, y: 80 },
    color: '#2563eb',
    strokeWidth: 4,
  };

  it('keeps every annotation attached to desktop pixels when the crop origin changes', () => {
    const actions: AnnotationAction[] = [
      rectangle,
      { type: 'mosaic', points: [{ x: 180, y: 180 }], mosaicSize: 16 },
      { type: 'pen', points: [{ x: 30, y: 40 }], color: '#2563eb', strokeWidth: 4 },
      { type: 'text', at: { x: 90, y: 60 }, text: 'private', color: '#2563eb', fontScale: 1 },
    ];
    const next = rebaseAnnotations(actions, { x: 100, y: 100 }, { x: 164, y: 80 });
    expect(next[0]).toEqual({ ...rectangle, start: { x: -54, y: 40 }, end: { x: 36, y: 100 } });
    expect(next[1]).toEqual({
      ...actions[1],
      points: [{ x: 116, y: 200 }],
      gridOffset: { x: -64, y: 20 },
    });
    expect(next[2]).toEqual({ ...actions[2], points: [{ x: -34, y: 60 }] });
    expect(next[3]).toEqual({ ...actions[3], at: { x: 26, y: 80 } });
    expect(actions[0]).toEqual(rectangle);
    expect(rebaseAnnotations(next, { x: 164, y: 80 }, { x: 100, y: 100 })).toEqual(actions);
  });

  it('keeps the whole mosaic footprint anchored during moves that are not multiples of its block size', () => {
    const action: AnnotationAction = {
      type: 'mosaic',
      points: [{ x: 180, y: 180 }],
      mosaicSize: 16,
    };
    const [moved] = rebaseAnnotations([action], { x: 100, y: 100 }, { x: 157, y: 80 });
    if (moved.type !== 'mosaic') throw new Error('Expected mosaic');
    const originalBlocks = getMosaicBlocks(action.points, { width: 500, height: 320 }, 16);
    const movedBlocks = getMosaicBlocks(
      moved.points,
      { width: 500, height: 320 },
      16,
      moved.gridOffset,
    );
    expect(movedBlocks.map((block) => ({ ...block, x: block.x + 57, y: block.y - 20 }))).toEqual(
      originalBlocks,
    );
  });

  it('adds immutable annotation actions', () => {
    const history: AnnotationAction[] = [];
    const next = addAnnotation(history, rectangle);
    expect(history).toEqual([]);
    expect(next).toEqual([rectangle]);
  });

  it('undoes only the most recent annotation', () => {
    const arrow: AnnotationAction = {
      type: 'arrow',
      start: { x: 30, y: 40 },
      end: { x: 90, y: 120 },
      color: '#2563eb',
      strokeWidth: 4,
    };
    expect(undoAnnotation([rectangle, arrow])).toEqual([rectangle]);
    expect(undoAnnotation([])).toEqual([]);
  });

  it('creates visible text actions only for non-empty input', () => {
    expect(createTextAnnotation('  Valley  ', { x: 12, y: 24 }, '#ef4444', 1.5)).toEqual({
      type: 'text',
      at: { x: 12, y: 24 },
      text: 'Valley',
      color: '#ef4444',
      fontScale: 1.5,
    });
    expect(createTextAnnotation('   ', { x: 12, y: 24 }, '#ef4444')).toBeUndefined();
  });

  it('resizes text immutably and derives the rendered font size from its scale', () => {
    const text = createTextAnnotation('Valley', { x: 20, y: 30 }, '#2563eb');
    if (!text) throw new Error('测试文字标注创建失败');
    const history: AnnotationAction[] = [rectangle, text];
    const next = resizeTextAnnotation(history, 1, 2);
    expect(history[1]).toEqual(text);
    expect(next[1]).toEqual({ ...text, fontScale: 2 });
    expect(getTextFontSize(1.25, 2)).toBe(50);
  });

  it('finds the topmost text, moves it immutably, and keeps it inside the canvas', () => {
    const first = createTextAnnotation('First', { x: 10, y: 20 }, '#2563eb');
    const topmost = createTextAnnotation('Top', { x: 12, y: 22 }, '#ef4444');
    if (!first || !topmost) throw new Error('测试文字标注创建失败');
    const actions: AnnotationAction[] = [rectangle, first, topmost];
    const index = findTextAnnotationAt(actions, { x: 20, y: 28 }, () => ({
      width: 50,
      height: 20,
    }));
    expect(index).toBe(2);

    const next = moveTextAnnotation(actions, index, { x: 80, y: 60 });
    expect(actions[2]).toEqual(topmost);
    expect(next[2]).toEqual({ ...topmost, at: { x: 80, y: 60 } });
    expect(
      clampTextAnnotationPosition(
        { x: 95, y: -10 },
        { width: 30, height: 20 },
        { width: 100, height: 80 },
      ),
    ).toEqual({ x: 70, y: 0 });
  });

  it('creates continuous, clipped mosaic blocks across sparse pointer samples', () => {
    const blocks = getMosaicBlocks(
      [
        { x: -10, y: 10 },
        { x: 58, y: 10 },
      ],
      { width: 48, height: 32 },
      8,
    );
    expect(blocks.length).toBeGreaterThan(4);
    expect(blocks.every((block) => block.x >= 0 && block.y >= 0)).toBe(true);
    expect(blocks.every((block) => block.x + block.size <= 48)).toBe(true);
    expect(blocks.every((block) => block.y + block.size <= 32)).toBe(true);
    expect(createMosaicAnnotation([{ x: 24, y: 16 }], 24)).toEqual({
      type: 'mosaic',
      points: [{ x: 24, y: 16 }],
      mosaicSize: 24,
    });
    expect(
      getMosaicBlocks([{ x: 24, y: 16 }], { width: 48, height: 32 }, 24).every(
        (block) => block.size === 24,
      ),
    ).toBe(true);
  });
});
