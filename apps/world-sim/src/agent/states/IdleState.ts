import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class IdleState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.waitUntil = context.now + 900 + Math.random() * 1200;
  }

  update(context: UnitStateContext) {
    if (context.hasTarget()) {
      context.transition('March');
      return;
    }

    if (context.now >= context.waitUntil) {
      if (context.hasBuildTask()) {
        context.transition('Build');
        return;
      }

      context.transition(context.shouldHarvest() ? 'Harvest' : 'Wander');
    }
  }
}
