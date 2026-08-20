import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const mainUrl = new URL('../../electron/main.ts', import.meta.url);
const overlayUrl = new URL('../SelectionOverlay.tsx', import.meta.url);
const editorUrl = new URL('../ScreenshotEditor.tsx', import.meta.url);
const contractsUrl = new URL('../shared/contracts.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

describe('region screenshot capture overlay exclusion', () => {
  it('captures before selection and reuses the same overlay for an immediate editor handoff', async () => {
    const main = await readFile(mainUrl, 'utf8');

    expect(main).toMatch(
      /if \(mode === 'region'\) \{[\s\S]*?await primeScreenshotCapture\(display, false\);[\s\S]*?createSelectionWindow\(display, 'screenshot'\);/,
    );
    expect(main).toMatch(/function reuseSelectionWindowForScreenshotEditor/);
    expect(main).toMatch(/screenshotEditorWindow = selectionWindow;/);
    expect(main).not.toContain('createScreenshotEditorBrowserWindow');
    expect(main).not.toContain('completedSelectionWindow.destroy()');
    expect(main).not.toContain('captureConfirmedScreenshotSource');
    expect(main).toContain('const SCREENSHOT_OVERLAY_HIDE_SETTLE_MS = 32;');
  });

  it('backs selection and editing with the same frozen full-display frame', async () => {
    const [main, overlay, editor, contracts, styles] = await Promise.all([
      readFile(mainUrl, 'utf8'),
      readFile(overlayUrl, 'utf8'),
      readFile(editorUrl, 'utf8'),
      readFile(contractsUrl, 'utf8'),
      readFile(stylesUrl, 'utf8'),
    ]);

    expect(contracts).toContain('getScreenshotDisplayFrame');
    expect(contracts).toContain('displayImageDataUrl: string;');
    expect(main).toContain('IPC_CHANNELS.getScreenshotDisplayFrame');
    expect(overlay).toContain('.getScreenshotDisplayFrame()');
    expect(overlay).toContain('className="screenshot-frozen-frame"');
    expect(editor).toContain('src={plan.displayImageDataUrl}');
    expect(editor).toContain('createSelectionMaskRects');
    expect(editor).toContain('screenshot-canvas-frozen');
    expect(styles).toMatch(/\.selection-mask,\s*\.screenshot-editor-mask\s*\{/);
    expect(styles).toMatch(/\.selection-box,\s*\.screenshot-canvas-wrap\s*\{/);
    expect(styles).toMatch(/\.screenshot-canvas-frozen canvas\s*\{[^}]*opacity:\s*0;/s);
    expect(styles).not.toMatch(/\.screenshot-canvas-wrap\s*\{[^}]*box-shadow:[^}]*9999px/s);
  });
});
