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
