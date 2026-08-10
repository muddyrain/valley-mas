import { describe, expect, it } from 'vitest';
import {
  createNpcRuntimeState,
  exitNpcView,
  getNpcCameraPose,
  NPC_PROFILES,
  type NpcRoute,
  type NpcSnapshot,
  selectNpc,
  setNpcViewMode,
  stepNpcRuntime,
} from './npc';

const route: NpcRoute = {
  speed: 1,
  nodes: [
    { position: [0, 0, 0] },
    { position: [1, 0, 0], activity: 'working', waitSeconds: 2 },
    { position: [1, 0, 1], activity: 'observing', waitSeconds: 1 },
  ],
};

describe('npc simulation', () => {
  it('提供三名可辨识的居民资料', () => {
    expect(NPC_PROFILES.map((profile) => profile.id)).toEqual(['traveler', 'mechanic', 'gardener']);
    expect(NPC_PROFILES.map((profile) => profile.name)).toEqual(['岚', '铆钉', '苔芽']);
  });

  it('沿路点移动并在目标点进入工作状态', () => {
    const initial = createNpcRuntimeState('traveler', route);
    const moving = stepNpcRuntime(initial, route, { rain: 0, snow: 0, daylight: 1 }, 0.5);
    const arrived = stepNpcRuntime(moving, route, { rain: 0, snow: 0, daylight: 1 }, 0.6);

    expect(moving.activity).toBe('walking');
    expect(moving.position[0]).toBeCloseTo(0.5);
    expect(arrived.position).toEqual([1, 0, 0]);
    expect(arrived.activity).toBe('working');

    const waiting = stepNpcRuntime(arrived, route, { rain: 0, snow: 0, daylight: 1 }, 1);
    const resumed = stepNpcRuntime(waiting, route, { rain: 0, snow: 0, daylight: 1 }, 1.1);
    expect(waiting.position).toEqual([1, 0, 0]);
    expect(resumed.activity).toBe('walking');
  });

  it('雨雪天气会降低移动速度但不会冻结居民', () => {
    const initial = createNpcRuntimeState('mechanic', route);
    const clear = stepNpcRuntime(initial, route, { rain: 0, snow: 0, daylight: 1 }, 0.4);
    const storm = stepNpcRuntime(initial, route, { rain: 0.8, snow: 0.8, daylight: 0.3 }, 0.4);

    expect(storm.position[0]).toBeGreaterThan(0);
    expect(storm.position[0]).toBeLessThan(clear.position[0]);
  });

  it('在跟随与第一人称模式生成稳定的相机姿态', () => {
    const snapshot: NpcSnapshot = {
      id: 'gardener',
      name: '苔芽',
      role: '温室园丁',
      activity: 'walking',
      position: [2, 1, 3],
      forward: [1, 0, 0],
      gaitPhase: 0.25,
    };
    const follow = getNpcCameraPose(snapshot, 'follow');
    const pov = getNpcCameraPose(snapshot, 'pov');

    expect(follow.position[0]).toBeLessThan(snapshot.position[0]);
    expect(follow.position[1]).toBeGreaterThanOrEqual(snapshot.position[1] + 3.2);
    expect(Math.abs(follow.position[2] - snapshot.position[2])).toBeGreaterThan(0.8);
    expect(pov.position[0]).toBeGreaterThan(snapshot.position[0]);
    expect(pov.target[0]).toBeGreaterThan(pov.position[0] + 2);
    expect(pov.fov).toBeGreaterThan(follow.fov);
  });

  it('选择 NPC 默认进入跟随，随后可切换第一视角并退出', () => {
    const selected = selectNpc({ npcId: null, mode: 'orbit' }, 'traveler');
    expect(selected).toEqual({ npcId: 'traveler', mode: 'follow' });
    expect(setNpcViewMode(selected, 'pov')).toEqual({ npcId: 'traveler', mode: 'pov' });
    expect(exitNpcView()).toEqual({ npcId: null, mode: 'orbit' });
  });
});
