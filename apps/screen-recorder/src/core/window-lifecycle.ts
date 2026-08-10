export type DestroyableWindow = {
  isDestroyed(): boolean;
  destroy(): void;
};

export type WindowDestroyScheduler = (task: () => void) => void;

export function scheduleWindowDestroy(
  window: DestroyableWindow,
  schedule: WindowDestroyScheduler = setImmediate,
): void {
  schedule(() => {
    if (!window.isDestroyed()) window.destroy();
  });
}
