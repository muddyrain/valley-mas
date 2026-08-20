import { AgentState, CarriedResourceKind, Profession } from '@/shared/gameTypes';

export type ResidentHandItem = 'none' | 'tool' | 'weapon';

export function residentHandItem(profession: Profession, weaponTier: number): ResidentHandItem {
  if (profession === Profession.Guard) return weaponTier > 0 ? 'weapon' : 'none';
  return 'tool';
}

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
    [CarriedResourceKind.FarmFood]: '#d2b64b',
    [CarriedResourceKind.WildFood]: '#8eaf54',
    [CarriedResourceKind.MeatFood]: '#b96755',
    [CarriedResourceKind.FishFood]: '#5fa8bd',
    [CarriedResourceKind.Tools]: '#aab3b1',
    [CarriedResourceKind.Equipment]: '#d4dadd',
    [CarriedResourceKind.CraftInputs]: '#b7875f',
  }[kind];
}
