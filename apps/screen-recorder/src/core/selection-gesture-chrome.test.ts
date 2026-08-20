import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const overlayUrl = new URL('../SelectionOverlay.tsx', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

describe('selection gesture chrome', () => {
  it('hides the capture tabs and selection hint synchronously on pointer down', async () => {
    const [overlay, styles] = await Promise.all([
      readFile(overlayUrl, 'utf8'),
      readFile(stylesUrl, 'utf8'),
    ]);

    expect(overlay).toContain('const [gestureActive, setGestureActive] = useState(false);');
    expect(overlay).toMatch(
      /\{!configuring && !gestureActive && \([\s\S]*?className="capture-mode-toolbar"/,
    );
    expect(overlay).toMatch(
      /\{!gestureActive && \([\s\S]*?<div className="selection-help">[\s\S]*?<\/div>[\s\S]*?\)\}/,
    );
    expect(overlay).toMatch(/setGestureActive\(true\);[\s\S]*?setSelectionGestureActive\(true\);/);
    expect(overlay).toMatch(/finally \{[\s\S]*?setGestureActive\(false\);/);
    expect(overlay).toMatch(
      /event\.currentTarget\.classList\.add\('selection-overlay-gesture-active'\);[\s\S]*?beginSelectionGesture/,
    );
    expect(styles).toMatch(
      /\.selection-overlay-gesture-active\s+\.capture-mode-toolbar[\s\S]*?\.selection-overlay-gesture-active\s+\.selection-help[\s\S]*?display:\s*none;/,
    );
  });
});
