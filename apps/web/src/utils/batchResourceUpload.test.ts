import { describe, expect, it } from 'vitest';
import {
  getBatchResourceUploadOrder,
  limitBatchResourceFiles,
  MAX_BATCH_RESOURCE_UPLOAD_IMAGES,
  runWithConcurrency,
} from './batchResourceUpload';

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

describe('runWithConcurrency', () => {
  it('caps AI metadata work at three concurrent requests', async () => {
    let active = 0;
    let peak = 0;
    const releases: Array<() => void> = [];

    const promise = runWithConcurrency([1, 2, 3, 4, 5], 3, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return value * 2;
    });

    await Promise.resolve();
    expect(active).toBe(3);
    releases.splice(0, 3).forEach((release) => {
      release();
    });
    await Promise.resolve();
    await Promise.resolve();
    releases.splice(0).forEach((release) => {
      release();
    });

    await expect(promise).resolves.toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(3);
  });
});

describe('getBatchResourceUploadOrder', () => {
  it('uploads selected items in reverse so newest-first queries preserve selection order', () => {
    expect(getBatchResourceUploadOrder([0, 1, 2, 3])).toEqual([3, 2, 1, 0]);
  });
});
