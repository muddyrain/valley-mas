import type { BuildingId, ReservationId, ResourceId, SettlementId, TaskId } from '../kernel/ids';

export type HumanTaskKind =
  | 'establish-settlement'
  | 'join-settlement'
  | 'idle-wander'
  | 'forage-food'
  | 'eat'
  | 'rest'
  | 'gather-resource'
  | 'deliver-resource'
  | 'build';

export type HumanTaskPhase =
  | 'moving-to-target'
  | 'working'
  | 'carrying'
  | 'moving-to-delivery'
  | 'consuming'
  | 'resting';

export type HumanTaskFailureCode =
  | 'target-disappeared'
  | 'target-unreachable'
  | 'resource-unavailable'
  | 'reservation-expired'
  | 'system-error';

export interface HumanTaskFact {
  id: TaskId;
  kind: HumanTaskKind;
  phase: HumanTaskPhase;
  targetCell: number;
  targetResourceId: ResourceId | null;
  targetBuildingId: BuildingId | null;
  settlementId: SettlementId | null;
  resourceKind: 'food' | 'wood' | 'stone' | 'metal' | null;
  reservationIds: ReservationId[];
  expectedResult:
    | 'primitive-camp'
    | 'settlement-membership'
    | 'local-activity-completed'
    | 'food-consumed'
    | 'resource-delivered'
    | 'building-completed'
    | 'body-rested';
  startedAtTick: number;
  commitUntilTick: number;
  workRemaining: number;
  pathCells: number[];
  pathCursor: number;
  pathWorldRevision: number | null;
}

export interface HumanTaskFailureFact {
  code: HumanTaskFailureCode;
  atTick: number;
  retryAfterTick: number;
  targetCell: number | null;
}
