import { describe, expect, it } from 'vitest';
import {
  createNpcRuntimeState,
  exitNpcView,
  getClosestNpcRoutePoint,
  getNpcCameraPose,
  getNpcRouteLookaheadForward,
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
  it('可按整条路线长度分配初始进度，居民不会都从第一个路点同时出发', () => {
    const spreadRoute: NpcRoute = {
      speed: 1,
      nodes: [
        { position: [0, 0, 0] },
        { position: [4, 0, 0] },
        { position: [4, 0, 8] },
        { position: [0, 0, 8] },
      ],
    };

    const halfway = createNpcRuntimeState('mechanic', spreadRoute, 0.5);

    expect(halfway.segmentIndex).toBe(2);
    expect(halfway.segmentProgress).toBe(0);
    expect(halfway.position).toEqual([4, 0, 8]);
    expect(halfway.forward).toEqual([-1, 0, 0]);
  });

  it('提供三名可辨识的居民资料', () => {
    expect(NPC_PROFILES).toHaveLength(18);
    expect(NPC_PROFILES.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([
        'traveler',
        'mechanic',
        'gardener',
        'baker',
        'courier',
        'ranger',
        'shopkeeper',
        'nurse',
        'teacher',
        'fisher',
        'groundskeeper',
        'musician',
      ]),
    );
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

  it('接近无停留拐点时提前朝下一路段转身，远离拐点时保持当前方向', () => {
    const cornerRoute: NpcRoute = {
      speed: 1.4,
      nodes: [
        { position: [0, 0, 0] },
        { position: [0, 0, 4] },
        { position: [4, 0, 4] },
        { position: [4, 0, 0] },
      ],
    };

    expect(getNpcRouteLookaheadForward(cornerRoute, 0, 0.2, 0.9)).toEqual([0, 0, 1]);
    const approachingCorner = getNpcRouteLookaheadForward(cornerRoute, 0, 0.9, 0.9);
    expect(approachingCorner[0]).toBeGreaterThan(0.3);
    expect(approachingCorner[2]).toBeGreaterThan(0.3);

    const moving = stepNpcRuntime(
      {
        id: 'ranger',
        segmentIndex: 0,
        segmentProgress: 0.82,
        activity: 'walking',
        activityRemaining: 0,
        position: [0, 0, 3.28],
        forward: [0, 0, 1],
        gaitPhase: 0,
      },
      cornerRoute,
      { rain: 0, snow: 0, daylight: 1 },
      0.05,
    );
    expect(moving.forward[0]).toBeGreaterThan(0);
    expect(moving.forward[2]).toBeGreaterThan(0);
  });

  it('离开路线后接回最近路段中点，而不是折返较远的路点', () => {
    const squareRoute: NpcRoute = {
      speed: 1,
      nodes: [
        { position: [0, 0, 0] },
        { position: [1, 0, 0] },
        { position: [1, 0, 1] },
        { position: [0, 0, 1] },
      ],
    };
    const projection = getClosestNpcRoutePoint(squareRoute, [0.46, 0, 0.32]);

    expect(projection.segmentIndex).toBe(0);
    expect(projection.segmentProgress).toBeCloseTo(0.46, 2);
    expect(projection.position).toEqual([0.46, 0, 0]);
    expect(projection.forward).toEqual([1, 0, 0]);
    expect(projection.distance).toBeCloseTo(0.32, 2);
  });

  it('在跟随与第一人称模式生成稳定的相机姿态', () => {
    const snapshot: NpcSnapshot = {
      id: 'gardener',
      name: '苔芽',
      role: '温室园丁',
      activity: 'walking',
      motion: 'walk',
      routine: 'work',
      task: '照料温室作物',
      taskAction: null,
      reaction: 'none',
      socialPartner: null,
      position: [2, 1, 3],
      forward: [1, 0, 0],
      gaitPhase: 0.25,
    };
    const follow = getNpcCameraPose(snapshot, 'follow');
    const pov = getNpcCameraPose(snapshot, 'pov');

    expect(follow.position[0]).toBeLessThan(snapshot.position[0]);
    expect(follow.position[1]).toBeGreaterThanOrEqual(snapshot.position[1] + 3.2);
    expect(follow.position[2]).toBeCloseTo(snapshot.position[2]);
    expect(pov.position[0]).toBeGreaterThan(snapshot.position[0]);
    expect(pov.target[0]).toBeGreaterThan(pov.position[0] + 2);
    expect(pov.fov).toBeGreaterThan(follow.fov);
  });

  it('跟随镜头保持在角色正后方，避免 WASD 方向与肩位镜头形成旋转反馈', () => {
    const snapshot: NpcSnapshot = {
      id: 'traveler',
      name: '岚',
      role: '广场居民',
      activity: 'walking',
      motion: 'walk',
      routine: 'leisure',
      task: '散步',
      taskAction: null,
      reaction: 'none',
      socialPartner: null,
      position: [3, 0.22, -2],
      forward: [0.6, 0, 0.8],
      gaitPhase: 0.4,
    };

    const follow = getNpcCameraPose(snapshot, 'follow');
    const viewX = follow.target[0] - follow.position[0];
    const viewZ = follow.target[2] - follow.position[2];
    const lateralDrift = viewX * snapshot.forward[2] - viewZ * snapshot.forward[0];

    expect(Math.abs(lateralDrift)).toBeLessThan(0.001);
  });

  it('选择 NPC 默认进入跟随，随后可切换第一视角并退出', () => {
    const selected = selectNpc({ npcId: null, mode: 'orbit' }, 'traveler');
    expect(selected).toEqual({ npcId: 'traveler', mode: 'follow' });
    expect(setNpcViewMode(selected, 'pov')).toEqual({ npcId: 'traveler', mode: 'pov' });
    expect(exitNpcView()).toEqual({ npcId: null, mode: 'orbit' });
  });
});
