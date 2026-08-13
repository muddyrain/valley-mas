import { describe, expect, it } from 'vitest';
import {
  appendLongScreenshotMatchHistory,
  type BitmapFrame,
  composeLongScreenshot,
  createLongScreenshotMatchHistory,
  detectLongScreenshotHistoryPosition,
  detectVerticalShift,
  extractAppendedFrame,
  extractLongScreenshotAppendedFrame,
  extractLongScreenshotPrependedFrame,
  getLongScreenshotFrameUpdate,
  getLongScreenshotNoticeState,
  getVerticalShiftSearchStep,
  type LongScreenshotSlice,
  prependLongScreenshotMatchHistory,
} from './long-screenshot';

function frame(rows: number[]): BitmapFrame {
  const data = new Uint8Array(rows.length * 2 * 4);
  rows.forEach((value, y) => {
    for (let x = 0; x < 2; x += 1) {
      const offset = (y * 2 + x) * 4;
      data.set([value, value, value, 255], offset);
    }
  });
  return { width: 2, height: rows.length, data };
}

function pixelHash(sourceY: number, x: number): number {
  let value = (Math.imul(sourceY + 1, 0x9e3779b1) ^ Math.imul(x + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function subtleFrame(offset: number): BitmapFrame {
  const width = 160;
  const height = 240;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y + offset;
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const hash = pixelHash(sourceY, x);
      data.set(
        [100 + ((hash >>> 24) & 3), 100 + ((hash >>> 18) & 3), 100 + ((hash >>> 12) & 3), 255],
        pixel,
      );
    }
  }
  return { width, height, data };
}

function fixedChromeFrame(offset: number): BitmapFrame {
  const content = Array.from({ length: 12 }, (_, index) => 30 + index * 10 + offset * 10);
  return frame([5, 5, ...content, 245, 245]);
}

function repeatedCardsWithFixedSidebarFrame(offset: number): BitmapFrame {
  const width = 96;
  const height = 144;
  const sidebarWidth = 24;
  const cardPeriod = 48;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const sourceY = y + offset;
      const contentY = sourceY % cardPeriod;
      const cardIndex = Math.floor(sourceY / cardPeriod);
      const value =
        x < sidebarWidth
          ? 40 + Math.floor(y / 2)
          : contentY < 2
            ? 80
            : contentY < 10 && x % 13 < 8
              ? 150
              : contentY < 24 && x % 19 < 12
                ? 190
                : contentY < 30 && x % 11 < 7
                  ? 110 + cardIndex * 7
                  : 245;
      data.set([value, value, value, 255], pixel);
    }
  }
  return { width, height, data };
}

function finderStyleFrame(offset: number): BitmapFrame {
  const width = 6;
  const height = 12;
  const sidebarWidth = 2;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const value = x < sidebarWidth ? (y === 10 ? 20 : 230) : 20 + (y + offset) * 10;
      data.set([value, value, value, 255], pixel);
    }
  }
  return { width, height, data };
}

function periodicGridWithUniqueBottomLabelFrame(offset: number): BitmapFrame {
  const width = 96;
  const height = 144;
  const period = 48;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y + offset;
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const periodicY = sourceY % period;
      const value =
        sourceY >= 174 ? 30 + (x % 17) : periodicY < 12 ? 90 : periodicY < 28 ? 180 : 245;
      data.set([value, value, value, 255], pixel);
    }
  }
  return { width, height, data };
}

function finderGridFrame(offset: number): BitmapFrame {
  const width = 96;
  const height = 144;
  const sidebarWidth = 24;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = y + offset;
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * 4;
      const value =
        x < sidebarWidth
          ? 220 - (y % 16)
          : 30 + ((sourceY * 3 + Math.floor(x / 8) * 17 + Math.floor(sourceY / 24) * 11) % 210);
      data.set([value, value, value, 255], pixel);
    }
  }
  return { width, height, data };
}

