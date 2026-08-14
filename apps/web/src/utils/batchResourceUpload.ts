import { limitFiles } from '@valley/browser-media';

export const MAX_BATCH_RESOURCE_UPLOAD_IMAGES = 10;

export type BatchResourceFileLimitResult<T> = {
  accepted: T[];
  remainingSlots: number;
  rejectedCount: number;
  exceededLimit: boolean;
  alreadyAtLimit: boolean;
};

export function limitBatchResourceFiles<T>(
  files: T[],
  currentCount: number,
  maxCount = MAX_BATCH_RESOURCE_UPLOAD_IMAGES,
): BatchResourceFileLimitResult<T> {
  return limitFiles(files, currentCount, maxCount);
}

export async function runWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
) {
  const results = Array<R>(values.length);
  const workerCount = Math.min(values.length, Math.max(1, Math.floor(concurrency) || 1));
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(values[currentIndex], currentIndex);
      }
    }),
  );
  return results;
}

/** Public resources are newest-first, so upload the last selection first. */
export function getBatchResourceUploadOrder(indexes: number[]) {
  return [...indexes].reverse();
}
