export type PublicTransitionPhase = 'idle' | 'closing' | 'navigating' | 'opening';

export interface PublicTransitionState {
  coverId: string | null;
  href: string | null;
  phase: PublicTransitionPhase;
  scrollY: number;
  sourceUrl: string | null;
}

export type PublicTransitionAction =
  | {
      coverId: string;
      href: string;
      scrollY: number;
      sourceUrl: string;
      type: 'START';
    }
  | { type: 'CLOSED' }
  | { type: 'NAVIGATED' }
  | { type: 'REVEAL' }
  | { type: 'OPENED' }
  | { type: 'RESET' };

export function createIdleTransition(): PublicTransitionState {
  return { coverId: null, href: null, phase: 'idle', scrollY: 0, sourceUrl: null };
}

export function reducePublicTransition(
  state: PublicTransitionState,
  action: PublicTransitionAction,
): PublicTransitionState {
  switch (action.type) {
    case 'START':
      return {
        coverId: action.coverId,
        href: action.href,
        phase: 'closing',
        scrollY: action.scrollY,
        sourceUrl: action.sourceUrl,
      };
    case 'CLOSED':
      return state.phase === 'closing' ? { ...state, phase: 'navigating' } : state;
    case 'NAVIGATED':
      return state.phase === 'navigating' ? { ...state, phase: 'opening' } : state;
    case 'REVEAL':
      return { ...state, phase: 'opening' };
    case 'OPENED':
    case 'RESET':
      return createIdleTransition();
  }
}

export function resolveTransitionDuration(reducedMotion: boolean, kind: 'route' | 'intro') {
  if (reducedMotion) return 0;
  return kind === 'route' ? 560 : 360;
}
