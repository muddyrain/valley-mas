import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECORDING_OPTIONS,
  getCameraOverlayRect,
  getDefaultRecordingOptions,
  getMediaDeviceAvailability,
  getMediaDeviceState,
  getRecordingCapabilities,
  parseRecordingConfiguration,
} from './recording-options';

describe('recording options', () => {
  it('exposes platform capabilities without pretending macOS loopback audio is available', () => {
    expect(getRecordingCapabilities('win32')).toEqual({
      systemAudio: true,
      microphone: true,
      camera: true,
      cursor: true,
    });
    expect(getRecordingCapabilities('darwin')).toEqual({
      systemAudio: false,
      microphone: true,
      camera: true,
      cursor: true,
    });
  });

  it('defaults to the captured computer volume and detects missing camera before recording', () => {
    expect(getDefaultRecordingOptions('win32')).toMatchObject({ systemAudio: true, audioGain: 1 });
    expect(getDefaultRecordingOptions('darwin')).toMatchObject({
      systemAudio: false,
      audioGain: 1,
    });
    expect(getMediaDeviceAvailability([{ kind: 'audioinput' }, { kind: 'audiooutput' }])).toEqual({
      camera: false,
      microphone: true,
    });
    expect(getMediaDeviceAvailability([{ kind: 'videoinput' }])).toEqual({
      camera: true,
      microphone: false,
    });
    expect(getMediaDeviceState('camera', undefined)).toBe('checking');
    expect(getMediaDeviceState('camera', { camera: false, microphone: true })).toBe('missing');
    expect(getMediaDeviceState('camera', { camera: true, microphone: true })).toBe('available');
  });

  it('validates a complete renderer configuration and rejects unsupported system audio', () => {
    expect(
      parseRecordingConfiguration(
        {
          container: 'mp4',
          options: {
            systemAudio: true,
            microphone: true,
            camera: true,
            cursor: false,
            audioGain: 0.65,
          },
        },
        'win32',
      ),
    ).toEqual({
      container: 'mp4',
      options: {
        systemAudio: true,
        microphone: true,
        camera: true,
        cursor: false,
        audioGain: 0.65,
      },
    });
    expect(() =>
      parseRecordingConfiguration(
        {
          container: 'webm',
          options: { ...DEFAULT_RECORDING_OPTIONS, systemAudio: true },
        },
        'darwin',
      ),
    ).toThrow('系统声音');
    expect(() => parseRecordingConfiguration({ container: 'webm' }, 'win32')).toThrow('配置');
    expect(() =>
      parseRecordingConfiguration(
        {
          container: 'webm',
          options: { ...DEFAULT_RECORDING_OPTIONS, audioGain: 1.5 },
        },
        'win32',
      ),
    ).toThrow('音量');
  });

  it('places a 16:9 camera overlay inside the output with stable margins', () => {
    expect(getCameraOverlayRect({ width: 1920, height: 1080 })).toEqual({
      x: 1488,
      y: 823,
      width: 400,
      height: 225,
    });
    expect(getCameraOverlayRect({ width: 400, height: 300 })).toEqual({
      x: 224,
      y: 194,
      width: 160,
      height: 90,
    });
  });
});
