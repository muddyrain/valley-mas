import { describe, expect, it } from 'vitest';
import type { NavigationGraph, TownVec2 } from './town-navigation';
import {
  clampVehicleAdvance,
  getIntersectionSpeedScale,
  getIntersectionYieldDecision,
  getOrientedVehicleOverlap,
  getParkingApproachSpeed,
  getRightHandLaneJunctionTarget,
  getRightHandLaneTarget,
  getRightHandLaneWaypoints,
  getTrafficLaneDecision,
  getVehicleClearanceScale,
} from './town-traffic';

const graph: NavigationGraph = {
  nodes: [
    { id: 'west', position: [-4, 0], neighbors: ['center'] },
    { id: 'center', position: [0, 0], neighbors: ['west', 'east', 'north'] },
    { id: 'east', position: [4, 0], neighbors: ['center'] },
    { id: 'north', position: [0, -4], neighbors: ['center'] },
  ],
};

describe('town traffic', () => {
  it('交叉路口只允许一辆相交方向的车辆先进入，其余车辆停在路口外', () => {
    const graph: NavigationGraph = {
      nodes: [
        { id: 'cross', position: [0, 0], neighbors: ['north', 'east', 'south', 'west'] },
        { id: 'north', position: [0, -10], neighbors: ['cross'] },
        { id: 'east', position: [10, 0], neighbors: ['cross'] },
        { id: 'south', position: [0, 10], neighbors: ['cross'] },
        { id: 'west', position: [-10, 0], neighbors: ['cross'] },
      ],
    };
    const eastbound = {
      id: 'amber',
      position: [-4, 0] as TownVec2,
      heading: Math.PI / 2,
      speed: 3,
    };
    const northbound = { id: 'navy', position: [0, 4] as TownVec2, heading: Math.PI, speed: 3 };

    const eastDecision = getIntersectionYieldDecision(eastbound, [northbound], graph);
    const northDecision = getIntersectionYieldDecision(northbound, [eastbound], graph);

    expect([eastDecision.hasPriority, northDecision.hasPriority]).toEqual([true, false]);
    expect(eastDecision.speedScale).toBe(1);
    expect(northDecision.speedScale).toBe(0);
  });

  it('已进入路口的车辆保持优先权，驶离冲突区后等待车辆接续通行', () => {
    const graph: NavigationGraph = {
      nodes: [
        { id: 'cross', position: [0, 0], neighbors: ['north', 'east', 'south'] },
        { id: 'north', position: [0, -10], neighbors: ['cross'] },
        { id: 'east', position: [10, 0], neighbors: ['cross'] },
        { id: 'south', position: [0, 10], neighbors: ['cross'] },
      ],
    };
    const crossing = { id: 'navy', position: [0.4, 0] as TownVec2, heading: Math.PI / 2, speed: 2 };
    const waiting = { id: 'amber', position: [0, 3.8] as TownVec2, heading: Math.PI, speed: 0.1 };

    expect(getIntersectionYieldDecision(crossing, [waiting], graph).hasPriority).toBe(true);
    expect(getIntersectionYieldDecision(waiting, [crossing], graph).speedScale).toBe(0);

    const cleared = { ...crossing, position: [3.2, 0] as TownVec2 };
    expect(getIntersectionYieldDecision(waiting, [cleared], graph).hasPriority).toBe(true);
  });

  it('越过停止线的车辆优先清空路口，不把路权切给刚进入冲突区的后来车', () => {
    const clearing = {
      id: 'zeta',
      position: [0.8, 0] as TownVec2,
      heading: Math.PI / 2,
      speed: 2,
    };
    const arriving = {
      id: 'alpha',
      position: [0, 0.5] as TownVec2,
      heading: Math.PI,
      speed: 2,
    };

    expect(getIntersectionYieldDecision(clearing, [arriving], graph).hasPriority).toBe(true);
    expect(getIntersectionYieldDecision(arriving, [clearing], graph).hasPriority).toBe(false);
  });

  it('按道路前进方向把车辆放到右侧车道', () => {
    expect(getRightHandLaneTarget([0, 0], [10, 0], 1)).toEqual([10, 1]);
    expect(getRightHandLaneTarget([0, 0], [0, 10], 1)).toEqual([-1, 10]);
  });

  it('把连续道路中心点转换为每一段的右侧车道目标', () => {
    expect(
      getRightHandLaneWaypoints(
        [
          [0, 0],
          [0, 10],
          [10, 10],
        ],
        1,
      ),
    ).toEqual([
      [-1, 11],
      [10, 11],
    ]);
  });

  it('转弯路口使用进入与离开车道的交汇点，不在节点中心突然换侧', () => {
    expect(getRightHandLaneJunctionTarget([0, 0], [10, 0], [20, 0], 1)).toEqual([10, 1]);
    const corner = getRightHandLaneJunctionTarget([0, 0], [10, 0], [10, 10], 1);
    expect(corner[0]).toBeCloseTo(9, 5);
    expect(corner[1]).toBeCloseTo(1, 5);
  });

  it('前方静止车辆挡路且对向无车时允许借用对向车道', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [{ id: 'parked', position: [0, 4], heading: 0, speed: 0 }],
        null,
      ),
    ).toEqual({ mode: 'passing', blockerId: 'parked', obstacleId: 'parked' });
  });

  it('对向车辆接近时留在右侧车道等待，不冒险借道', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [
          { id: 'parked', position: [0, 4], heading: 0, speed: 0 },
          { id: 'oncoming', position: [0.4, 9], heading: Math.PI, speed: 2.8 },
        ],
        null,
      ),
    ).toEqual({ mode: 'right', blockerId: null, obstacleId: 'parked' });
  });

  it('快速对向车仍在固定探测距离外时按相遇时间提前等待', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [
          { id: 'parked', position: [0, 4], heading: 0, speed: 0, parked: true },
          { id: 'fast-oncoming', position: [0.4, 16], heading: Math.PI, speed: 4.5 },
        ],
        null,
      ),
    ).toEqual({ mode: 'right', blockerId: null, obstacleId: 'parked' });
  });

  it('对向车辆已经停车时仍视为占用对向车道，不继续强行借道', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [
          { id: 'blocker', position: [0, 4], heading: 0, speed: 0, parked: true },
          { id: 'oncoming-stopped', position: [0.4, 8], heading: Math.PI, speed: 0 },
        ],
        null,
      ),
    ).toEqual({ mode: 'right', blockerId: null, obstacleId: 'blocker' });
  });

  it('任务车辆短暂停车时保持跟车，不把它误判为可借道的弃置车辆', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [
          {
            id: 'mission-vehicle',
            position: [0, 4],
            heading: 0,
            speed: 0,
            parked: false,
          },
        ],
        null,
      ),
    ).toEqual({ mode: 'right', blockerId: null, obstacleId: 'mission-vehicle' });
  });

  it('已经开始借道后阻挡车辆缓慢起步，仍保持原借道目标直至超过', () => {
    expect(
      getTrafficLaneDecision(
        [0, 0],
        0,
        [
          {
            id: 'mission-vehicle',
            position: [0, 4],
            heading: 0,
            speed: 0,
            parked: false,
          },
        ],
        'mission-vehicle',
      ),
    ).toEqual({
      mode: 'passing',
      blockerId: 'mission-vehicle',
      obstacleId: 'mission-vehicle',
    });
  });

  it('借道超过障碍后回到右侧车道', () => {
    expect(
      getTrafficLaneDecision(
        [0, 7],
        0,
        [{ id: 'parked', position: [0, 4], heading: 0, speed: 0 }],
        'parked',
      ),
    ).toEqual({ mode: 'right', blockerId: null, obstacleId: null });
  });

  it('车辆进入三岔路口前主动降低巡航速度', () => {
    expect(getIntersectionSpeedScale([0.4, 0.2], graph)).toBeLessThan(0.7);
    expect(getIntersectionSpeedScale([12, 12], graph)).toBe(1);
  });

  it('其他车辆进入近距安全圈时阻止继续前进', () => {
    expect(getVehicleClearanceScale([0, 0], 0, [[0, 1.8]])).toBe(0);
    expect(getVehicleClearanceScale([0, 0], 0, [[0, 2.8]])).toBe(0);
    expect(getVehicleClearanceScale([0, 0], 0, [[4, 0]])).toBe(1);
  });

  it('按有朝向的车身矩形判定重叠，同车道保持车长而相邻车道不互相横推', () => {
    expect(
      getOrientedVehicleOverlap(
        { position: [0, 0], heading: 0 },
        { position: [0, 2.7], heading: 0 },
      ),
    ).toMatchObject({ axis: [0, 1] });
    expect(
      getOrientedVehicleOverlap(
        { position: [0, 0], heading: 0 },
        { position: [2.2, 0], heading: Math.PI },
      ),
    ).toBeNull();
  });

  it('自动泊车接近车位时连续降速而不是最后一帧吸附', () => {
    expect(getParkingApproachSpeed(8)).toBeCloseTo(4.2);
    expect(getParkingApproachSpeed(0.4)).toBeLessThan(1.5);
    expect(getParkingApproachSpeed(0)).toBe(0);
  });

  it('后车一帧即将进入前车时只截断本车位移，不推动前车移位', () => {
    const next = clampVehicleAdvance([0, 0], [0, 1], [[0, 3]], 2.6);

    expect(next[0]).toBe(0);
    expect(next[1]).toBeGreaterThanOrEqual(0);
    expect(next[1]).toBeLessThanOrEqual(0.41);
    expect(Math.hypot(next[0], 3 - next[1])).toBeGreaterThanOrEqual(2.59);
  });
});
