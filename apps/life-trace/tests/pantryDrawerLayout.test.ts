import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pantryDrawerSource = readFileSync(
  resolve(__dirname, '../src/components/PantryItemDrawer.tsx'),
  'utf8',
);
const bottomSheetSource = readFileSync(
  resolve(__dirname, '../src/components/BottomSheet.tsx'),
  'utf8',
);
const photoItemAnalysisSource = readFileSync(
  resolve(__dirname, '../src/pages/PhotoItemAnalysisPage.tsx'),
  'utf8',
);

describe('pantry drawer mobile layout guards', () => {
  it('clips sheet content horizontally instead of exposing a horizontal scrollbar', () => {
    expect(bottomSheetSource).toContain('overflow-x-hidden');
  });

  it('allows pantry form grids and date fields to shrink inside the bottom sheet', () => {
    expect(pantryDrawerSource).toContain('form className="min-w-0 space-y-4"');
    expect(pantryDrawerSource).toContain('className="grid min-w-0 grid-cols-2');
    expect(pantryDrawerSource).toContain('className="h-11 min-w-0 w-full');
    expect(pantryDrawerSource).toContain(
      'className="block min-w-0 max-w-full overflow-hidden rounded-2xl"',
    );
    expect(pantryDrawerSource).toContain('type="date"');
    expect(pantryDrawerSource).toContain('appearance-none');
  });

  it('keeps the photo review card in normal document flow while the sheet scrolls', () => {
    expect(photoItemAnalysisSource).toContain('当前编辑图片');
    expect(photoItemAnalysisSource).not.toContain('sticky top-0');
  });
});
