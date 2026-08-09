export interface FileLimitResult<T> {
  accepted: T[];
  remainingSlots: number;
  rejectedCount: number;
  exceededLimit: boolean;
  alreadyAtLimit: boolean;
}

export interface UploadKeyOptions {
  randomUUID?: () => string;
  now?: () => number;
  random?: () => number;
}

export function limitFiles<T>(
  files: T[],
  currentCount: number,
  maxCount: number,
): FileLimitResult<T> {
  const remainingSlots = Math.max(maxCount - currentCount, 0);
  const accepted = files.slice(0, remainingSlots);
  const rejectedCount = Math.max(files.length - accepted.length, 0);

  return {
    accepted,
    remainingSlots,
    rejectedCount,
    exceededLimit: rejectedCount > 0,
    alreadyAtLimit: remainingSlots === 0 && files.length > 0,
  };
}

export function createUploadKey(options: UploadKeyOptions = {}): string {
  const randomUUID =
    options.randomUUID ??
    (options.now || options.random
      ? undefined
      : globalThis.crypto?.randomUUID?.bind(globalThis.crypto));
  if (randomUUID) return randomUUID();

  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  return `upload-${now()}-${Math.floor(random() * 0x100000000)
    .toString(16)
    .padStart(8, '0')}`;
}

export * from './image-transform';
