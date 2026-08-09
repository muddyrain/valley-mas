import { expect, it } from 'vitest';
import { createRecordingFilename, createScreenshotFilename, ensurePngExtension } from './filename';

it('creates a sortable local-time WebM filename', () => {
  expect(createRecordingFilename(new Date(2026, 7, 8, 15, 30, 45), 'webm')).toBe(
    'Valley-Recording-20260808-153045.webm',
  );
});

it('uses the selected MP4 container extension', () => {
  expect(createRecordingFilename(new Date(2026, 7, 8, 15, 30, 45), 'mp4')).toBe(
    'Valley-Recording-20260808-153045.mp4',
  );
});

it('creates a sortable local-time PNG screenshot filename', () => {
  expect(createScreenshotFilename(new Date(2026, 7, 8, 15, 30, 45))).toBe(
    'Valley-Screenshot-20260808-153045.png',
  );
});

it('keeps native save dialog output on the PNG format', () => {
  expect(ensurePngExtension('C:\\Pictures\\capture')).toBe('C:\\Pictures\\capture.png');
  expect(ensurePngExtension('C:\\Pictures\\capture.PNG')).toBe('C:\\Pictures\\capture.PNG');
});