describe('long screenshot stitching', () => {
  it('detects duplicates and downward scroll overlap', () => {
    const first = frame([10, 20, 30, 40, 50, 60]);
    expect(detectVerticalShift(first, first)).toEqual({ shift: 0, score: 0 });
    expect(detectVerticalShift(first, frame([30, 40, 50, 60, 70, 80]))?.shift).toBe(2);
  });

  it('detects a small low-contrast tail scroll instead of treating it as a duplicate', () => {
    expect(detectVerticalShift(subtleFrame(0), subtleFrame(1))?.shift).toBe(1);
  });

  it('reports upward scrolling without turning it into appended content', () => {
    const previous = frame([30, 40, 50, 60, 70, 80]);
    const current = frame([10, 20, 30, 40, 50, 60]);

    expect(detectVerticalShift(previous, current)?.shift).toBe(-2);
  });

  it('rejects repeated content when the scroll direction is ambiguous', () => {
    const previous = frame([10, 20, 30, 40, 10, 20]);
    const current = frame([30, 40, 10, 20, 30, 40]);

    expect(detectVerticalShift(previous, current)).toBeUndefined();
  });

  it('matches scrolling content when fixed header and footer rows stay in place', () => {
    expect(detectVerticalShift(fixedChromeFrame(0), fixedChromeFrame(3))?.shift).toBe(3);
  });

  it('keeps a locally animated stationary frame from becoming a false scroll', () => {
    const previous = subtleFrame(0);
    const current = { ...previous, data: previous.data.slice() };
    current.data.fill(180, 0, current.width * 12 * 4);

    expect(detectVerticalShift(previous, current)?.shift).toBe(0);
  });

  it('asks the user to return to the interruption point when overlap is lost', () => {
    const initial = { position: 0, capturedStartPosition: 0, capturedPosition: 0 };
    expect(getLongScreenshotFrameUpdate(initial, undefined)).toEqual({
      nextState: initial,
      updateReference: false,
      notice: '滚动过快，请回到截图中断位置后慢速滚动',
    });
  });

  it('tracks the scroll high-water mark without appending revisited content', () => {
    const first = getLongScreenshotFrameUpdate(
      { position: 0, capturedStartPosition: 0, capturedPosition: 0 },
      { shift: 100, score: 0 },
    );
    expect(first).toEqual({
      nextState: { position: 100, capturedStartPosition: 0, capturedPosition: 100 },
      updateReference: true,
      appendRows: 100,
    });

    const upward = getLongScreenshotFrameUpdate(first.nextState, { shift: -60, score: 0 });
    expect(upward).toEqual({
      nextState: { position: 40, capturedStartPosition: 0, capturedPosition: 100 },
      updateReference: true,
    });

    const revisited = getLongScreenshotFrameUpdate(upward.nextState, { shift: 40, score: 0 });
    expect(revisited).toEqual({
      nextState: { position: 80, capturedStartPosition: 0, capturedPosition: 100 },
      updateReference: true,
    });

    expect(getLongScreenshotFrameUpdate(revisited.nextState, { shift: 50, score: 0 })).toEqual({
      nextState: { position: 130, capturedStartPosition: 0, capturedPosition: 130 },
      updateReference: true,
      appendRows: 30,
    });
  });

  it('uses captured history to append only new rows across a down-up-down sequence', () => {
    const documentRows = Array.from({ length: 14 }, (_, index) => (index + 1) * 10);
    const offsets = [0, 2, 4, 2, 4, 6];
    const firstFrame = frame(documentRows.slice(offsets[0], offsets[0] + 6));
    let history = createLongScreenshotMatchHistory(firstFrame);
    let state = { position: 0, capturedStartPosition: 0, capturedPosition: 0 };
    const appendedRows: Array<number | undefined> = [];

    for (const offset of offsets.slice(1)) {
      const current = frame(documentRows.slice(offset, offset + 6));
      const historyPosition = detectLongScreenshotHistoryPosition(history, current);
      const update = getLongScreenshotFrameUpdate(
        state,
        historyPosition
          ? { shift: historyPosition.position - state.position, score: historyPosition.score }
          : undefined,
      );
      appendedRows.push(update.appendRows);
      if (update.appendRows) {
        history = appendLongScreenshotMatchHistory(history, current, update.appendRows);
      }
      state = update.nextState;
    }

    expect(appendedRows).toEqual([2, 2, undefined, undefined, 2]);
    expect(state).toEqual({ position: 6, capturedStartPosition: 0, capturedPosition: 6 });
  });

  it('does not append repeated cards after scrolling back above the captured position', () => {
    const offsets = [0, 20, 40, 4];
    const firstFrame = repeatedCardsWithFixedSidebarFrame(offsets[0]);
    let history = createLongScreenshotMatchHistory(firstFrame);
    let state = { position: 0, capturedStartPosition: 0, capturedPosition: 0 };
    const appendedRows: Array<number | undefined> = [];

    for (const offset of offsets.slice(1)) {
      const current = repeatedCardsWithFixedSidebarFrame(offset);
      const historyPosition = detectLongScreenshotHistoryPosition(history, current);
      const match = historyPosition
        ? { shift: historyPosition.position - state.position, score: historyPosition.score }
        : undefined;
      const update = getLongScreenshotFrameUpdate(state, match);
      appendedRows.push(update.appendRows);
      if (update.updateReference) {
        if (update.appendRows) {
          history = appendLongScreenshotMatchHistory(history, current, update.appendRows);
        }
      }
      state = update.nextState;
    }

    expect(appendedRows).toEqual([20, 20, undefined]);
    expect(state.capturedPosition).toBe(40);
  });

  it('does not repeat a fixed Finder-style sidebar inside appended rows', () => {
    const firstFrame = finderStyleFrame(0);
    const current = finderStyleFrame(2);
    const history = createLongScreenshotMatchHistory(firstFrame);
    const historyPosition = detectLongScreenshotHistoryPosition(history, current);
    expect(historyPosition?.position).toBe(2);

    const appended = extractLongScreenshotAppendedFrame(firstFrame, current, 2);
    const result = composeLongScreenshot([
      { frame: firstFrame, appendRows: firstFrame.height },
      { frame: appended, appendRows: appended.height },
    ]);
    const column = (x: number) =>
      Array.from({ length: result.height }, (_, y) => result.data[(y * result.width + x) * 4]);

    expect(column(0)).toEqual([
      230, 230, 230, 230, 230, 230, 230, 230, 230, 230, 20, 230, 230, 230,
    ]);
    expect(column(3)).toEqual([20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
  });

  it('locates content above the first frame when the user scrolls upward', () => {
    const firstFrame = finderGridFrame(40);
    const current = finderGridFrame(20);
    const history = createLongScreenshotMatchHistory(firstFrame);

    const historyPosition = detectLongScreenshotHistoryPosition(history, current);
    expect(historyPosition?.position).toBe(-20);
    expect(
      getLongScreenshotFrameUpdate(
        { position: 0, capturedStartPosition: 0, capturedPosition: 0 },
        historyPosition
          ? { shift: historyPosition.position, score: historyPosition.score }
          : undefined,
      ),
    ).toMatchObject({ prependRows: 20 });
  });

  it('captures a newly visible bottom label before finishing', () => {
    const firstFrame = periodicGridWithUniqueBottomLabelFrame(0);
    const finalFrame = periodicGridWithUniqueBottomLabelFrame(48);
    const history = createLongScreenshotMatchHistory(firstFrame);

    const historyPosition = detectLongScreenshotHistoryPosition(history, finalFrame);
    expect(historyPosition?.position).toBe(48);
    const update = getLongScreenshotFrameUpdate(
      { position: 0, capturedStartPosition: 0, capturedPosition: 0 },
      historyPosition
        ? { shift: historyPosition.position, score: historyPosition.score }
        : undefined,
    );
    expect(update.appendRows).toBe(48);
    const appended = extractLongScreenshotAppendedFrame(firstFrame, finalFrame, 48);
    const result = composeLongScreenshot([
      { frame: firstFrame, appendRows: firstFrame.height },
      { frame: appended, appendRows: appended.height },
    ]);
    const bottomPixel = ((result.height - 1) * result.width + 48) * 4;
    expect(result.height).toBe(192);
    expect(result.data[bottomPixel]).toBe(finalFrame.data[(143 * finalFrame.width + 48) * 4]);
  });

  it('keeps an interruption notice visible long enough to be perceived', () => {
    const shown = getLongScreenshotNoticeState({}, '滚动过快，请回到截图中断位置后慢速滚动', 1_000);
    expect(shown).toEqual({
      notice: '滚动过快，请回到截图中断位置后慢速滚动',
      visibleUntil: 2_600,
    });
    expect(getLongScreenshotNoticeState(shown, undefined, 1_300)).toEqual(shown);
    expect(getLongScreenshotNoticeState(shown, undefined, 2_601)).toEqual({});
  });

  it('composes only the newly revealed rows', () => {
    const slices: LongScreenshotSlice[] = [
      { frame: frame([10, 20, 30, 40]), appendRows: 4 },
      { frame: frame([30, 40, 50, 60]), appendRows: 2 },
      { frame: frame([50, 60, 70, 80]), appendRows: 2 },
    ];
    const result = composeLongScreenshot(slices);

    expect(result.width).toBe(2);
    expect(result.height).toBe(8);
    expect(
      Array.from({ length: result.height }, (_, y) => result.data[y * result.width * 4]),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('prepends newly revealed rows when scrolling above the first frame', () => {
    const firstFrame = frame([30, 40, 50, 60, 70, 80]);
    const current = frame([10, 20, 30, 40, 50, 60]);
    const prepended = extractLongScreenshotPrependedFrame(firstFrame, current, 2);
    const history = prependLongScreenshotMatchHistory(
      createLongScreenshotMatchHistory(firstFrame),
      current,
      2,
    );
    const result = composeLongScreenshot([
      { frame: prepended, appendRows: prepended.height },
      { frame: firstFrame, appendRows: firstFrame.height },
    ]);

    expect(history.height).toBe(8);
    expect(
      Array.from({ length: result.height }, (_, y) => result.data[y * result.width * 4]),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('keeps pixel order across an up-down sequence that crosses both captured edges', () => {
    const documentRows = Array.from({ length: 12 }, (_, index) => (index + 1) * 10);
    const offsets = [4, 2, 0, 2, 4, 6];
    const firstFrame = frame(documentRows.slice(offsets[0], offsets[0] + 6));
    let previous = firstFrame;
    let history = createLongScreenshotMatchHistory(firstFrame);
    let state = { position: 0, capturedStartPosition: 0, capturedPosition: 0 };
    const slices: LongScreenshotSlice[] = [{ frame: firstFrame, appendRows: firstFrame.height }];

    for (const offset of offsets.slice(1)) {
      const current = frame(documentRows.slice(offset, offset + 6));
      const historyPosition = detectLongScreenshotHistoryPosition(history, current);
      const absolutePosition = historyPosition
        ? state.capturedStartPosition + historyPosition.position
        : undefined;
      const update = getLongScreenshotFrameUpdate(
        state,
        historyPosition && absolutePosition !== undefined
          ? { shift: absolutePosition - state.position, score: historyPosition.score }
          : undefined,
      );
      if (update.prependRows) {
        const prepended = extractLongScreenshotPrependedFrame(
          previous,
          current,
          update.prependRows,
        );
        history = prependLongScreenshotMatchHistory(history, current, update.prependRows);
        slices.unshift({ frame: prepended, appendRows: prepended.height });
      } else if (update.appendRows) {
        const appended = extractLongScreenshotAppendedFrame(previous, current, update.appendRows);
        history = appendLongScreenshotMatchHistory(history, current, update.appendRows);
        slices.push({ frame: appended, appendRows: appended.height });
      }
      if (update.updateReference) previous = current;
      state = update.nextState;
    }

    const result = composeLongScreenshot(slices);
    expect(
      Array.from({ length: result.height }, (_, y) => result.data[y * result.width * 4]),
    ).toEqual(documentRows);
    expect(state).toEqual({ position: 2, capturedStartPosition: -4, capturedPosition: 2 });
  });

  it('stores only appended rows and bounds the coarse shift search for tall selections', () => {
    const appended = extractAppendedFrame(frame([10, 20, 30, 40]), 2);
    expect(appended.height).toBe(2);
    expect(Array.from(appended.data.filter((_, index) => index % 8 === 0))).toEqual([30, 40]);
    const scrollingEdges = extractLongScreenshotAppendedFrame(
      frame([10, 20, 30, 40]),
      frame([30, 40, 50, 60]),
      2,
    );
    expect(Array.from(scrollingEdges.data.filter((_, index) => index % 8 === 0))).toEqual([50, 60]);
    expect(getVerticalShiftSearchStep(100)).toBe(1);
    expect(Math.ceil(1_000 / getVerticalShiftSearchStep(1_000))).toBeLessThanOrEqual(100);
  });

  it('matches a Retina-sized scrolling frame against history without blocking the main process', () => {
    const width = 800;
    const height = 840;
    const shift = 240;
    const createFrame = (offset: number): BitmapFrame => {
      const data = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        const sourceY = y + offset;
        for (let x = 0; x < width; x += 1) {
          const pixel = (y * width + x) * 4;
          data[pixel] = Math.round(128 + Math.sin(sourceY * 0.017 + x * 0.011) * 100);
          data[pixel + 1] = Math.round(128 + Math.sin(sourceY * 0.023 + x * 0.007) * 100);
          data[pixel + 2] = Math.round(128 + Math.sin(sourceY * 0.013 + x * 0.019) * 100);
          data[pixel + 3] = 255;
        }
      }
      return { width, height, data };
    };
    const previous = createFrame(0);
    const current = createFrame(shift);
    const history = createLongScreenshotMatchHistory(previous);
    const startedAt = performance.now();

    expect(detectLongScreenshotHistoryPosition(history, current)?.position).toBe(shift);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it('rejects incompatible frames and excessive output height', () => {
    expect(() =>
      composeLongScreenshot([
        { frame: frame([10, 20]), appendRows: 2 },
        { frame: { ...frame([20, 30]), width: 3 }, appendRows: 1 },
      ]),
    ).toThrow('尺寸');
    expect(() => composeLongScreenshot([{ frame: frame([10, 20]), appendRows: 30_001 }])).toThrow(
      '过长',
    );
  });
});
