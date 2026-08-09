import { describe, expect, it } from 'vitest';
import { getDisplayMediaOptions, getUserMediaOptions, shouldCompositeVideo } from './media-capture';

const enabled = {
  systemAudio: true,
  microphone: true,
  camera: true,
  cursor: false,
  audioGain: 1,
};

describe('recording media capture plan', () => {
  it('requests loopback audio and applies the cursor preference to display capture', () => {
    expect(getDisplayMediaOptions(enabled)).toEqual({
      audio: true,
      video: { frameRate: { ideal: 30, max: 30 }, cursor: 'never' },
    });
  });

  it('requests only enabled local devices', () => {
    expect(getUserMediaOptions(enabled)).toEqual({ audio: true, video: true });
    expect(getUserMediaOptions({ ...enabled, microphone: false, camera: false })).toBeUndefined();
  });

  it('uses Canvas for region cropping or camera picture-in-picture', () => {
    expect(shouldCompositeVideo('screen', false)).toBe(false);
    expect(shouldCompositeVideo('screen', true)).toBe(true);
    expect(shouldCompositeVideo('region', false)).toBe(true);
  });
});
