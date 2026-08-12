export interface GameSessionState {
  paused: boolean;
}

export type GameSessionEvent = { type: 'toggle-pause' } | { type: 'pause' } | { type: 'resume' };

export const createGameSessionState = (): GameSessionState => ({ paused: false });

export function reduceGameSession(
  state: Readonly<GameSessionState>,
  event: GameSessionEvent,
): GameSessionState {
  const paused = event.type === 'toggle-pause' ? !state.paused : event.type === 'pause';
  return paused === state.paused ? state : { paused };
}
