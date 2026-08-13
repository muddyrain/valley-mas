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

export type LongScreenshotScrollState = {
  position: number;
  capturedStartPosition: number;
  capturedPosition: number;
};

export type LongScreenshotFrameUpdate = {
  nextState: LongScreenshotScrollState;
  updateReference: boolean;
  prependRows?: number;
  appendRows?: number;
  notice?: string;
};

export type LongScreenshotNoticeState = {
  notice?: string;
  visibleUntil?: number;
};

export type LongScreenshotMatchHistory = BitmapFrame;

const MAX_LONG_SCREENSHOT_HEIGHT = 30_000;
const MAX_LONG_SCREENSHOT_BYTES = 256 * 1024 * 1024;
const MAX_COARSE_SHIFT_CANDIDATES = 100;
const MATCH_VERTICAL_EDGE_TRIM_RATIO = 0.15;
const MATCH_HORIZONTAL_EDGE_TRIM_RATIO = 0.3;
const MINIMUM_SCORE_IMPROVEMENT = 0.05;
const DIRECTION_AMBIGUITY_SCORE_DELTA = 0.25;
const INTERRUPTION_NOTICE_MINIMUM_MS = 1_600;
const MATCH_HISTORY_WIDTH = 32;
const MINIMUM_HISTORY_OVERLAP_RATIO = 0.25;
const MAX_HISTORY_COARSE_CANDIDATES = 120;
const HISTORY_REFINEMENT_CANDIDATES = 4;
const FIXED_EDGE_MAXIMUM_WIDTH_RATIO = 0.45;
const FIXED_EDGE_MAXIMUM_SCORE = 3;

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
  const overlapRows = previous.height - Math.abs(shift);
  const xStep = Math.max(1, Math.floor(previous.width / 48));
  const yStep = Math.max(1, Math.floor(overlapRows / 48));
  const rowDifferences: number[] = [];
  for (let y = 0; y < overlapRows; y += yStep) {
    const previousY = shift >= 0 ? y + shift : y;
    const currentY = shift >= 0 ? y : y - shift;
    let rowDifference = 0;
    let rowSamples = 0;
    for (let x = 0; x < previous.width; x += xStep) {
      const previousOffset = (previousY * previous.width + x) * 4;
      const currentOffset = (currentY * current.width + x) * 4;
      rowDifference +=
        Math.abs(previous.data[previousOffset] - current.data[currentOffset]) +
        Math.abs(previous.data[previousOffset + 1] - current.data[currentOffset + 1]) +
        Math.abs(previous.data[previousOffset + 2] - current.data[currentOffset + 2]);
      rowSamples += 3;
    }
    if (rowSamples > 0) rowDifferences.push(rowDifference / rowSamples);
  }
  if (rowDifferences.length === 0) return Number.POSITIVE_INFINITY;
  const edgeRows = Math.min(
    Math.ceil(rowDifferences.length * MATCH_VERTICAL_EDGE_TRIM_RATIO),
    Math.floor((rowDifferences.length - 1) / 2),
  );
  const matchedRows = rowDifferences.slice(edgeRows, rowDifferences.length - edgeRows);
  return matchedRows.reduce((total, difference) => total + difference, 0) / matchedRows.length;
}

function createMatchFrame(frame: BitmapFrame): BitmapFrame {
  validateFrame(frame);
  const width = Math.min(MATCH_HISTORY_WIDTH, frame.width);
  const data = new Uint8Array(width * frame.height * 4);
  const left = Math.floor(frame.width * MATCH_HORIZONTAL_EDGE_TRIM_RATIO);
  const right = Math.max(left + 1, Math.ceil(frame.width * (1 - MATCH_HORIZONTAL_EDGE_TRIM_RATIO)));
  const usableWidth = right - left;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(right - 1, left + Math.floor(((x + 0.5) * usableWidth) / width));
      const sourceOffset = (y * frame.width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      data[targetOffset] = frame.data[sourceOffset];
      data[targetOffset + 1] = frame.data[sourceOffset + 1];
      data[targetOffset + 2] = frame.data[sourceOffset + 2];
      data[targetOffset + 3] = 255;
    }
  }
  return { width, height: frame.height, data };
}

