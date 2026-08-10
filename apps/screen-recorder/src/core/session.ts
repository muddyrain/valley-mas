import { type RecordingState, transitionRecordingState } from './state-machine';

export type RecordingMode = 'screen' | 'region';
export type OutputSession = { sessionId: string; outputPath: string };

export class RecordingSession {
  private currentState: RecordingState = 'idle';

  constructor(
    private readonly createOutput: (mimeType: string) => Promise<OutputSession> = async () => ({
      sessionId: 'unused',
      outputPath: 'unused',
    }),
  ) {}

  get state(): RecordingState {
    return this.currentState;
  }

  begin(mode: RecordingMode): void {
    try {
      this.currentState = transitionRecordingState(
        this.currentState,
        mode === 'region' ? 'begin-selection' : 'begin-configuration',
      );
    } catch {
      throw new Error('当前已有录制会话');
    }
  }

  confirmSelection(): void {
    this.currentState = transitionRecordingState(this.currentState, 'confirm-selection');
  }

  beginCountdown(): void {
    this.currentState = transitionRecordingState(this.currentState, 'begin-countdown');
  }

  cancelConfiguration(): void {
    this.currentState = transitionRecordingState(this.currentState, 'cancel-configuration');
  }

  cancelSelection(): void {
    this.currentState = transitionRecordingState(this.currentState, 'cancel-selection');
  }

  cancelCountdown(): void {
    this.currentState = transitionRecordingState(this.currentState, 'cancel-countdown');
  }

  async startRecording(mimeType: string): Promise<OutputSession> {
    if (this.currentState !== 'countdown') {
      throw new Error('当前状态不能开始写入');
    }
    const output = await this.createOutput(mimeType);
    this.currentState = transitionRecordingState(this.currentState, 'start-recording');
    return output;
  }

  requestStop(): void {
    this.currentState = transitionRecordingState(this.currentState, 'request-stop');
  }

  complete(): void {
    this.currentState = transitionRecordingState(this.currentState, 'complete');
  }

  fail(): void {
    this.currentState = transitionRecordingState(this.currentState, 'fail');
  }
}
