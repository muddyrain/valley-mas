import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const editorUrl = new URL('../ScreenshotEditor.tsx', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);
const mainUrl = new URL('../../electron/main.ts', import.meta.url);

describe('screenshot selection resize handles', () => {
  it('renders eight pointer-operable handles and accepts resized selections', async () => {
    const [editor, styles, main] = await Promise.all([
      readFile(editorUrl, 'utf8'),
      readFile(stylesUrl, 'utf8'),
      readFile(mainUrl, 'utf8'),
    ]);

    expect(editor).toMatch(
      /const SCREENSHOT_SELECTION_HANDLES: SelectionHandle\[\] = \[[^\]]{20,}\]/s,
    );
    expect(editor).toContain('data-screenshot-selection-handle={handle}');
    expect(editor).toContain('onPointerMove={updateSelectionAdjustment}');
    expect(editor).toContain('onPointerUp={(event) => void finishSelectionAdjustment(event)}');
    expect(editor).toMatch(
      /data-screenshot-selection-handle=\{handle\}[\s\S]*?onPointerDown=\{\(event\) => beginSelectionAdjustment\(event, handle\)\}[\s\S]*?\/>/,
    );
    expect(styles).toMatch(/\.screenshot-selection-handle\s*\{[^}]*pointer-events:\s*auto;/s);
    expect(editor).toContain('src={plan.displayImageDataUrl}');
    expect(styles).toMatch(/\.screenshot-selection-moving\s+canvas\s*\{[^}]*opacity:\s*0;/s);
    expect(main).not.toMatch(
      /selection\.local\.width !== screenshotEditPlan\.selection\.width[\s\S]+selection\.local\.height !== screenshotEditPlan\.selection\.height/,
    );
  });
});
