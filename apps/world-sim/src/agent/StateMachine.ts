export type StateLifecycle<TContext> = {
  enter?: (context: TContext) => void;
  update?: (context: TContext, deltaMs: number) => void;
  exit?: (context: TContext) => void;
};

export class StateMachine<TState extends string, TContext> {
  private currentState: TState;

  constructor(
    private readonly context: TContext,
    private readonly states: Record<TState, StateLifecycle<TContext>>,
    initialState: TState,
  ) {
    this.currentState = initialState;
    this.states[this.currentState].enter?.(this.context);
  }

  get state() {
    return this.currentState;
  }

  transition(nextState: TState) {
    if (nextState === this.currentState) {
      return;
    }

    this.states[this.currentState].exit?.(this.context);
    this.currentState = nextState;
    this.states[this.currentState].enter?.(this.context);
  }

  update(deltaMs: number) {
    this.states[this.currentState].update?.(this.context, deltaMs);
  }
}
