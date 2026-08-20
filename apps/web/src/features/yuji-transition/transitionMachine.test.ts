import { describe, expect, it } from 'vitest';
import {
  createIdleTransition,
  reducePublicTransition,
  resolveTransitionDuration,
} from './transitionMachine';

describe('public transition machine', () => {
  it('closes the source, navigates once, then opens the destination', () => {
    const source = createIdleTransition();
    const closing = reducePublicTransition(source, {
      coverId: 'post-1',
      href: '/articles/post-1',
      scrollY: 720,
      sourceUrl: '/articles?groupId=react',
      type: 'START',
    });
    expect(closing.phase).toBe('closing');

    const navigating = reducePublicTransition(closing, { type: 'CLOSED' });
    expect(navigating.phase).toBe('navigating');
    expect(navigating.href).toBe('/articles/post-1');

    expect(reducePublicTransition(navigating, { type: 'NAVIGATED' }).phase).toBe('opening');
  });

  it('keeps source URL and scroll position for a reverse transition', () => {
    const closing = reducePublicTransition(createIdleTransition(), {
      coverId: 'post-7',
      href: '/articles/post-7',
      scrollY: 1440,
      sourceUrl: '/articles',
      type: 'START',
    });

    expect(closing.sourceUrl).toBe('/articles');
    expect(closing.scrollY).toBe(1440);
  });

  it('makes reduced-motion navigation immediate', () => {
    expect(resolveTransitionDuration(true, 'route')).toBe(0);
    expect(resolveTransitionDuration(false, 'route')).toBeGreaterThan(0);
  });
});
