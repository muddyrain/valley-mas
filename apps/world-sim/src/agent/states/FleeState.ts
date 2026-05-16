import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class FleeState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickFleeTarget();
  }

  update(context: UnitStateContext, deltaMs: number) {
    if (!context.hasFleeTask()) {
      context.transition('Idle');
      return;
    }

    if (!context.hasTarget()) {
      context.pickFleeTarget();
    }

    if (context.hasTarget()) {
      context.moveTowardTarget(deltaMs);
    }
  }
}
