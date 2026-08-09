import { expect, it } from 'vitest';
import { chooseRecordingMimeType, isRecordingContainerSupported } from './mime';

it('falls back through supported WebM MIME types', () => {
  expect(chooseRecordingMimeType('webm', () => true)).toBe('video/webm;codecs=vp8');
  expect(chooseRecordingMimeType('webm', (mime) => mime === 'video/webm;codecs=vp8')).toBe(
    'video/webm;codecs=vp8',
  );
  expect(chooseRecordingMimeType('webm', (mime) => mime === 'video/webm')).toBe('video/webm');
  expect(() => chooseRecordingMimeType('webm', () => false)).toThrow('当前系统不支持 WebM 录制');
});

it('selects an actually supported MP4 MIME without pretending support', () => {
  expect(chooseRecordingMimeType('mp4', (mime) => mime === 'video/mp4;codecs=avc1.42001E')).toBe(
    'video/mp4;codecs=avc1.42001E',
  );
  expect(isRecordingContainerSupported('mp4', (mime) => mime === 'video/mp4')).toBe(true);
  expect(isRecordingContainerSupported('mp4', () => false)).toBe(false);
  expect(() => chooseRecordingMimeType('mp4', () => false)).toThrow('当前系统不支持 MP4 录制');
});
