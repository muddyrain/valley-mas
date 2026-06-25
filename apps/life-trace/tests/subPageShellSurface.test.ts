import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canNavigateBackFromState } from '../src/components/SubPageShell';

const componentSource = readFileSync(
  resolve(__dirname, '../src/components/SubPageShell.tsx'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

const pagesDir = resolve(__dirname, '../src/pages');
const pageFiles = [
  'LedgerPage.tsx',
  'InboxPage.tsx',
  'RecurringPaymentsPage.tsx',
  'PantryPage.tsx',
  'PlacesPage.tsx',
  'MediaDiaryPage.tsx',
  'ShoppingListPage.tsx',
  'AchievementsPage.tsx',
  'ReminderSettingsPage.tsx',
  'AiPage.tsx',
  'PhotoItemAnalysisPage.tsx',
  'PhotoClothingAnalysisPage.tsx',
  'PantryItemDetailPage.tsx',
  'ClosetPage.tsx',
  'PlansPage.tsx',
  'TracesPage.tsx',
];

function readPage(name: string) {
  const path = resolve(pagesDir, name);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('canNavigateBackFromState', () => {
  it('allows history back only when the router history index is positive', () => {
    expect(canNavigateBackFromState({ idx: 2 })).toBe(true);
    expect(canNavigateBackFromState({ idx: 0 })).toBe(false);
    expect(canNavigateBackFromState(null)).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(canNavigateBackFromState(undefined)).toBe(false);
    expect(canNavigateBackFromState(42)).toBe(false);
    expect(canNavigateBackFromState('string')).toBe(false);
  });

  it('rejects objects with non-numeric idx', () => {
    expect(canNavigateBackFromState({ idx: '2' })).toBe(false);
    expect(canNavigateBackFromState({})).toBe(false);
  });
});

describe('SubPageShell component source', () => {
  it('uses ArrowLeft for the back button', () => {
    expect(componentSource).toContain('ArrowLeft');
  });

  it('renders a sticky header with backdrop blur', () => {
    expect(componentSource).toContain('sticky top-0');
    expect(componentSource).toContain('backdrop-blur-xl');
  });

  it('renders title in an h1 tag', () => {
    expect(componentSource).toContain('<h1');
    expect(componentSource).toContain('{title}');
  });

  it('conditionally renders eyebrow', () => {
    expect(componentSource).toContain('{eyebrow ?');
    expect(componentSource).toContain('eyebrow');
  });

  it('provides a reserved slot for action', () => {
    expect(componentSource).toContain('{action}');
  });

  it('includes GSAP page enter animation', () => {
    expect(componentSource).toContain('useGSAP');
    expect(componentSource).toContain('gsap.fromTo');
  });

  it('respects prefers-reduced-motion', () => {
    expect(componentSource).toContain('prefers-reduced-motion');
  });
});

describe('SubPageShell handleBack priority chain', () => {
  it('checks onBack first', () => {
    const handlerStart = componentSource.indexOf('const handleBack');
    const onBackCheck = componentSource.indexOf('if (onBack)', handlerStart);
    expect(onBackCheck).toBeGreaterThan(handlerStart);
  });

  it('checks backTo before canNavigateBackFromState', () => {
    const handlerStart = componentSource.indexOf('const handleBack');
    const backToCheck = componentSource.indexOf('if (backTo)', handlerStart);
    const historyCheck = componentSource.indexOf('canNavigateBackFromState', handlerStart);
    expect(backToCheck).toBeGreaterThan(handlerStart);
    expect(historyCheck).toBeGreaterThan(backToCheck);
  });

  it('checks fallbackBackTo last', () => {
    const handlerStart = componentSource.indexOf('const handleBack');
    const fallbackCheck = componentSource.indexOf('if (fallbackBackTo)', handlerStart);
    const lastNavigate = componentSource.lastIndexOf('navigate(-1)');
    expect(fallbackCheck).toBeGreaterThan(handlerStart);
    expect(lastNavigate).toBeGreaterThan(fallbackCheck);
  });
});

describe('SubPageShell usage across pages', () => {
  it.each(pageFiles)('%s uses SubPageShell', (name) => {
    const source = readPage(name);
    expect(source).toContain("import { SubPageShell } from '@/components/SubPageShell'");
    expect(source).toContain('<SubPageShell');
  });

  it('all SubPageShell usages provide a title prop', () => {
    for (const name of pageFiles) {
      const source = readPage(name);
      // Match <SubPageShell ... > across multiple lines
      const matches = source.match(/<SubPageShell[\s\S]*?>/g) || [];
      for (const match of matches) {
        // title can be string literal title="..." or JSX expression title={...}
        const hasTitle = match.includes('title="') || match.includes('title={');
        expect(hasTitle).toBe(true);
      }
    }
  });

  it('uses backTo, fallbackBackTo, or onBack for navigation', () => {
    for (const name of pageFiles) {
      const source = readPage(name);
      const matches = source.match(/<SubPageShell[\s\S]*?>/g) || [];
      for (const match of matches) {
        const hasBack =
          match.includes('backTo=') ||
          match.includes('fallbackBackTo=') ||
          match.includes('onBack=');
        expect(hasBack).toBe(true);
      }
    }
  });

  it('App.tsx registers all routes used by SubPageShell pages', () => {
    // Routes may include dynamic segments like /places/:placeId?
    const expectedRoutePrefixes = [
      '/ledger',
      '/inbox',
      '/recurring-payments',
      '/pantry',
      '/places',
      '/media-diary',
      '/shopping',
      '/achievements',
      '/profile/reminders',
      '/ai',
      '/closet',
      '/plans',
      '/traces',
    ];
    for (const route of expectedRoutePrefixes) {
      expect(appSource).toContain(`path="${route}`);
    }
  });
});
