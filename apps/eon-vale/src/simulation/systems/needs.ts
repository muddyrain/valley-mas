import { AgentState } from '@/shared/gameTypes';

export interface UtilityContext {
  hunger: number;
  energy: number;
  danger: number;
  hasWork: boolean;
  isGuard: boolean;
}

export function selectUtilityState(context: UtilityContext): AgentState {
  if (context.danger > 0) return AgentState.Flee;
  const hungerScore = context.hunger / 1_000;
  const restScore = (1_000 - context.energy) / 1_000;
  if (hungerScore >= 0.68 && hungerScore >= restScore) return AgentState.FindFood;
  if (restScore >= 0.64) return AgentState.Rest;
  if (context.isGuard) return AgentState.Guard;
  if (context.hasWork) return AgentState.Build;
  return AgentState.Wander;
}
