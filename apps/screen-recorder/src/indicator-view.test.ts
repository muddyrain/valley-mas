import { describe, expect, it } from 'vitest';
import { getIndicatorFrame, getIndicatorView } from './indicator-view';
import type { RecorderSnapshot } from './shared/contracts';

const baseSnapshot: RecorderSnapshot = {
  state: 'idle',
  settingsVisible: false,
  platform: 'win32',
  recordingCapabilities: { systemAudio: true, microphone: true, camera: true, cursor: true },
  saveDirectory: 'C:\\Videos',
  autoLaunch: false,
  shortcut: 'Control+Alt+Shift+2',
  shortcuts: {
    screenshot: 'Control+Alt+Shift+1',
    recording: 'Control+Alt+Shift+2',
    colorPicker: 'Control+Alt+Shift+3',
  },
  notificationsEnabled: false,
  shortcutCaptureActive: false,
  screenCapturePermission: 'granted',
  screenshot: { state: 'idle', saveDirectory: 'C:\\Pictures', copiedToClipboard: false },
};

describe('recording indicator view', () => {
  it('keeps the selected region visible while recording options are being configured', () => {
    const snapshot: RecorderSnapshot = {
      ...baseSnapshot,
      state: 'configuring',
      plan: {
        operationId: 'region-configuring',
        mode: 'region',
        container: 'webm',
        options: {
          systemAudio: false,
          microphone: false,
          camera: false,
          cursor: true,
          audioGain: 1,
        },
        display: {
          id: 'right',
          bounds: { x: 1920, y: -80, width: 2560, height: 1440 },
          scaleFactor: 1.25,
        },
        selection: { x: 2240, y: 120, width: 800, height: 450 },
        countdownEndsAt: 0,
      },
    };

    expect(getIndicatorView(snapshot, 1_500)).toEqual({
      label: '录制区域',
      elapsed: '800 × 450',
      phase: 'configuring',
    });
    expect(getIndicatorFrame(snapshot)).toEqual({
      mode: 'region',
      x: 320,
      y: 200,
      width: 800,
      height: 450,
    });
  });

  it('shows the remaining countdown before capture starts', () => {
    const snapshot: RecorderSnapshot = {
      ...baseSnapshot,
      state: 'countdown',
      plan: {
        operationId: 'screen-1',
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
          scaleFactor: 1.25,
        },
        countdownEndsAt: 4_000,
      },
    };

    expect(getIndicatorView(snapshot, 1_500)).toEqual({
      label: '准备录制',
      elapsed: '3',
      phase: 'countdown',
    });
    expect(getIndicatorFrame(snapshot)).toEqual({
      mode: 'screen',
      x: 2,
      y: 2,
      width: 1916,
      height: 1076,
    });
  });

  it('shows a region countdown and maps its global selection into indicator-local DIP', () => {
    const snapshot: RecorderSnapshot = {
      ...baseSnapshot,
      state: 'countdown',
      plan: {
        operationId: 'region-1',
        mode: 'region',
        container: 'webm',
        options: {
          systemAudio: false,
          microphone: false,
          camera: false,
          cursor: true,
          audioGain: 1,
        },
        display: {
          id: 'left',
          bounds: { x: -1600, y: -120, width: 1600, height: 900 },
          scaleFactor: 1.5,
        },
        selection: { x: -1500, y: -20, width: 640, height: 360 },
        countdownEndsAt: 4_000,
      },
    };

    expect(getIndicatorView(snapshot, 1_500)).toEqual({
      label: '准备录制',
      elapsed: '3',
      phase: 'countdown',
    });
    expect(getIndicatorFrame(snapshot)).toEqual({
      mode: 'region',
      x: 100,
      y: 100,
      width: 640,
      height: 360,
    });
  });

  it('shows a sortable recording duration while recording', () => {
    expect(
      getIndicatorView({ ...baseSnapshot, state: 'recording', startedAt: 1_000 }, 66_900),
    ).toEqual({ label: '正在录制', elapsed: '01:05', phase: 'recording' });
  });

  it('shows a saving state while media data is being finalized', () => {
    expect(getIndicatorView({ ...baseSnapshot, state: 'stopping' }, 2_000)).toEqual({
      label: '正在保存',
      elapsed: '…',
      phase: 'stopping',
    });
  });

  it('stays hidden outside the active screen-recording lifecycle', () => {
    expect(getIndicatorView(baseSnapshot, 2_000)).toBeUndefined();
  });
});
