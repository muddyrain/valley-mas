import { expect, it } from 'vitest';
import { getRecordingCompletionView } from './completion-view';

it('shows the completed video name and full local path', () => {
  expect(
    getRecordingCompletionView({
      state: 'completed',
      outputPath: 'C:\\Users\\A\\Videos\\Valley Screen Recordings\\Valley-Recording.mp4',
    }),
  ).toEqual({
    fileName: 'Valley-Recording.mp4',
    outputPath: 'C:\\Users\\A\\Videos\\Valley Screen Recordings\\Valley-Recording.mp4',
  });
});

it('stays hidden without a completed output', () => {
  expect(getRecordingCompletionView({ state: 'stopping' })).toBeUndefined();
  expect(getRecordingCompletionView({ state: 'completed' })).toBeUndefined();
});
