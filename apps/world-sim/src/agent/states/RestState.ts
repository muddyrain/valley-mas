import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class RestState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickRestTarget();
    context.waitUntil = context.now + 650;
  }

  update(context: UnitStateContext, deltaMs: number) {
    if (context.hasTarget()) {
      context.moveTowardTarget(deltaMs);
      return;
    }

    if (context.now >= context.waitUntil && context.isRested()) {
      context.transition('Idle');
    }
  }
}
