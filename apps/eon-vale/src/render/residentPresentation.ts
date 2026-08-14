import { AgentState, CarriedResourceKind } from '@/shared/gameTypes';

export function usesTravelPose(state: AgentState): boolean {
  return (
    state === AgentState.Wander ||
    state === AgentState.FindFood ||
    state === AgentState.GatherWood ||
    state === AgentState.GatherStone ||
    state === AgentState.Farm ||
    state === AgentState.Haul ||
    state === AgentState.Build ||
    state === AgentState.Craft ||
    state === AgentState.Chase ||
    state === AgentState.Hunt ||
    state === AgentState.Fish ||
    state === AgentState.Flee ||
    state === AgentState.Home
  );
}

export function usesWorkPose(state: AgentState): boolean {
  return (
    state === AgentState.GatherWood ||
    state === AgentState.GatherStone ||
    state === AgentState.Build ||
    state === AgentState.Farm ||
    state === AgentState.Craft ||
    state === AgentState.Butcher
  );
}

export function carriedResourceColor(kind: CarriedResourceKind): string {
  return {
    [CarriedResourceKind.None]: '#000000',
    [CarriedResourceKind.Wood]: '#8b623c',
    [CarriedResourceKind.Stone]: '#89918c',
    [CarriedResourceKind.Metal]: '#637a86',
    [CarriedResourceKind.Food]: '#d2b64b',
    [CarriedResourceKind.Tools]: '#aab3b1',
    [CarriedResourceKind.Equipment]: '#d4dadd',
    [CarriedResourceKind.CraftInputs]: '#b7875f',
  }[kind];
}
