import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class HarvestState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickHarvestTarget();
    context.waitUntil = context.now + 450;

    if (!context.hasTarget()) {
      context.transition('Wander');
    }
  }

  update(context: UnitStateContext, deltaMs: number) {
    if (context.hasTarget()) {
      context.moveTowardTarget(deltaMs);
      return;
    }

    if (context.now >= context.waitUntil) {
      if (context.harvestResource()) {
        context.transition('Rest');
        return;
      }

      context.transition('Idle');
    }
  }
}
