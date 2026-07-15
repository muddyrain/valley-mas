import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BatchMarkdownImportDialog } from './BatchMarkdownImportDialog';

vi.mock('./PublicWallpaperPickerDialog', () => ({
  PublicWallpaperPickerDialog: () => null,
}));

describe('BatchMarkdownImportDialog', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('does not trigger an update loop while closed', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      root.render(
        <BatchMarkdownImportDialog open={false} onOpenChange={() => undefined} groups={[]} />,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded'),
    );
    root.unmount();
  });
});
