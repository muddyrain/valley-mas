import type { StateLifecycle } from '../StateMachine';
import type { UnitStateContext } from './UnitStateTypes';

export class WanderState implements StateLifecycle<UnitStateContext> {
  enter(context: UnitStateContext) {
    context.pickWanderTarget();
    context.transition('March');
  }
}
