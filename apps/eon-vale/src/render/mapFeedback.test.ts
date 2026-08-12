import { describe, expect, it } from 'vitest';
import { AgentState, type Building, BuildingType } from '@/shared/gameTypes';
import { buildingFeedback, feedbackPresentation, shouldEmitAttackHit } from './mapFeedback';

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: 1,
    villageId: 1,
    type: BuildingType.Home,
    x: 10,
    z: 10,
    stage: 2,
    progress: 100,
    requiredProgress: 100,
    health: 100,
    completed: true,
    constructionPhase: 'complete',
    reservedWood: 0,
    reservedStone: 0,
    deliveredWood: 0,
    deliveredStone: 0,
    inTransitWood: 0,
    inTransitStone: 0,
    clearNodeIds: [],
    ...overrides,
  };
}

describe('buildingFeedback', () => {
  it('uses construction progress and scaffolding for unfinished buildings', () => {
    expect(
      buildingFeedback(
        building({ completed: false, stage: 1, progress: 42, requiredProgress: 120 }),
      ),
    ).toEqual({
      kind: 'construction',
      ratio: 0.35,
      color: '#efbd58',
      showScaffold: true,
    });
  });

  it('uses remaining health for damaged and destroyed buildings', () => {
    expect(buildingFeedback(building({ health: 38 }))).toEqual({
      kind: 'damaged',
      ratio: 0.38,
      color: '#e56852',
      showScaffold: false,
    });
    expect(buildingFeedback(building({ health: 0 }))).toEqual({
      kind: 'destroyed',
      ratio: 0,
      color: '#9e4f43',
      showScaffold: false,
    });
  });

  it('does not add a status marker to healthy completed buildings', () => {
    expect(buildingFeedback(building())).toBeNull();
  });
});

describe('map feedback presentation', () => {
  it('keeps settlement names strategic and detailed status close to the action', () => {
    expect(feedbackPresentation('world')).toEqual({
      settlementLabels: true,
      buildingStatus: false,
      attackHits: false,
    });
    expect(feedbackPresentation('settlement')).toEqual({
      settlementLabels: true,
      buildingStatus: true,
      attackHits: true,
    });
    expect(feedbackPresentation('resident')).toEqual({
      settlementLabels: false,
      buildingStatus: true,
      attackHits: true,
    });
  });
});

describe('shouldEmitAttackHit', () => {
  it('emits only real close-view attacks after the per-attacker cooldown', () => {
    expect(shouldEmitAttackHit(AgentState.Attack, 40, 31, 'settlement')).toBe(true);
    expect(shouldEmitAttackHit(AgentState.Attack, 40, 38, 'resident')).toBe(false);
    expect(shouldEmitAttackHit(AgentState.Chase, 40, 0, 'settlement')).toBe(false);
    expect(shouldEmitAttackHit(AgentState.Attack, 40, 0, 'world')).toBe(false);
  });
});
