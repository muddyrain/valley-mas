import type { RecordingOptions } from '../core/recording-options';
import type { RecordingMode } from '../core/session';

export function getDisplayMediaOptions(options: RecordingOptions): DisplayMediaStreamOptions {
  return {
    audio: options.systemAudio,
    video: {
      frameRate: { ideal: 30, max: 30 },
      cursor: options.cursor ? 'always' : 'never',
    } as MediaTrackConstraints,
  };
}

export function getUserMediaOptions(options: RecordingOptions): MediaStreamConstraints | undefined {
  if (!options.microphone && !options.camera) return undefined;
  return { audio: options.microphone, video: options.camera };
}

export function shouldCompositeVideo(mode: RecordingMode, camera: boolean): boolean {
  return mode === 'region' || camera;
}
