import type { NpcId } from './npc';

export type ResidentRelationLabel = '面熟' | '熟人' | '老朋友';

export interface ResidentRelation {
  residents: readonly [NpcId, NpcId];
  familiarity: number;
  collaborations: number;
  collaborationIds: readonly string[];
  label: ResidentRelationLabel;
}

export interface ResidentRelationsState {
  relations: Readonly<Record<string, ResidentRelation>>;
}

export interface ResidentCollaboration {
  residentId: NpcId;
  partnerId: NpcId;
  collaborationId: string;
}

const getRelationKey = (left: NpcId, right: NpcId): string => [left, right].sort().join(':');

const getRelationResidents = (left: NpcId, right: NpcId): [NpcId, NpcId] =>
  [left, right].sort() as [NpcId, NpcId];

const getRelationLabel = (familiarity: number): ResidentRelationLabel =>
  familiarity >= 4 ? '老朋友' : familiarity >= 2 ? '熟人' : '面熟';

export function createResidentRelations(): ResidentRelationsState {
  return { relations: {} };
}

export function recordResidentCollaboration(
  state: Readonly<ResidentRelationsState>,
  collaboration: Readonly<ResidentCollaboration>,
): ResidentRelationsState {
  if (
    collaboration.residentId === collaboration.partnerId ||
    collaboration.collaborationId.trim().length === 0
  ) {
    return state;
  }
  const key = getRelationKey(collaboration.residentId, collaboration.partnerId);
  const current = state.relations[key];
  if (current?.collaborationIds.includes(collaboration.collaborationId)) return state;
  const familiarity = Math.min(5, (current?.familiarity ?? 0) + 1);
  const next: ResidentRelation = {
    residents:
      current?.residents ?? getRelationResidents(collaboration.residentId, collaboration.partnerId),
    familiarity,
    collaborations: (current?.collaborations ?? 0) + 1,
    collaborationIds: [...(current?.collaborationIds ?? []), collaboration.collaborationId],
    label: getRelationLabel(familiarity),
  };
  return {
    relations: {
      ...state.relations,
      [key]: next,
    },
  };
}

export function getResidentRelation(
  state: Readonly<ResidentRelationsState>,
  left: NpcId,
  right: NpcId,
): ResidentRelation | null {
  if (left === right) return null;
  return state.relations[getRelationKey(left, right)] ?? null;
}

export function getResidentRelations(
  state: Readonly<ResidentRelationsState>,
): readonly ResidentRelation[] {
  return Object.values(state.relations);
}
