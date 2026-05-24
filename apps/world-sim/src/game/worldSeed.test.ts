import { describe, expect, it } from 'vitest';
import { createDemoWorldSeed, resolveDemoWorldSeed } from './worldSeed';

describe('demo world seed resolution', () => {
  it('uses the URL seed so a world can be reproduced', () => {
    expect(resolveDemoWorldSeed('?seed=frontier-test')).toBe('frontier-test');
    expect(resolveDemoWorldSeed('?speed=2&seed=river%20town')).toBe('river town');
  });

  it('generates a fresh seed when the URL has no seed', () => {
    const first = createDemoWorldSeed({ now: () => 1000, random: () => 0.1 });
    const second = createDemoWorldSeed({ now: () => 1001, random: () => 0.2 });

    expect(first).toMatch(/^worldsim-/);
    expect(second).toMatch(/^worldsim-/);
    expect(second).not.toBe(first);
    expect(resolveDemoWorldSeed('', { now: () => 1000, random: () => 0.1 })).toBe(first);
  });
});
