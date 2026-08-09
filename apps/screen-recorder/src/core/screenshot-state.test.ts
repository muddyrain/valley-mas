import { describe, expect, it, vi } from 'vitest';
import { ScreenshotSession, transitionScreenshotState } from './screenshot-state';

describe('screenshot state machine', () => {
  it('accepts full-screen and region screenshot lifecycles', async () => {
    expect(transitionScreenshotState('idle', 'begin-capture')).toBe('capturing');
    expect(transitionScreenshotState('capturing', 'complete')).toBe('completed');

    let state = transitionScreenshotState('completed', 'begin-selection');
    state = transitionScreenshotState(state, 'confirm-selection');
    state = transitionScreenshotState(state, 'begin-editing');
    expect(state).toBe('editing');
    state = transitionScreenshotState(state, 'complete');
    expect(state).toBe('completed');
  });

  it('rejects duplicate starts and illegal transitions', () => {
    const session = new ScreenshotSession();
    session.begin('region');
    expect(() => session.begin('screen')).toThrow('当前已有截图任务');
    expect(() => transitionScreenshotState('selecting', 'complete')).toThrow('非法截图状态转换');
  });

  it('cancels selection without creating a file', async () => {
    const capture = vi.fn();
    const session = new ScreenshotSession(capture);
    session.begin('region');
    session.cancelSelection();

    expect(session.state).toBe('idle');
    expect(capture).not.toHaveBeenCalled();
  });

  it('only creates output after capture begins', async () => {
    const capture = vi.fn().mockResolvedValue('C:\\Pictures\\shot.png');
    const session = new ScreenshotSession(capture);
    session.begin('screen');
    session.beginEditing();

    await expect(session.capture()).resolves.toBe('C:\\Pictures\\shot.png');
    expect(session.state).toBe('completed');
    expect(capture).toHaveBeenCalledOnce();
  });

  it('cancels editing without creating a file', () => {
    const capture = vi.fn();
    const session = new ScreenshotSession(capture);
    session.begin('region');
    session.confirmSelection();
    session.beginEditing();
    session.cancelEditing();

    expect(session.state).toBe('idle');
    expect(capture).not.toHaveBeenCalled();
  });

  it('supports long screenshot capture, completion and cancellation', () => {
    const session = new ScreenshotSession();
    session.begin('region');
    session.confirmSelection();
    session.beginEditing();
    session.beginLongCapture();
    expect(session.state).toBe('long-capturing');
    session.cancelEditing();
    expect(session.state).toBe('idle');

    session.begin('region');
    session.confirmSelection();
    session.beginEditing();
    session.beginLongCapture();
    session.complete();
    expect(session.state).toBe('completed');
  });
});
