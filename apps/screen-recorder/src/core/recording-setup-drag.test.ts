import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const componentUrl = new URL('../RecordingSetup.tsx', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

describe('recording setup drag handle', () => {
  it('exposes a dedicated Electron drag region without making the controls draggable', async () => {
    const [component, styles] = await Promise.all([
      readFile(componentUrl, 'utf8'),
      readFile(stylesUrl, 'utf8'),
    ]);

    expect(component).toContain('recording-setup-drag-handle');
    expect(styles).toMatch(/\.recording-setup-drag-handle\s*\{[^}]*-webkit-app-region:\s*drag;/s);
  });
});
