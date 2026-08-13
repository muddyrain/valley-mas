type LongScreenshotWindowTarget = {
  isDestroyed(): boolean;
  once(event: 'ready-to-show', listener: () => void): void;
  showInactive(): void;
};

export function showLongScreenshotWindow(
  window: LongScreenshotWindowTarget,
  beforeShow?: () => void,
): void {
  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return;
    beforeShow?.();
    window.showInactive();
  });
}
