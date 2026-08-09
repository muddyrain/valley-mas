import type { RecordingState } from './state-machine';

export type RecordingCompletionView = {
  fileName: string;
  outputPath: string;
};

export function getRecordingCompletionView(value: {
  state: RecordingState;
  outputPath?: string;
}): RecordingCompletionView | undefined {
  if (value.state !== 'completed' || !value.outputPath) {
    return undefined;
  }
  return {
    fileName: value.outputPath.split(/[\\/]/).at(-1) ?? value.outputPath,
    outputPath: value.outputPath,
  };
}
