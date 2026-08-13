import { describe, expect, it } from 'vitest';
import { AgentState, CarriedResourceKind, EntityKind } from '@/shared/gameTypes';
import { animalPose, animationFrame, humanFacing, humanPose } from './spriteAnimation';

describe('second-batch sprite animation atlas', () => {
  it('maps all four human headings to a stable facing', () => {
    expect(humanFacing(0)).toBe('east');
    expect(humanFacing(Math.PI / 2)).toBe('south');
    expect(humanFacing(Math.PI)).toBe('west');
    expect(humanFacing(-Math.PI / 2)).toBe('north');
  });

  it('uses dedicated work, carrying, eating and sleeping poses', () => {
    expect(humanPose(AgentState.GatherWood, CarriedResourceKind.None)).toBe('chop');
    expect(humanPose(AgentState.GatherStone, CarriedResourceKind.None)).toBe('mine');
    expect(humanPose(AgentState.Home, CarriedResourceKind.Food)).toBe('carry');
    expect(humanPose(AgentState.Eat, CarriedResourceKind.None)).toBe('eat');
    expect(humanPose(AgentState.Rest, CarriedResourceKind.None)).toBe('sleep');
  });

  it('cycles four-frame travel and three-frame animal actions deterministically', () => {
    expect(
      new Set(Array.from({ length: 12 }, (_, tick) => animationFrame('walk', tick, 0))),
    ).toEqual(new Set([0, 1, 2, 3]));
    expect(animalPose(EntityKind.Wolf, AgentState.Attack)).toBe('attack');
    expect(
      new Set(Array.from({ length: 9 }, (_, tick) => animationFrame('attack', tick, 1, true))),
    ).toEqual(new Set([0, 1, 2]));
  });
});
