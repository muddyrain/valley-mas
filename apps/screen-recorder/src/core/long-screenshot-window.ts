type LongScreenshotWindowTarget = {
  isDestroyed(): boolean;
  showInactive(): void;
};

export function showLongScreenshotWindow(
  window: LongScreenshotWindowTarget,
  beforeShow?: () => void,
): void {
  if (window.isDestroyed()) return;
  beforeShow?.();
  window.showInactive();
}
