import { describe, expect, it } from 'vitest';
import { canNavigateBackFromState, resolveSubPageBackTarget } from './SubPageShell';

describe('canNavigateBackFromState', () => {
  it('allows history back only when the router history index is positive', () => {
    expect(canNavigateBackFromState({ idx: 2 })).toBe(true);
    expect(canNavigateBackFromState({ idx: 0 })).toBe(false);
    expect(canNavigateBackFromState(null)).toBe(false);
  });
});

describe('resolveSubPageBackTarget', () => {
  it('keeps custom back handlers first', () => {
    expect(
      resolveSubPageBackTarget({
        backTo: '/plans',
        fallbackBackTo: '/today',
        hasOnBack: true,
        historyState: { idx: 2 },
      }),
    ).toEqual({ type: 'custom' });
  });

  it('uses browser history before static back paths', () => {
    expect(
      resolveSubPageBackTarget({
        backTo: '/plans',
        fallbackBackTo: '/today',
        hasOnBack: false,
        historyState: { idx: 2 },
      }),
    ).toEqual({ type: 'history' });
  });

  it('falls back to configured paths for directly opened subpages', () => {
    expect(
      resolveSubPageBackTarget({
        backTo: '/plans',
        fallbackBackTo: '/today',
        hasOnBack: false,
        historyState: { idx: 0 },
      }),
    ).toEqual({ type: 'path', path: '/plans' });

    expect(
      resolveSubPageBackTarget({
        fallbackBackTo: '/today',
        hasOnBack: false,
        historyState: { idx: 0 },
      }),
    ).toEqual({ type: 'path', path: '/today' });
  });
});
