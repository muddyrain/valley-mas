import { AgentState, EntityKind, Profession } from '@/shared/gameTypes';

export function attackThrustFrame(state: AgentState, tick: number, entityId: number): 0 | 1 {
  if (state !== AgentState.Attack) return 0;
  return Math.floor((tick + entityId) / 4) % 2 === 0 ? 0 : 1;
}

export function combatHealthBar(
  profession: Profession,
  state: AgentState,
  health: number,
): { visible: boolean; ratio: number } {
  const visible =
    profession === Profession.Guard &&
    (state === AgentState.Attack || state === AgentState.Chase) &&
    health > 0;
  return { visible, ratio: Math.max(0, Math.min(1, health / 1_000)) };
}

export function shouldFlashFromDamage(previousHealth: number, health: number): boolean {
  return health > 0 && health < previousHealth;
}

export function shouldEmitDeathPuff(
  previousActive: number,
  active: number,
  kind: EntityKind,
): boolean {
  return previousActive === 1 && active === 0 && kind === EntityKind.Human;
}
