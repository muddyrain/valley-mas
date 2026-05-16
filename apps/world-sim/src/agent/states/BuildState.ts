import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class BuildState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickBuildTarget();
  }

  update(context: UnitStateContext, deltaMs: number) {
    if (!context.hasBuildTask()) {
      context.transition('Rest');
      return;
    }

    if (context.hasTarget()) {
      context.moveTowardTarget(deltaMs);
      return;
    }

    if (context.buildAtTarget(deltaMs)) {
      context.transition('Rest');
    }
  }
}
