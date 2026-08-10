export type RecordingState =
  | 'idle'
  | 'selecting'
  | 'configuring'
  | 'countdown'
  | 'recording'
  | 'stopping'
  | 'completed'
  | 'error';

export type RecordingEvent =
  | 'begin-selection'
  | 'begin-configuration'
  | 'begin-countdown'
  | 'confirm-selection'
  | 'cancel-selection'
  | 'cancel-configuration'
  | 'cancel-countdown'
  | 'start-recording'
  | 'request-stop'
  | 'complete'
  | 'fail'
  | 'reset';

export function transitionRecordingState(
  state: RecordingState,
  event: RecordingEvent,
): RecordingState {
  if (event === 'fail') {
    return 'error';
  }

  const transitions: Partial<
    Record<RecordingState, Partial<Record<RecordingEvent, RecordingState>>>
  > = {
    idle: { 'begin-selection': 'selecting', 'begin-configuration': 'configuring' },
    selecting: { 'confirm-selection': 'configuring', 'cancel-selection': 'idle' },
    configuring: { 'begin-countdown': 'countdown', 'cancel-configuration': 'idle' },
    countdown: { 'start-recording': 'recording', 'cancel-countdown': 'idle', reset: 'idle' },
    recording: { 'request-stop': 'stopping' },
    stopping: { complete: 'completed' },
    completed: {
      'begin-selection': 'selecting',
      'begin-configuration': 'configuring',
      reset: 'idle',
    },
    error: {
      'begin-selection': 'selecting',
      'begin-configuration': 'configuring',
      reset: 'idle',
    },
  };
  const next = transitions[state]?.[event];
  if (!next) {
    throw new Error(`非法录制状态转换：${state} + ${event}`);
  }
  return next;
}
