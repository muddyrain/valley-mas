import { expect, it } from 'vitest';
import { getDefaultCapturePreferences, parseCapturePreferences } from './capture-preferences';
import { resolveRecordingContainer } from './mime';

it('defaults to MP4 and uses a supported fallback without changing the remembered choice', () => {
  const defaults = getDefaultCapturePreferences('darwin');
  expect(defaults.recording.container).toBe('mp4');
  expect(resolveRecordingContainer('mp4', (mime) => mime.startsWith('video/mp4'))).toBe('mp4');
  expect(resolveRecordingContainer('mp4', (mime) => mime.startsWith('video/webm'))).toBe('webm');
  expect(defaults.recording.container).toBe('mp4');
  expect(() => resolveRecordingContainer('mp4', () => false)).toThrow();
});

it('round trips recording and annotation preferences and rejects invalid fields', () => {
  const preferences = getDefaultCapturePreferences('darwin');
  preferences.recording.options.microphone = true;
  preferences.annotation.color = '#ef4444';
  preferences.annotation.strokeWidth = 8;
  expect(parseCapturePreferences(JSON.parse(JSON.stringify(preferences)), 'darwin')).toEqual(
    preferences,
  );
  expect(
    parseCapturePreferences(
      { recording: { container: 'gif' }, annotation: { color: 'bad', strokeWidth: 99 } },
      'darwin',
    ),
  ).toEqual(getDefaultCapturePreferences('darwin'));
});
