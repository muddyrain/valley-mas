import { describe, expect, it, vi } from 'vitest';
import { RecordingSession } from './session';
import { transitionRecordingState } from './state-machine';

describe('recording state machine', () => {
  it('accepts the legal full-screen lifecycle through recording configuration', () => {
    let state = transitionRecordingState('idle', 'begin-configuration');
    state = transitionRecordingState(state, 'begin-countdown');
    state = transitionRecordingState(state, 'start-recording');
    state = transitionRecordingState(state, 'request-stop');
    state = transitionRecordingState(state, 'complete');
    expect(state).toBe('completed');
  });

  it('accepts selection confirmation and cancellation', () => {
    expect(transitionRecordingState('selecting', 'confirm-selection')).toBe('configuring');
    expect(transitionRecordingState('configuring', 'begin-countdown')).toBe('countdown');
    expect(transitionRecordingState('selecting', 'cancel-selection')).toBe('idle');
    expect(transitionRecordingState('configuring', 'cancel-configuration')).toBe('idle');
  });

  it('cancels a countdown without creating an output file', () => {
    const createOutput = vi.fn();
    const session = new RecordingSession(createOutput);

    session.begin('screen');
    session.cancelConfiguration();

    expect(session.state).toBe('idle');
    expect(createOutput).not.toHaveBeenCalled();
  });

  it('rejects illegal transitions, duplicate starts, and starts while stopping', async () => {
    expect(() => transitionRecordingState('idle', 'complete')).toThrow('非法录制状态转换');
    const session = new RecordingSession();
    session.begin('screen');
    expect(() => session.begin('region')).toThrow('当前已有录制会话');
    session.beginCountdown();
    await session.startRecording('video/webm');
    session.requestStop();
    expect(() => session.begin('screen')).toThrow('当前已有录制会话');
    expect(() => transitionRecordingState('stopping', 'begin-countdown')).toThrow(
      '非法录制状态转换',
    );
  });

  it('does not create an output when region selection is cancelled', () => {
    const createOutput = vi.fn();
    const session = new RecordingSession(createOutput);
    session.begin('region');
    session.cancelSelection();
    expect(session.state).toBe('idle');
    expect(createOutput).not.toHaveBeenCalled();
  });
});