function differenceForHistoryPosition(
  history: LongScreenshotMatchHistory,
  current: BitmapFrame,
  position: number,
): number {
  const historyStart = Math.max(0, position);
  const currentStart = Math.max(0, -position);
  const overlapRows = Math.min(current.height - currentStart, history.height - historyStart);
  const yStep = Math.max(1, Math.floor(overlapRows / 48));
  const rowDifferences: number[] = [];
  for (let y = 0; y < overlapRows; y += yStep) {
    let rowDifference = 0;
    for (let x = 0; x < history.width; x += 1) {
      const historyOffset = ((historyStart + y) * history.width + x) * 4;
      const currentOffset = ((currentStart + y) * current.width + x) * 4;
      rowDifference +=
        Math.abs(history.data[historyOffset] - current.data[currentOffset]) +
        Math.abs(history.data[historyOffset + 1] - current.data[currentOffset + 1]) +
        Math.abs(history.data[historyOffset + 2] - current.data[currentOffset + 2]);
    }
    rowDifferences.push(rowDifference / (history.width * 3));
  }
  const fixedTopRows = Math.min(
    Math.ceil(rowDifferences.length * MATCH_VERTICAL_EDGE_TRIM_RATIO),
    rowDifferences.length - 1,
  );
  const matchedRows = rowDifferences.slice(fixedTopRows);
  return matchedRows.reduce((total, difference) => total + difference, 0) / matchedRows.length;
}

function addBestHistoryCandidate(
  candidates: Array<{ position: number; score: number }>,
  candidate: { position: number; score: number },
  limit: number,
): void {
  const existing = candidates.find((item) => item.position === candidate.position);
  if (existing) {
    if (candidate.score < existing.score) existing.score = candidate.score;
  } else {
    candidates.push(candidate);
  }
  candidates.sort((left, right) => left.score - right.score || left.position - right.position);
  candidates.splice(limit);
}

function differenceForScreenColumn(previous: BitmapFrame, current: BitmapFrame, x: number): number {
  const yStep = Math.max(1, Math.floor(previous.height / 64));
  let difference = 0;
  let samples = 0;
  for (let y = 0; y < previous.height; y += yStep) {
    const offset = (y * previous.width + x) * 4;
    difference +=
      Math.abs(previous.data[offset] - current.data[offset]) +
      Math.abs(previous.data[offset + 1] - current.data[offset + 1]) +
      Math.abs(previous.data[offset + 2] - current.data[offset + 2]);
    samples += 3;
  }
  return difference / samples;
}

function detectFixedEdgeWidths(
  previous: BitmapFrame,
  current: BitmapFrame,
): { left: number; right: number } {
  const maximumWidth = Math.floor(previous.width * FIXED_EDGE_MAXIMUM_WIDTH_RATIO);
  let left = 0;
  while (
    left < maximumWidth &&
    differenceForScreenColumn(previous, current, left) <= FIXED_EDGE_MAXIMUM_SCORE
  ) {
    left += 1;
  }
  let right = 0;
  while (
    right < maximumWidth &&
    differenceForScreenColumn(previous, current, previous.width - right - 1) <=
      FIXED_EDGE_MAXIMUM_SCORE
  ) {
    right += 1;
  }
  return { left, right };
}

function getColumnMedian(frame: BitmapFrame, x: number, channel: number): number {
  const yStep = Math.max(1, Math.floor(frame.height / 64));
  const values: number[] = [];
  for (let y = 0; y < frame.height; y += yStep) {
    values.push(frame.data[(y * frame.width + x) * 4 + channel]);
  }
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)];
}

function stabilizeFixedEdges(
  previous: BitmapFrame,
  current: BitmapFrame,
  extracted: BitmapFrame,
): BitmapFrame {
  const fixedEdges = detectFixedEdgeWidths(previous, current);
  for (let x = 0; x < current.width; x += 1) {
    if (x >= fixedEdges.left && x < current.width - fixedEdges.right) continue;
    const color = [
      getColumnMedian(current, x, 0),
      getColumnMedian(current, x, 1),
      getColumnMedian(current, x, 2),
      getColumnMedian(current, x, 3),
    ];
    for (let y = 0; y < extracted.height; y += 1) {
      extracted.data.set(color, (y * extracted.width + x) * 4);
    }
  }
  return extracted;
}

