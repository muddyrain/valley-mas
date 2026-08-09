export type BitmapFrame = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type LongScreenshotSlice = {
  frame: BitmapFrame;
  appendRows: number;
};

export type VerticalShift = {
  shift: number;
  score: number;
};

const MAX_LONG_SCREENSHOT_HEIGHT = 30_000;
const MAX_LONG_SCREENSHOT_BYTES = 256 * 1024 * 1024;
const MAX_COARSE_SHIFT_CANDIDATES = 100;

function validateFrame(frame: BitmapFrame): void {
  if (
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.data.byteLength !== frame.width * frame.height * 4
  ) {
    throw new Error('长截图画面尺寸无效');
  }
}

function differenceForShift(previous: BitmapFrame, current: BitmapFrame, shift: number): number {
  const overlapRows = previous.height - shift;
  const xStep = Math.max(1, Math.floor(previous.width / 48));
  const yStep = Math.max(1, Math.floor(overlapRows / 48));
  let difference = 0;
  let samples = 0;
  for (let y = 0; y < overlapRows; y += yStep) {
    const previousY = y + shift;
    for (let x = 0; x < previous.width; x += xStep) {
      const previousOffset = (previousY * previous.width + x) * 4;
      const currentOffset = (y * current.width + x) * 4;
      difference +=
        Math.abs(previous.data[previousOffset] - current.data[currentOffset]) +
        Math.abs(previous.data[previousOffset + 1] - current.data[currentOffset + 1]) +
        Math.abs(previous.data[previousOffset + 2] - current.data[currentOffset + 2]);
      samples += 3;
    }
  }
  return samples === 0 ? Number.POSITIVE_INFINITY : difference / samples;
}

export function getVerticalShiftSearchStep(maximumShift: number): number {
  return Math.max(1, Math.ceil(maximumShift / MAX_COARSE_SHIFT_CANDIDATES));
}

export function extractAppendedFrame(frame: BitmapFrame, appendRows: number): BitmapFrame {
  validateFrame(frame);
  if (!Number.isInteger(appendRows) || appendRows < 1 || appendRows > frame.height) {
    throw new Error('长截图增量范围无效');
  }
  const sourceStart = (frame.height - appendRows) * frame.width * 4;
  return {
    width: frame.width,
    height: appendRows,
    data: frame.data.slice(sourceStart),
  };
}

export function detectVerticalShift(
  previous: BitmapFrame,
  current: BitmapFrame,
  maximumScore = 18,
): VerticalShift | undefined {
  validateFrame(previous);
  validateFrame(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new Error('长截图画面尺寸不一致');
  }

  const duplicateScore = differenceForShift(previous, current, 0);
  if (duplicateScore <= 1.5) return { shift: 0, score: duplicateScore };

  const maximumShift = Math.max(1, Math.floor(previous.height * 0.9));
  const searchStep = getVerticalShiftSearchStep(maximumShift);
  let best: VerticalShift | undefined;
  for (let shift = 1; shift <= maximumShift; shift += searchStep) {
    const score = differenceForShift(previous, current, shift);
    if (!best || score < best.score) best = { shift, score };
  }
  if (best && searchStep > 1) {
    const start = Math.max(1, best.shift - searchStep + 1);
    const end = Math.min(maximumShift, best.shift + searchStep - 1);
    for (let shift = start; shift <= end; shift += 1) {
      const score = differenceForShift(previous, current, shift);
      if (score < best.score) best = { shift, score };
    }
  }
  return best && best.score <= maximumScore ? best : undefined;
}

export function composeLongScreenshot(slices: LongScreenshotSlice[]): BitmapFrame {
  if (slices.length === 0) throw new Error('长截图没有可用画面');
  for (const slice of slices) validateFrame(slice.frame);
  const width = slices[0].frame.width;
  if (slices.some((slice) => slice.frame.width !== width)) {
    throw new Error('长截图画面尺寸不一致');
  }
  const height = slices.reduce((total, slice) => total + slice.appendRows, 0);
  if (height > MAX_LONG_SCREENSHOT_HEIGHT || width * height * 4 > MAX_LONG_SCREENSHOT_BYTES) {
    throw new Error('长截图过长，请提前完成捕获');
  }
  if (
    slices.some(
      (slice, index) =>
        !Number.isInteger(slice.appendRows) ||
        slice.appendRows < 1 ||
        slice.appendRows > slice.frame.height ||
        (index === 0 && slice.appendRows !== slice.frame.height),
    )
  ) {
    throw new Error('长截图拼接范围无效');
  }

  const data = new Uint8Array(width * height * 4);
  let outputRow = 0;
  for (const { frame, appendRows } of slices) {
    const firstRow = frame.height - appendRows;
    const sourceStart = firstRow * width * 4;
    const sourceEnd = frame.height * width * 4;
    data.set(frame.data.subarray(sourceStart, sourceEnd), outputRow * width * 4);
    outputRow += appendRows;
  }
  return { width, height, data };
}
