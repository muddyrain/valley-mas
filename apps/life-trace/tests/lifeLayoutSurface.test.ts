import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

const lifeLayoutSource = source('src/components/LifeLayout.tsx');
const softDiarySource = source('src/components/SoftDiary.tsx');
const subPageShellSource = source('src/components/SubPageShell.tsx');
const todaySource = source('src/pages/TodayPage.tsx');
const profileSource = source('src/pages/ProfilePage.tsx');
const aiSource = source('src/pages/AiPage.tsx');
const plansSource = source('src/pages/PlansPage.tsx');
const pantrySource = source('src/pages/PantryPage.tsx');
const shoppingSource = source('src/pages/ShoppingListPage.tsx');

describe('Life Trace layout system surface', () => {
  it('defines the shared app page, card, section, list, and filter primitives', () => {
    expect(lifeLayoutSource).toContain('export const LifePage');
    expect(lifeLayoutSource).toContain('export function LifeCard');
    expect(lifeLayoutSource).toContain('export function LifeSection');
    expect(lifeLayoutSource).toContain('export function LifeList');
    expect(lifeLayoutSource).toContain('export function LifeFilterBar');
  });

  it('keeps the default tab page spacing comfortable and consistent', () => {
    expect(lifeLayoutSource).toContain("tab: 'px-5 pt-4 max-[360px]:px-4'");
    expect(lifeLayoutSource).toContain("default: 'space-y-5'");
    expect(lifeLayoutSource).toContain("default: 'p-4'");
  });

  it('routes legacy soft pages and subpages through the shared page primitive', () => {
    expect(softDiarySource).toContain('<LifePage');
    expect(softDiarySource).toContain('variant="tab"');
    expect(subPageShellSource).toContain('<LifePage');
    expect(subPageShellSource).toContain('variant="sub"');
  });

  it('uses the shared page primitive on the high-frequency tab surfaces', () => {
    expect(todaySource).toContain('<LifePage');
    expect(profileSource).toContain('<LifePage');
    expect(aiSource).toContain('variant="immersive"');
    expect(plansSource).toContain('<SoftPage ref={pageRef} className="pb-32">');
  });

  it('uses shared list and filter wrappers on dense utility pages', () => {
    expect(plansSource).toContain('<LifeFilterBar');
    expect(plansSource).toContain('<LifeList>');
    expect(pantrySource).toContain('<LifeFilterBar');
    expect(pantrySource).toContain('<LifeList');
    expect(shoppingSource).toContain('<LifeList>');
  });

  it('does not reintroduce the old drifting page spacing overrides', () => {
    const combined = [
      todaySource,
      profileSource,
      aiSource,
      shoppingSource,
      subPageShellSource,
    ].join('\n');

    expect(combined).not.toContain('px-5 pt-7');
    expect(combined).not.toContain('space-y-6 px-5 pt-4');
    expect(combined).not.toContain('contentClassName="space-y-6"');
    expect(combined).not.toContain('mx-auto flex w-full max-w-3xl flex-col gap-4 px-4');
  });
});
