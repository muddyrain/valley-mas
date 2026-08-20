import { type BuildingType, ResourceNodeKind, type ResourceNodeStage } from '@/shared/gameTypes';
import {
  buildingInteractionGeometry,
  entityInteractionGeometry,
  type InteractionGeometry,
  resourceInteractionGeometry,
} from './interactionFeedback';
import type { WorldViewLevel } from './strategicView';

export interface PickEntityCandidate {
  id: number;
  x: number;
  z: number;
  active: boolean;
  health: number;
}

export interface PickBuildingCandidate {
  id: number;
  villageId: number;
  type: BuildingType;
  x: number;
  z: number;
  health: number;
}

export interface PickResourceCandidate {
  id: number;
  x: number;
  z: number;
  active: boolean;
  kind: ResourceNodeKind;
  stage: ResourceNodeStage;
  variant: number;
}

export type PickedWorldObject =
  | { kind: 'entity'; id: number }
  | { kind: 'building'; id: number; villageId: number }
  | { kind: 'resource'; id: number };

export interface WorldPickInput {
  viewLevel: WorldViewLevel;
  point: { x: number; z: number };
  entities: readonly PickEntityCandidate[];
  buildings: readonly PickBuildingCandidate[];
  resources: readonly PickResourceCandidate[];
}

interface RankedPick {
  object: PickedWorldObject;
  hitScore: number;
  visualRank: number;
  depth: number;
}

export function resourceIsVisibleAtView(
  viewLevel: WorldViewLevel,
  resource: PickResourceCandidate,
): boolean {
  if (!resource.active || viewLevel === 'world') return false;
  if (viewLevel === 'resident') return true;
  const sampleRate =
    resource.kind === ResourceNodeKind.Tree ? 3 : resource.kind === ResourceNodeKind.Stone ? 2 : 1;
  return (resource.id * 17 + resource.variant * 7) % sampleRate === 0;
}

function ellipseHitScore(
  point: { x: number; z: number },
  candidate: { x: number; z: number },
  geometry: InteractionGeometry,
): number | null {
  const radiusX = Math.max(0.001, geometry.radiusX);
  const radiusZ = Math.max(0.001, geometry.radiusZ);
  const dx = (point.x - candidate.x - geometry.offsetX) / radiusX;
  const dz = (point.z - candidate.z - geometry.offsetZ) / radiusZ;
  const score = dx * dx + dz * dz;
  return score <= 1 ? score : null;
}

export function pickWorldObject(input: WorldPickInput): PickedWorldObject | null {
  if (input.viewLevel === 'world') return null;
  const picks: RankedPick[] = [];
  for (const entity of input.entities) {
    if (!entity.active || entity.health <= 0) continue;
    const hitScore = ellipseHitScore(
      input.point,
      entity,
      entityInteractionGeometry(input.viewLevel),
    );
    if (hitScore === null) continue;
    picks.push({
      object: { kind: 'entity', id: entity.id },
      hitScore,
      visualRank: 3,
      depth: entity.z,
    });
  }
  for (const building of input.buildings) {
    if (building.health <= 0) continue;
    const hitScore = ellipseHitScore(
      input.point,
      building,
      buildingInteractionGeometry(building.type, input.viewLevel),
    );
    if (hitScore === null) continue;
    picks.push({
      object: { kind: 'building', id: building.id, villageId: building.villageId },
      hitScore,
      visualRank: 2,
      depth: building.z,
    });
  }
  for (const resource of input.resources) {
    if (!resourceIsVisibleAtView(input.viewLevel, resource)) continue;
    const hitScore = ellipseHitScore(
      input.point,
      resource,
      resourceInteractionGeometry(resource.kind, resource.stage, input.viewLevel),
    );
    if (hitScore === null) continue;
    const canopyIsInFront =
      input.viewLevel === 'resident' &&
      resource.kind === ResourceNodeKind.Tree &&
      resource.stage >= 3;
    picks.push({
      object: { kind: 'resource', id: resource.id },
      hitScore,
      visualRank: canopyIsInFront ? 4 : 1,
      depth: resource.z,
    });
  }
  picks.sort((left, right) => {
    if (Math.abs(left.hitScore - right.hitScore) > 0.08) {
      return left.hitScore - right.hitScore;
    }
    return (
      right.visualRank - left.visualRank ||
      right.depth - left.depth ||
      left.object.id - right.object.id
    );
  });
  return picks[0]?.object ?? null;
}
