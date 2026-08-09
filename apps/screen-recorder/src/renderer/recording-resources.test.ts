import { expect, it, vi } from 'vitest';
import { RecordingResources } from './recording-resources';

it('releases media tracks, Canvas loop, timers, and listeners on stop', () => {
  const stopTrack = vi.fn();
  const cancelFrame = vi.fn();
  const clearTimer = vi.fn();
  const removeListener = vi.fn();
  const resources = new RecordingResources(cancelFrame, clearTimer);

  resources.addStream({ getTracks: () => [{ stop: stopTrack } as unknown as MediaStreamTrack] });
  resources.setCanvasFrame(42);
  resources.setTimer(7 as unknown as ReturnType<typeof setInterval>);
  resources.addListener(removeListener);
  resources.cleanup();

  expect(stopTrack).toHaveBeenCalledOnce();
  expect(cancelFrame).toHaveBeenCalledWith(42);
  expect(clearTimer).toHaveBeenCalledWith(7);
  expect(removeListener).toHaveBeenCalledOnce();
});

it('detaches frame producers before stopping their media tracks', () => {
  const cleanupOrder: string[] = [];
  const resources = new RecordingResources(
    () => undefined,
    () => undefined,
  );

  resources.addStream({
    getTracks: () => [{ stop: () => cleanupOrder.push('track') }] as unknown as MediaStreamTrack[],
  });
  resources.addListener(() => cleanupOrder.push('producer'));
  resources.cleanup();

  expect(cleanupOrder).toEqual(['producer', 'track']);
});

it('invokes browser cleanup callbacks without rebinding their receiver', () => {
  const receivers: unknown[] = [];
  const resources = new RecordingResources(
    function (this: unknown) {
      receivers.push(this);
    },
    function (this: unknown) {
      receivers.push(this);
    },
  );

  resources.setCanvasFrame(42);
  resources.setTimer(7 as unknown as ReturnType<typeof setInterval>);
  resources.cleanup();

  expect(receivers).toEqual([undefined, undefined]);
});
