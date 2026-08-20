import { describe, expect, it, vi } from 'vitest';
import { restartApplication } from './app-restart';

describe('application restart', () => {
  it('marks the app as quitting, schedules relaunch, then exits the current process', () => {
    const events: string[] = [];
    const markQuitting = vi.fn(() => events.push('mark-quitting'));
    const relaunch = vi.fn(() => events.push('relaunch'));
    const exit = vi.fn(() => events.push('exit'));

    restartApplication({ relaunch, exit }, markQuitting);

    expect(events).toEqual(['mark-quitting', 'relaunch', 'exit']);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
