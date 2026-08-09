export type RecordingStatus = 'idle' | 'recording' | 'ready' | 'error';

export interface RecordingState {
  status: RecordingStatus;
  durationSeconds: number;
  elapsedSeconds: number;
  downloadUrl: string | null;
  error: string | null;
}

export type RecordingAction =
  | { type: 'start'; durationSeconds: number }
  | { type: 'tick'; elapsedSeconds: number }
  | { type: 'complete'; url: string }
  | { type: 'fail'; error: string }
  | { type: 'reset' };

const WEBM_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

export const createRecordingState = (): RecordingState => ({
  status: 'idle',
  durationSeconds: 10,
  elapsedSeconds: 0,
  downloadUrl: null,
  error: null,
});

export function selectWebmMimeType(isSupported: (mimeType: string) => boolean): string | null {
  return WEBM_MIME_TYPES.find(isSupported) ?? null;
}

export function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
  if (action.type === 'start') {
    if (state.status === 'recording') return state;
    return {
      status: 'recording',
      durationSeconds: Math.max(1, action.durationSeconds),
      elapsedSeconds: 0,
      downloadUrl: null,
      error: null,
    };
  }
  if (action.type === 'tick' && state.status === 'recording') {
    return { ...state, elapsedSeconds: Math.min(state.durationSeconds, action.elapsedSeconds) };
  }
  if (action.type === 'complete' && state.status === 'recording') {
    return { ...state, status: 'ready', downloadUrl: action.url, error: null };
  }
  if (action.type === 'fail') return { ...state, status: 'error', error: action.error };
  if (action.type === 'reset') return createRecordingState();
  return state;
}

export function createRecordingFileName(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
  return `ambient-forge-${stamp}.webm`;
}
