import {
  AgentState,
  EntityKind,
  type GroupActivityDiagnostics,
  type ResidentActivityCategory,
  type WorldState,
} from '@/shared/gameTypes';
import { GROUP_ACTIVITY_RULES } from '../rules/stabilityRules';

export interface GroupActivityScope {
  villageId?: number;
  kingdomId?: number;
}

function classifyResident(state: WorldState, entityId: number): ResidentActivityCategory {
  const task = state.entities.tasks[entityId] ?? state.entities.suspendedTasks[entityId];
  if (task?.phase === 'failed' || task?.phase === 'suspended') return 'blocked';
  if ((state.entities.expeditionIds[entityId] ?? 0) > 0) return 'migration';
  const agentState = state.entities.states[entityId] as AgentState;
  if (
    agentState === AgentState.FindFood ||
    agentState === AgentState.Eat ||
    agentState === AgentState.Rest ||
    agentState === AgentState.Flee
  ) {
    return 'survival';
  }
  if (
    agentState === AgentState.Guard ||
    agentState === AgentState.Chase ||
    agentState === AgentState.Attack
  ) {
    return 'military';
  }
  if (agentState === AgentState.Haul || agentState === AgentState.Home) return 'logistics';
  if (
    agentState === AgentState.GatherWood ||
    agentState === AgentState.GatherStone ||
    agentState === AgentState.Farm ||
    agentState === AgentState.Build ||
    agentState === AgentState.Repair ||
    agentState === AgentState.Craft ||
    agentState === AgentState.Hunt ||
    agentState === AgentState.Butcher ||
    agentState === AgentState.Fish
  ) {
    return 'production';
  }
  return 'idle';
}

function residentReason(
  state: WorldState,
  entityId: number,
  category: ResidentActivityCategory,
): string {
  const task = state.entities.tasks[entityId] ?? state.entities.suspendedTasks[entityId];
  if (category === 'blocked')
    return task?.failureReason || task?.suspensionReason || task?.phase || 'blocked';
  if ((state.entities.hunger[entityId] ?? 0) >= GROUP_ACTIVITY_RULES.criticalHungerAlertThreshold) {
    return 'critical-hunger';
  }
  if (task?.reason && task.reason !== 'none') return task.reason;
  if (category === 'migration') return 'expedition';
  return category;
}

export function deriveGroupActivity(
  state: WorldState,
  scope: GroupActivityScope,
): GroupActivityDiagnostics {
  const entityIds: number[] = [];
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      state.entities.active[entityId] !== 1 ||
      state.entities.health[entityId] === 0 ||
      state.entities.kind[entityId] !== EntityKind.Human
    ) {
      continue;
    }
    if (scope.villageId !== undefined && state.entities.villageIds[entityId] !== scope.villageId) {
      continue;
    }
    if (scope.kingdomId !== undefined && state.entities.kingdomIds[entityId] !== scope.kingdomId) {
      continue;
    }
    entityIds.push(entityId);
  }

  const categories = GROUP_ACTIVITY_RULES.categories.map((category) => {
    const members = entityIds.filter((entityId) => classifyResident(state, entityId) === category);
    const reasonGroups = new Map<string, number[]>();
    for (const entityId of members) {
      const reason = residentReason(state, entityId, category);
      const group = reasonGroups.get(reason) ?? [];
      group.push(entityId);
      reasonGroups.set(reason, group);
    }
    return {
      category,
      count: members.length,
      entityIds: members,
      reasons: [...reasonGroups.entries()]
        .map(([reason, ids]) => ({ reason, count: ids.length, entityIds: ids }))
        .sort(
          (first, second) =>
            second.count - first.count || first.reason.localeCompare(second.reason),
        ),
    };
  });

  const alerts = categories
    .flatMap(({ category, reasons }) => reasons.map((reason) => ({ ...reason, category })))
    .filter(({ reason, count, category, entityIds: alertEntityIds }) => {
      if (count < GROUP_ACTIVITY_RULES.alertMinimumResidents) return false;
      if (reason === 'critical-hunger') {
        return alertEntityIds.some((entityId) => {
          const task = state.entities.tasks[entityId] ?? state.entities.suspendedTasks[entityId];
          return (
            task !== null &&
            task !== undefined &&
            state.tick - task.startedAtTick >= GROUP_ACTIVITY_RULES.failedTaskAlertTicks
          );
        });
      }
      if (category !== 'blocked') return false;
      return alertEntityIds.some((entityId) => {
        const task = state.entities.tasks[entityId] ?? state.entities.suspendedTasks[entityId];
        const since = task?.finishedAtTick || task?.startedAtTick || state.tick;
        return state.tick - since >= GROUP_ACTIVITY_RULES.failedTaskAlertTicks;
      });
    })
    .map(({ reason, count, entityIds: alertEntityIds }) => {
      const villageId = scope.villageId ?? state.entities.villageIds[alertEntityIds[0] ?? 0] ?? 0;
      const village = state.villages.find((candidate) => candidate.id === villageId);
      return {
        reason,
        count,
        entityIds: alertEntityIds,
        villageId,
        x: village?.x ?? state.entities.positionsX[alertEntityIds[0] ?? 0] ?? 0,
        z: village?.z ?? state.entities.positionsZ[alertEntityIds[0] ?? 0] ?? 0,
      };
    });

  return { total: entityIds.length, categories, alerts };
}
