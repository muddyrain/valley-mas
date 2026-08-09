export type ScreenshotMode = 'screen' | 'region';

export type ScreenshotState =
  | 'idle'
  | 'selecting'
  | 'capturing'
  | 'editing'
  | 'long-capturing'
  | 'completed'
  | 'error';

export type ScreenshotEvent =
  | 'begin-selection'
  | 'begin-capture'
  | 'confirm-selection'
  | 'cancel-selection'
  | 'begin-editing'
  | 'begin-long-capture'
  | 'cancel-editing'
  | 'complete'
  | 'fail'
  | 'reset';

export function transitionScreenshotState(
  state: ScreenshotState,
  event: ScreenshotEvent,
): ScreenshotState {
  if (event === 'fail') {
    return 'error';
  }

  const transitions: Partial<
    Record<ScreenshotState, Partial<Record<ScreenshotEvent, ScreenshotState>>>
  > = {
    idle: { 'begin-selection': 'selecting', 'begin-capture': 'capturing' },
    selecting: { 'confirm-selection': 'capturing', 'cancel-selection': 'idle' },
    capturing: { 'begin-editing': 'editing', complete: 'completed' },
    editing: {
      'begin-long-capture': 'long-capturing',
      complete: 'completed',
      'cancel-editing': 'idle',
    },
    'long-capturing': { complete: 'completed', 'cancel-editing': 'idle' },
    completed: {
      'begin-selection': 'selecting',
      'begin-capture': 'capturing',
      reset: 'idle',
    },
    error: {
      'begin-selection': 'selecting',
      'begin-capture': 'capturing',
      reset: 'idle',
    },
  };
  const next = transitions[state]?.[event];
  if (!next) {
    throw new Error(`非法截图状态转换：${state} + ${event}`);
  }
  return next;
}

export class ScreenshotSession {
  private currentState: ScreenshotState = 'idle';

  constructor(private readonly createOutput: () => Promise<string> = async () => 'unused') {}

  get state(): ScreenshotState {
    return this.currentState;
  }

  begin(mode: ScreenshotMode): void {
    try {
      this.currentState = transitionScreenshotState(
        this.currentState,
        mode === 'region' ? 'begin-selection' : 'begin-capture',
      );
    } catch {
      throw new Error('当前已有截图任务');
    }
  }

  confirmSelection(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'confirm-selection');
  }

  cancelSelection(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'cancel-selection');
  }

  beginEditing(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'begin-editing');
  }

  cancelEditing(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'cancel-editing');
  }

  beginLongCapture(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'begin-long-capture');
  }

  async capture(): Promise<string> {
    if (this.currentState !== 'capturing' && this.currentState !== 'editing') {
      throw new Error('当前状态不能保存截图');
    }
    try {
      const outputPath = await this.createOutput();
      this.currentState = transitionScreenshotState(this.currentState, 'complete');
      return outputPath;
    } catch (error) {
      this.currentState = transitionScreenshotState(this.currentState, 'fail');
      throw error;
    }
  }

  complete(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'complete');
  }

  fail(): void {
    this.currentState = transitionScreenshotState(this.currentState, 'fail');
  }
}
