import { describe, expect, it } from 'vitest';
import { limitBatchResourceFiles, MAX_BATCH_RESOURCE_UPLOAD_IMAGES } from './batchResourceUpload';

describe('limitBatchResourceFiles', () => {
  it('limits a batch to the remaining upload slots', () => {
    const files = Array.from({ length: 12 }, (_, index) => ({ name: `image-${index}.png` }));
    const result = limitBatchResourceFiles(files, 3);

    expect(MAX_BATCH_RESOURCE_UPLOAD_IMAGES).toBe(10);
    expect(result.accepted).toHaveLength(7);
    expect(result.rejectedCount).toBe(5);
    expect(result.exceededLimit).toBe(true);
    expect(result.alreadyAtLimit).toBe(false);
  });
});
