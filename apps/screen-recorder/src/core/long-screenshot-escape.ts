type ShortcutRegistry = {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
};

export function registerLongScreenshotEscape(
  registry: ShortcutRegistry,
  cancel: () => void,
): () => void {
  const registered = registry.register('Escape', cancel);
  return () => {
    if (registered) registry.unregister('Escape');
  };
}
