import { describe, expect, it } from 'vitest';
import { getLoginItemTarget, parsePersistedAppSettings } from './app-settings';
import { getDefaultCapturePreferences } from './capture-preferences';

describe('persisted screen recorder settings', () => {
  it('loads new preferences alongside legacy settings without dropping either', () => {
    const capturePreferences = getDefaultCapturePreferences('darwin');
    capturePreferences.recording.options.microphone = true;
    capturePreferences.annotation.mosaicSize = 24;
    const settings = parsePersistedAppSettings(
      { recordingDirectory: '/recordings', notificationsEnabled: true, capturePreferences },
      (value) => value.startsWith('/'),
      'darwin',
    );
    expect(settings).toEqual({
      recordingDirectory: '/recordings',
      notificationsEnabled: true,
      capturePreferences,
    });
    expect(
      parsePersistedAppSettings({ capturePreferences }, () => false, 'darwin').capturePreferences,
    ).toEqual(capturePreferences);
  });
  const isAbsolute = (value: string) => /^[A-Z]:\\\\/.test(value);

  it('accepts only a bounded absolute recording directory', () => {
    expect(parsePersistedAppSettings({ recordingDirectory: 'D:\\\\Captures' }, isAbsolute)).toEqual(
      {
        recordingDirectory: 'D:\\\\Captures',
        notificationsEnabled: false,
      },
    );
    expect(parsePersistedAppSettings({ recordingDirectory: '..\\\\Captures' }, isAbsolute)).toEqual(
      { notificationsEnabled: false },
    );
    expect(parsePersistedAppSettings({ recordingDirectory: 42 }, isAbsolute)).toEqual({
      notificationsEnabled: false,
    });
  });

  it('keeps system notifications off unless the user explicitly enables them', () => {
    expect(parsePersistedAppSettings({}, isAbsolute)).toEqual({ notificationsEnabled: false });
    expect(parsePersistedAppSettings({ notificationsEnabled: true }, isAbsolute)).toEqual({
      notificationsEnabled: true,
    });
    expect(parsePersistedAppSettings({ notificationsEnabled: 'true' }, isAbsolute)).toEqual({
      notificationsEnabled: false,
    });
  });

  it('targets the packaged app normally and supplies Electron dev arguments only on Windows', () => {
    expect(getLoginItemTarget('win32', true, 'electron.exe', 'C:\\repo')).toEqual({});
    expect(getLoginItemTarget('darwin', false, '/Electron', '/repo')).toEqual({});
    expect(getLoginItemTarget('win32', false, 'C:\\Electron.exe', 'C:\\repo')).toEqual({
      path: 'C:\\Electron.exe',
      args: ['C:\\repo'],
    });
  });
});
