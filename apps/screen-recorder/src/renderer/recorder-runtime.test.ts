import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CapturePlan, RecorderApi } from '../shared/contracts';
import { RecorderRuntime } from './recorder-runtime';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createApi(preparation: Promise<CapturePlan>) {
  return {
    prepareCapture: vi.fn(() => preparation),
    abort: vi.fn(async () => undefined),
  } as unknown as RecorderApi;
}

const plan: CapturePlan = {
  operationId: 'strict-mode-attempt',
  mode: 'screen',
  container: 'webm',
  options: {
    systemAudio: false,
    microphone: false,
    camera: false,
    cursor: true,
    audioGain: 1,
  },
  display: {
    id: 'primary',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
  },
  countdownEndsAt: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

it('does not continue or abort an in-flight attempt after the recorder host is disposed', async () => {
  const preparation = deferred<CapturePlan>();
  const getDisplayMedia = vi.fn(async () => ({
    getTracks: () => [],
    getVideoTracks: () => [],
  }));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
  const api = createApi(preparation.promise);
  const runtime = new RecorderRuntime(
    api,
    () => undefined,
    () => undefined,
  );

  const starting = runtime.begin(plan);
  runtime.dispose();
  preparation.resolve(plan);
  await starting;

  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(api.abort).not.toHaveBeenCalled();
});

it('ignores a late snapshot that tries to begin after the recorder host was disposed', async () => {
  const getDisplayMedia = vi.fn(async () => ({
    getTracks: () => [],
    getVideoTracks: () => [],
  }));
  vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia } });
  const api = createApi(Promise.resolve(plan));
  const runtime = new RecorderRuntime(
    api,
    () => undefined,
    () => undefined,
  );

  runtime.dispose();
  await runtime.begin(plan);

  expect(api.prepareCapture).not.toHaveBeenCalled();
  expect(getDisplayMedia).not.toHaveBeenCalled();
  expect(api.abort).not.toHaveBeenCalled();
});

it('deduplicates the same operation while its countdown is pending', async () => {
  const preparation = deferred<CapturePlan>();
  const api = createApi(preparation.promise);
  const runtime = new RecorderRuntime(
    api,
    () => undefined,
    () => undefined,
  );

  const first = runtime.begin(plan);
  const duplicate = runtime.begin(plan);

  expect(api.prepareCapture).toHaveBeenCalledOnce();
  runtime.dispose();
  preparation.resolve(plan);
  await Promise.all([first, duplicate]);
});

it('waits for the first cropped Canvas frame before starting file output', async () => {
  let frameCallback: VideoFrameRequestCallback | undefined;
  const sourceTrack = {
    addEventListener: vi.fn(),
    getSettings: () => ({ width: 1920, height: 1080 }),
    removeEventListener: vi.fn(),
    stop: vi.fn(),
  };
  const sourceStream = {
    getAudioTracks: () => [],
    getTracks: () => [sourceTrack],
    getVideoTracks: () => [sourceTrack],
  } as unknown as MediaStream;
  const croppedTrack = {
    getSettings: () => ({ width: 320, height: 240 }),
    stop: vi.fn(),
  };
  const croppedStream = {
    getAudioTracks: () => [],
    getTracks: () => [croppedTrack],
    getVideoTracks: () => [croppedTrack],
  } as unknown as MediaStream;
  const video = {
    addEventListener: vi.fn((event: string, listener: () => void) => {
      if (event === 'loadedmetadata') queueMicrotask(listener);
    }),
    cancelVideoFrameCallback: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(async () => undefined),
    remove: vi.fn(),
    requestVideoFrameCallback: vi.fn((listener: VideoFrameRequestCallback) => {
      frameCallback = listener;
      return 1;
    }),
    srcObject: null,
    style: {},
  };
  const context = { drawImage: vi.fn() };
  const canvas = {
    captureStream: vi.fn(() => croppedStream),
    getContext: vi.fn(() => context),
    height: 0,
    remove: vi.fn(),
    style: {},
    width: 0,
  };
  vi.stubGlobal('document', {
    body: { append: vi.fn() },
    createElement: vi.fn((tag: string) => (tag === 'video' ? video : canvas)),
  });
  vi.stubGlobal('navigator', {
    mediaDevices: { getDisplayMedia: vi.fn(async () => sourceStream) },
  });
  class FakeMediaRecorder {
    static isTypeSupported = () => true;
    state: RecordingState = 'inactive';
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    requestData = vi.fn();
    start = vi.fn(() => {
      this.state = 'recording';
    });
    stop = vi.fn(() => {
      this.state = 'inactive';
    });
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  const regionPlan: CapturePlan = {
    ...plan,
    mode: 'region',
    selection: { x: 100, y: 100, width: 320, height: 240 },
  };
  const startWriting = vi.fn(async () => ({ sessionId: 'session-1' }));
  const api = {
    ...createApi(Promise.resolve(regionPlan)),
    appendChunk: vi.fn(async () => undefined),
    startWriting,
  } as unknown as RecorderApi;
  const runtime = new RecorderRuntime(
    api,
    () => undefined,
    () => undefined,
  );

  const starting = runtime.begin(regionPlan);
  await vi.waitFor(() => expect(frameCallback).toBeTypeOf('function'));

  expect(startWriting).not.toHaveBeenCalled();
  frameCallback?.(0, {} as VideoFrameCallbackMetadata);
  await starting;
  expect(startWriting).toHaveBeenCalledOnce();
  runtime.dispose();
});
