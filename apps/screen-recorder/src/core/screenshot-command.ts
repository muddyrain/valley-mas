export type ScreenshotOutputAction = 'copy' | 'save' | 'copy-and-save';
export type ScreenshotCommand = 'copy' | 'save' | 'undo' | 'redo' | 'cancel';

export function getScreenshotCommand(
  event: {
    key: string;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    isComposing?: boolean;
  },
  editingText: boolean,
): ScreenshotCommand | undefined {
  if (event.isComposing || event.altKey) return;
  const key = event.key.toLowerCase();
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && key === 's') return 'save';
  if (editingText) return;
  if (event.key === 'Escape') return 'cancel';
  if (event.key === 'Enter' && !modifier) return 'copy';
  if (!modifier) return;
  if (key === 'c') return 'copy';
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey) return 'redo';
}
