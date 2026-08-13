import { describe, expect, it } from 'vitest';
import { AgentState, CarriedResourceKind } from '@/shared/gameTypes';
import { carriedResourceColor, usesTravelPose, usesWorkPose } from './residentPresentation';

describe('resident visual presentation', () => {
  it('uses travel motion for every real trip instead of only idle wandering', () => {
    expect(usesTravelPose(AgentState.FindFood)).toBe(true);
    expect(usesTravelPose(AgentState.GatherWood)).toBe(true);
    expect(usesTravelPose(AgentState.Haul)).toBe(true);
    expect(usesTravelPose(AgentState.Home)).toBe(true);
    expect(usesTravelPose(AgentState.Idle)).toBe(false);
  });

  it('uses a work motion for the full second-batch work sample', () => {
    for (const state of [
      AgentState.GatherWood,
      AgentState.GatherStone,
      AgentState.Farm,
      AgentState.Build,
      AgentState.Craft,
    ]) {
      expect(usesWorkPose(state)).toBe(true);
    }
  });

  it('gives carried food, materials, tools and equipment distinct readable colors', () => {
    const colors = [
      CarriedResourceKind.Wood,
      CarriedResourceKind.Stone,
      CarriedResourceKind.Metal,
      CarriedResourceKind.Food,
      CarriedResourceKind.Tools,
      CarriedResourceKind.Equipment,
      CarriedResourceKind.CraftInputs,
    ].map(carriedResourceColor);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
