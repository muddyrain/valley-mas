import { expect, it, vi } from 'vitest';
import {
  hideRecordingOverlaysBeforeCapture,
  shouldShowRecordingOverlay,
} from './recording-overlays';

it('never reopens macOS overlays once capture preparation has hidden them', () => {
  expect(shouldShowRecordingOverlay('darwin', 'configuring', false)).toBe(true);
  expect(shouldShowRecordingOverlay('darwin', 'countdown', false)).toBe(true);
  expect(shouldShowRecordingOverlay('darwin', 'countdown', true)).toBe(false);
  expect(shouldShowRecordingOverlay('darwin', 'recording', true)).toBe(false);
  expect(shouldShowRecordingOverlay('darwin', 'stopping', true)).toBe(false);
  expect(shouldShowRecordingOverlay('win32', 'recording', true)).toBe(true);
});

it('hides overlays before waiting for the compositor on macOS', async () => {
  const order: string[] = [];
  const window = { isDestroyed: () => false, hide: () => order.push('hide') };
  const settle = vi.fn(async () => {
    order.push('settle');
  });
  await hideRecordingOverlaysBeforeCapture('darwin', [window, undefined], settle);
  expect(order).toEqual(['hide', 'settle']);
  order.length = 0;
  await hideRecordingOverlaysBeforeCapture('win32', [window], settle);
  expect(order).toEqual([]);
  expect(settle).toHaveBeenCalledOnce();
});
