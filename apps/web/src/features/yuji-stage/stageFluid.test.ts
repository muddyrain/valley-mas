import { describe, expect, it } from 'vitest';
import { resolveFluidPassEnabled, resolveFluidSimulationSize } from './stageFluid';

describe('stageFluid', () => {
  it('keeps the simulation short edge at 160 while matching the viewport aspect ratio', () => {
    expect(resolveFluidSimulationSize(1_512, 740)).toEqual({ height: 160, width: 327 });
    expect(resolveFluidSimulationSize(740, 1_512)).toEqual({ height: 327, width: 160 });
    expect(resolveFluidSimulationSize(0, 0)).toEqual({ height: 160, width: 160 });
  });

  it('runs the full-frame fluid pass only while the home hero is active', () => {
    expect(resolveFluidPassEnabled('home', 1, 0)).toBe(true);
    expect(resolveFluidPassEnabled('home', 0.01, 0.89)).toBe(true);
    expect(resolveFluidPassEnabled('home', 0, 0)).toBe(false);
    expect(resolveFluidPassEnabled('home', 1, 0.9)).toBe(false);
    expect(resolveFluidPassEnabled('articles', 1, 0)).toBe(false);
  });
});