function findBestShift(
  previous: BitmapFrame,
  current: BitmapFrame,
  direction: -1 | 1,
  maximumShift: number,
  searchStep: number,
): VerticalShift | undefined {
  let best: VerticalShift | undefined;
  for (let magnitude = 1; magnitude <= maximumShift; magnitude += searchStep) {
    const shift = magnitude * direction;
    const score = differenceForShift(previous, current, shift);
    if (!best || score < best.score) best = { shift, score };
  }
  if (!best || searchStep === 1) return best;
  const bestMagnitude = Math.abs(best.shift);
  const start = Math.max(1, bestMagnitude - searchStep + 1);
  const end = Math.min(maximumShift, bestMagnitude + searchStep - 1);
  for (let magnitude = start; magnitude <= end; magnitude += 1) {
    const shift = magnitude * direction;
    const score = differenceForShift(previous, current, shift);
    if (score < best.score) best = { shift, score };
  }
  return best;
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

export function extractLongScreenshotAppendedFrame(
  previous: BitmapFrame,
  current: BitmapFrame,
  appendRows: number,
): BitmapFrame {
  validateFrame(previous);
  validateFrame(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new Error('长截图画面尺寸不一致');
  }
  const appended = extractAppendedFrame(current, appendRows);
  return stabilizeFixedEdges(previous, current, appended);
}

export function extractLongScreenshotPrependedFrame(
  previous: BitmapFrame,
  current: BitmapFrame,
  prependRows: number,
): BitmapFrame {
  validateFrame(previous);
  validateFrame(current);
  if (previous.width !== current.width || previous.height !== current.height) {
    throw new Error('长截图画面尺寸不一致');
  }
  if (!Number.isInteger(prependRows) || prependRows < 1 || prependRows > current.height) {
    throw new Error('长截图增量范围无效');
  }
  const prepended = {
    width: current.width,
    height: prependRows,
    data: current.data.slice(0, prependRows * current.width * 4),
  };
  return stabilizeFixedEdges(previous, current, prepended);
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
  if (duplicateScore === 0) return { shift: 0, score: duplicateScore };

  const maximumShift = Math.max(1, Math.floor(previous.height * 0.9));
  const searchStep = getVerticalShiftSearchStep(maximumShift);
  const downward = findBestShift(previous, current, 1, maximumShift, searchStep);
  const upward = findBestShift(previous, current, -1, maximumShift, searchStep);
  if (
    downward &&
    upward &&
    downward.score <= maximumScore &&
    upward.score <= maximumScore &&
    Math.abs(downward.score - upward.score) <= DIRECTION_AMBIGUITY_SCORE_DELTA
  ) {
    return undefined;
  }
  const best =
    downward && upward ? (downward.score <= upward.score ? downward : upward) : downward || upward;
  const requiredImprovement = Math.max(MINIMUM_SCORE_IMPROVEMENT, duplicateScore * 0.15);
  if (!best || best.score > maximumScore) return undefined;
  if (duplicateScore - best.score < requiredImprovement) {
    return { shift: 0, score: duplicateScore };
  }
  return best;
}

export function createLongScreenshotMatchHistory(frame: BitmapFrame): LongScreenshotMatchHistory {
  return createMatchFrame(frame);
}

export function appendLongScreenshotMatchHistory(
  history: LongScreenshotMatchHistory,
  frame: BitmapFrame,
  appendRows: number,
): LongScreenshotMatchHistory {
  const matchFrame = createMatchFrame(frame);
  if (matchFrame.width !== history.width) throw new Error('长截图画面尺寸不一致');
  const appended = extractAppendedFrame(matchFrame, appendRows);
  const data = new Uint8Array(history.data.byteLength + appended.data.byteLength);
  data.set(history.data);
  data.set(appended.data, history.data.byteLength);
  return { width: history.width, height: history.height + appendRows, data };
}

export function prependLongScreenshotMatchHistory(
  history: LongScreenshotMatchHistory,
  frame: BitmapFrame,
  prependRows: number,
): LongScreenshotMatchHistory {
  const matchFrame = createMatchFrame(frame);
  if (matchFrame.width !== history.width) throw new Error('长截图画面尺寸不一致');
  if (!Number.isInteger(prependRows) || prependRows < 1 || prependRows > matchFrame.height) {
    throw new Error('长截图增量范围无效');
  }
  const byteLength = prependRows * matchFrame.width * 4;
  const data = new Uint8Array(byteLength + history.data.byteLength);
  data.set(matchFrame.data.subarray(0, byteLength));
  data.set(history.data, byteLength);
  return { width: history.width, height: history.height + prependRows, data };
}

export function detectLongScreenshotHistoryPosition(
  history: LongScreenshotMatchHistory,
  frame: BitmapFrame,
  maximumScore = 18,
): { position: number; score: number } | undefined {
  validateFrame(history);
  const current = createMatchFrame(frame);
  if (current.width !== history.width || current.height > history.height) {
    throw new Error('长截图画面尺寸不一致');
  }
  const minimumOverlap = Math.max(1, Math.floor(current.height * MINIMUM_HISTORY_OVERLAP_RATIO));
  const minimumPosition = -current.height + minimumOverlap;
  const maximumPosition = history.height - minimumOverlap;
  const coarseStep = Math.max(
    1,
    Math.ceil((maximumPosition - minimumPosition + 1) / MAX_HISTORY_COARSE_CANDIDATES),
  );
  const coarseCandidates: Array<{ position: number; score: number }> = [];
  for (let position = minimumPosition; position <= maximumPosition; position += coarseStep) {
    addBestHistoryCandidate(
      coarseCandidates,
      { position, score: differenceForHistoryPosition(history, current, position) },
      HISTORY_REFINEMENT_CANDIDATES,
    );
  }
  for (const position of [0, maximumPosition]) {
    addBestHistoryCandidate(
      coarseCandidates,
      {
        position,
        score: differenceForHistoryPosition(history, current, position),
      },
      HISTORY_REFINEMENT_CANDIDATES,
    );
  }

  const refinedCandidates: Array<{ position: number; score: number }> = [];
  for (const coarse of coarseCandidates) {
    const start = Math.max(minimumPosition, coarse.position - coarseStep + 1);
    const end = Math.min(maximumPosition, coarse.position + coarseStep - 1);
    for (let position = start; position <= end; position += 1) {
      addBestHistoryCandidate(
        refinedCandidates,
        { position, score: differenceForHistoryPosition(history, current, position) },
        2,
      );
    }
  }
  const best = refinedCandidates[0];
  if (!best || best.score > maximumScore) return undefined;
  const alternative = refinedCandidates.find(
    (candidate) =>
      Math.abs(candidate.position - best.position) > 1 &&
      candidate.score - best.score <= DIRECTION_AMBIGUITY_SCORE_DELTA,
  );
  const extensionDirection = (position: number) =>
    position < 0 ? -1 : position + current.height > history.height ? 1 : 0;
  if (
    alternative &&
    extensionDirection(best.position) !== extensionDirection(alternative.position)
  ) {
    return undefined;
  }
  return best;
}

export function getLongScreenshotFrameUpdate(
  state: LongScreenshotScrollState,
  match: VerticalShift | undefined,
): LongScreenshotFrameUpdate {
  if (!match) {
    return {
      nextState: state,
      updateReference: false,
      notice: '滚动过快，请回到截图中断位置后慢速滚动',
    };
  }
  const position = state.position + match.shift;
  const prependRows = Math.max(0, state.capturedStartPosition - position);
  const appendRows = Math.max(0, position - state.capturedPosition);
  return {
    nextState: {
      position,
      capturedStartPosition: Math.min(state.capturedStartPosition, position),
      capturedPosition: Math.max(state.capturedPosition, position),
    },
    updateReference: true,
    ...(prependRows > 0 ? { prependRows } : {}),
    ...(appendRows > 0 ? { appendRows } : {}),
  };
}

export function getLongScreenshotNoticeState(
  current: LongScreenshotNoticeState,
  notice: string | undefined,
  now: number,
): LongScreenshotNoticeState {
  if (notice) {
    return {
      notice,
      visibleUntil: Math.max(
        current.notice === notice ? (current.visibleUntil ?? 0) : 0,
        now + INTERRUPTION_NOTICE_MINIMUM_MS,
      ),
    };
  }
  if (current.notice && (current.visibleUntil ?? 0) > now) return current;
  return {};
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
