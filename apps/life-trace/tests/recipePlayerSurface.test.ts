import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/RecipePlayerPage.tsx'), 'utf8');

describe('RecipePlayerPage navigation surface', () => {
  it('uses browser history before falling back to the recipe list', () => {
    expect(source).toContain('canNavigateBackFromState(window.history.state)');
    expect(source).toContain('navigate(-1)');
    expect(source).toContain("navigate('/ai/recipes', { replace: true })");
    expect(source).not.toContain("navigate('/ai', { replace: true })");
  });
});
