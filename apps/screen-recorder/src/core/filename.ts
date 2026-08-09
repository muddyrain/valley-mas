import type { RecordingContainer } from './mime';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function createRecordingFilename(
  date: Date,
  container: RecordingContainer = 'webm',
): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `Valley-Recording-${day}-${time}.${container}`;
}

export function createScreenshotFilename(date: Date): string {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `Valley-Screenshot-${day}-${time}.png`;
}

export function ensurePngExtension(filePath: string): string {
  return /\.png$/i.test(filePath) ? filePath : `${filePath}.png`;
}
