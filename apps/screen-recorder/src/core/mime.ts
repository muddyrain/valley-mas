export type RecordingContainer = 'webm' | 'mp4';

export const RECORDING_MIME_CANDIDATES_BY_CONTAINER = {
  webm: ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'],
  mp4: [
    'video/mp4;codecs=avc1.42001E',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ],
} as const satisfies Record<RecordingContainer, readonly string[]>;

export const RECORDING_MIME_CANDIDATES = [
  ...RECORDING_MIME_CANDIDATES_BY_CONTAINER.webm,
  ...RECORDING_MIME_CANDIDATES_BY_CONTAINER.mp4,
] as const;

export function chooseRecordingMimeType(
  container: RecordingContainer,
  isSupported: (mime: string) => boolean,
): string {
  const mimeType = RECORDING_MIME_CANDIDATES_BY_CONTAINER[container].find(isSupported);
  if (!mimeType) {
    throw new Error(`当前系统不支持 ${container === 'mp4' ? 'MP4' : 'WebM'} 录制`);
  }
  return mimeType;
}

export function isRecordingContainerSupported(
  container: RecordingContainer,
  isSupported: (mime: string) => boolean,
): boolean {
  return RECORDING_MIME_CANDIDATES_BY_CONTAINER[container].some(isSupported);
}

export function recordingContainerForMime(mimeType: string): RecordingContainer | undefined {
  if (RECORDING_MIME_CANDIDATES_BY_CONTAINER.webm.includes(mimeType as never)) return 'webm';
  if (RECORDING_MIME_CANDIDATES_BY_CONTAINER.mp4.includes(mimeType as never)) return 'mp4';
  return undefined;
}
