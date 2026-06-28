import { afterEach, describe, expect, it } from 'vitest';
import { shouldRunMusicRuntime } from '../src/components/runtimeGatePolicy';
import { useMusicStore } from '../src/store/musicStore';

const initialMusicState = {
  runtimeEnabled: false,
  isPlaying: false,
  progress: 0,
  duration: 0,
  error: null,
  isLoadingAudius: false,
  audiusError: null,
};

describe('music runtime lifecycle', () => {
  afterEach(() => {
    useMusicStore.setState(initialMusicState);
  });

  it('keeps the music runtime disabled until the user activates music', () => {
    expect(useMusicStore.getState().runtimeEnabled).toBe(false);

    useMusicStore.getState().activateRuntime();

    expect(useMusicStore.getState().runtimeEnabled).toBe(true);
  });

  it('activates the runtime when playback is requested', () => {
    useMusicStore.getState().play();

    expect(useMusicStore.getState().runtimeEnabled).toBe(true);
  });

  it('runs the audio runtime only while the music window or playback is active', () => {
    expect(
      shouldRunMusicRuntime({
        runtimeEnabled: false,
        isMusicWindowRunning: true,
        isPlaying: false,
        isBuffering: false,
      }),
    ).toBe(false);

    expect(
      shouldRunMusicRuntime({
        runtimeEnabled: true,
        isMusicWindowRunning: true,
        isPlaying: false,
        isBuffering: false,
      }),
    ).toBe(true);

    expect(
      shouldRunMusicRuntime({
        runtimeEnabled: true,
        isMusicWindowRunning: false,
        isPlaying: true,
        isBuffering: false,
      }),
    ).toBe(true);

    expect(
      shouldRunMusicRuntime({
        runtimeEnabled: true,
        isMusicWindowRunning: false,
        isPlaying: false,
        isBuffering: false,
      }),
    ).toBe(false);
  });
});
