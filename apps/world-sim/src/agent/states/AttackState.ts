import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class AttackState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickAttackTarget();
  }

  update(context: UnitStateContext, deltaMs: number) {
    if (!context.hasAttackTask()) {
      context.transition('Idle');
      return;
    }

    context.pickAttackTarget();

    if (context.hasTarget()) {
      const reachedTarget = context.moveTowardTarget(deltaMs);

      if (!reachedTarget) {
        return;
      }
    }

    if (context.attackAtTarget(deltaMs)) {
      context.transition('Idle');
    }
  }
}
