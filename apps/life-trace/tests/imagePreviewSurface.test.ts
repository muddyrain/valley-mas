import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const imagePreviewSource = readFileSync(
  resolve(__dirname, '../src/components/ImagePreview.tsx'),
  'utf8',
);
const pantryDetailSource = readFileSync(
  resolve(__dirname, '../src/pages/PantryItemDetailPage.tsx'),
  'utf8',
);
const tracesSource = readFileSync(resolve(__dirname, '../src/pages/TracesPage.tsx'), 'utf8');
const plansSource = readFileSync(resolve(__dirname, '../src/pages/PlansPage.tsx'), 'utf8');
const appImageUploaderSource = readFileSync(
  resolve(__dirname, '../src/components/AppImageUploader.tsx'),
  'utf8',
);

describe('image preview surface', () => {
  it('provides a shared mobile image preview dialog', () => {
    expect(imagePreviewSource).toContain('export function ImagePreview');
    expect(imagePreviewSource).toContain('createPortal');
    expect(imagePreviewSource).toContain("event.key === 'Escape'");
    expect(imagePreviewSource).toContain('cursor-zoom-in');
    expect(imagePreviewSource).toContain('关闭图片预览');
  });

  it('uses the shared preview from pantry, trace, plan and upload surfaces', () => {
    expect(pantryDetailSource).toContain('<ImagePreview');
    expect(tracesSource).toContain('<ImagePreview');
    expect(plansSource).toContain('<ImagePreview');
    expect(appImageUploaderSource).toContain('<ImagePreview');
  });
});
