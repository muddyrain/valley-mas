import { AgentState, type Building } from '@/shared/gameTypes';
import type { WorldViewLevel } from './strategicView';

export interface BuildingFeedback {
  kind: 'construction' | 'damaged' | 'destroyed';
  ratio: number;
  color: string;
  showScaffold: boolean;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildingFeedback(building: Building): BuildingFeedback | null {
  if (building.health <= 0) {
    return {
      kind: 'destroyed',
      ratio: 0,
      color: '#9e4f43',
      showScaffold: false,
    };
  }
  if (!building.completed) {
    return {
      kind: 'construction',
      ratio: clampRatio(building.progress / Math.max(1, building.requiredProgress)),
      color: '#efbd58',
      showScaffold: true,
    };
  }
  if (building.health < 100) {
    return {
      kind: 'damaged',
      ratio: clampRatio(building.health / 100),
      color: '#e56852',
      showScaffold: false,
    };
  }
  return null;
}

export function feedbackPresentation(viewLevel: WorldViewLevel): {
  settlementLabels: boolean;
  buildingStatus: boolean;
  attackHits: boolean;
} {
  return {
    settlementLabels: viewLevel !== 'resident',
    buildingStatus: viewLevel !== 'world',
    attackHits: viewLevel !== 'world',
  };
}

export function shouldEmitAttackHit(
  state: AgentState,
  tick: number,
  lastTick: number,
  viewLevel: WorldViewLevel,
): boolean {
  return (
    feedbackPresentation(viewLevel).attackHits &&
    state === AgentState.Attack &&
    tick - lastTick >= 6
  );
}
