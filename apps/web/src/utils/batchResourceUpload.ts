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
