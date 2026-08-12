import { describe, expect, it } from 'vitest';
import { createGameSessionState, reduceGameSession } from './game-session';

describe('game session', () => {
  it('进入世界时直接游玩，不显示暂停菜单', () => {
    expect(createGameSessionState()).toEqual({ paused: false });
  });

  it('Escape 只切换暂停状态，不释放固定主角控制权', () => {
    const paused = reduceGameSession(createGameSessionState(), { type: 'toggle-pause' });
    const resumed = reduceGameSession(paused, { type: 'toggle-pause' });

    expect(paused).toEqual({ paused: true });
    expect(resumed).toEqual({ paused: false });
  });

  it('继续游戏操作可以幂等关闭暂停菜单', () => {
    const playing = reduceGameSession({ paused: true }, { type: 'resume' });
    expect(playing).toEqual({ paused: false });
    expect(reduceGameSession(playing, { type: 'resume' })).toBe(playing);
  });
});
