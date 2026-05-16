import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class MarchState implements StateLifecycle<UnitStateContext> {
  update(context: UnitStateContext, deltaMs: number) {
    if (!context.hasTarget()) {
      context.transition('Idle');
      return;
    }

    const reachedTarget = context.moveTowardTarget(deltaMs);

    if (reachedTarget) {
      context.transition('Idle');
    }
  }
}
