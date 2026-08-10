export type ReusableWindow = {
  isDestroyed(): boolean;
  destroy(): void;
};

export class PreparedWindowSlot<T extends ReusableWindow> {
  private current: T | undefined;

  hasWindow(): boolean {
    return Boolean(this.current && !this.current.isDestroyed());
  }

  peek(): T | undefined {
    return this.current && !this.current.isDestroyed() ? this.current : undefined;
  }

  store(window: T): void {
    if (this.current && this.current !== window && !this.current.isDestroyed()) {
      this.current.destroy();
    }
    this.current = window;
  }

  take(): T | undefined {
    const window = this.current;
    this.current = undefined;
    return window && !window.isDestroyed() ? window : undefined;
  }

  remove(window: T): void {
    if (this.current === window) this.current = undefined;
  }

  destroy(): void {
    const window = this.take();
    window?.destroy();
  }
}
