export class RecordingResources {
  private readonly streams = new Set<Pick<MediaStream, 'getTracks'>>();
  private readonly listeners = new Set<() => void>();
  private canvasFrame: number | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly cancelFrame: (id: number) => void;
  private readonly clearTimer: (id: ReturnType<typeof setInterval>) => void;

  constructor(
    cancelFrame: (id: number) => void = (id) => cancelAnimationFrame(id),
    clearTimer: (id: ReturnType<typeof setInterval>) => void = (id) => clearInterval(id),
  ) {
    this.cancelFrame = (id) => cancelFrame(id);
    this.clearTimer = (id) => clearTimer(id);
  }

  addStream(stream: Pick<MediaStream, 'getTracks'>): void {
    this.streams.add(stream);
  }

  setCanvasFrame(id: number): void {
    this.canvasFrame = id;
  }

  setTimer(id: ReturnType<typeof setInterval>): void {
    this.timer = id;
  }

  addListener(dispose: () => void): void {
    this.listeners.add(dispose);
  }

  cleanup(): void {
    if (this.canvasFrame !== undefined) {
      this.cancelFrame(this.canvasFrame);
      this.canvasFrame = undefined;
    }
    if (this.timer !== undefined) {
      this.clearTimer(this.timer);
      this.timer = undefined;
    }
    for (const dispose of this.listeners) {
      dispose();
    }
    this.listeners.clear();
    for (const stream of this.streams) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    this.streams.clear();
  }
}
