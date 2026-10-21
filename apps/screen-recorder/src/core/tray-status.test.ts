import { expect, it } from 'vitest';
import { getTrayRecordingStatus } from './tray-status';

it('exposes countdown, elapsed recording time, saving and idle states', () => {
  expect(getTrayRecordingStatus('countdown', undefined, 4000, 1000).title).toContain('3');
  expect(getTrayRecordingStatus('recording', 1000, undefined, 66000).title).toContain('01:05');
  expect(getTrayRecordingStatus('recording', 1000, undefined, 66000).label).toContain('01:05');
  expect(getTrayRecordingStatus('stopping', 1000, undefined, 66000).title).toContain('保存');
  expect(getTrayRecordingStatus('idle', undefined, undefined, 66000).title).toBe('');
});
