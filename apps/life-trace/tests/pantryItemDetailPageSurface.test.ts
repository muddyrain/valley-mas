import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
const pantryPageSource = readFileSync(resolve(__dirname, '../src/pages/PantryPage.tsx'), 'utf8');
const detailPageSource = readFileSync(
  resolve(__dirname, '../src/pages/PantryItemDetailPage.tsx'),
  'utf8',
);
const pantryApiSource = readFileSync(resolve(__dirname, '../src/api/pantry.ts'), 'utf8');

describe('pantry item detail surface', () => {
  it('registers the pantry detail route and opens it from list cards', () => {
    expect(appSource).toContain('path="/pantry/:itemId"');
    expect(appSource).toContain('<PantryItemDetailPage />');
    expect(pantryPageSource).toMatch(/navigate\(`\/pantry\/\$\{item\.id\}`, \{/);
    expect(pantryPageSource).toMatch(
      /pantryListFrom: `\$\{location\.pathname\}\$\{location\.search\}`/,
    );
  });

  it('loads pantry detail and timeline from dedicated endpoints', () => {
    expect(pantryApiSource).toContain('getPantryItem');
    expect(pantryApiSource).toContain('getPantryItemTimeline');
    expect(detailPageSource).toContain('getPantryItem(token, itemId)');
    expect(detailPageSource).toContain('getPantryItemTimeline(token, itemId)');
    expect(detailPageSource).toContain('操作时间线');
  });

  it('keeps quick actions on server-backed pantry operations', () => {
    expect(detailPageSource).toContain("runConsumeAction('used', 1, 'use-one')");
    expect(detailPageSource).toContain("runConsumeAction('discarded', item.quantity, 'discard')");
    expect(detailPageSource).toContain('PantryItemDrawer');
    expect(detailPageSource).toContain('PantryTransferSheet');
  });
});
