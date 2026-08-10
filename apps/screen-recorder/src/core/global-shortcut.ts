export function shouldHandleGlobalShortcut(context: {
  settingsVisible: boolean;
  shortcutCaptureActive: boolean;
}): boolean {
  return !context.shortcutCaptureActive;
}
