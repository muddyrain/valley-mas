import { describe, expect, it } from 'vitest';
import {
  createWorldControlState,
  getCameraRelativeResidentMovement,
  getClosestVehicleDoorPose,
  getResidentMovementBasis,
  getVehicleDriverDoorApproach,
  getVehicleDriverDoorPose,
  PLAYER_RESIDENT_ID,
  PLAYER_SPAWN_FORWARD,
  PLAYER_SPAWN_POSITION,
  transitionWorldControl,
} from './playable-world';

describe('playable world control', () => {
  it('把 A/D 映射为玩家视角中的左移和右移', () => {
    const right = getCameraRelativeResidentMovement([0, 1], 0, 1);
    const left = getCameraRelativeResidentMovement([0, 1], 0, -1);

    expect(right).toEqual([-1, 0]);
    expect(left).toEqual([1, 0]);
  });

  it('持续按住方向键时锁定起步镜头方向，避免角色转向反过来把路线带成圆弧', () => {
    const started = getResidentMovementBasis(null, [0, 1], true, false);
    const followedCharacter = getResidentMovementBasis(started, [1, 0], true, false);
    const manualOrbit = getResidentMovementBasis(followedCharacter, [1, 0], true, true);
    const released = getResidentMovementBasis(manualOrbit, [1, 0], false, false);

    expect(started).toEqual([0, 1]);
    expect(followedCharacter).toEqual([0, 1]);
    expect(manualOrbit).toEqual([1, 0]);
    expect(released).toBeNull();
  });

  it('进入世界后始终控制固定主角，不再从上帝视角接管其他居民', () => {
    const initial = createWorldControlState();
    const attemptedSwitch = transitionWorldControl(initial, {
      type: 'possess-resident',
      residentId: 'gardener',
    });

    expect(initial).toEqual({
      mode: 'resident',
      residentId: PLAYER_RESIDENT_ID,
      vehicleId: null,
    });
    expect(attemptedSwitch.state).toEqual(initial);
    expect(attemptedSwitch.effects).toEqual([]);
  });

  it('固定主角出生在中心广场步道并朝向主路，而不是复用 NPC 的远程通勤点', () => {
    expect(PLAYER_SPAWN_POSITION).toEqual([7.02, 0.22, -7.02]);
    expect(PLAYER_SPAWN_FORWARD).toEqual([0, 0, -1]);
  });

  it('固定主角可以上下车，下车后仍然是同一个人', () => {
    const initial = createWorldControlState();
    const driving = transitionWorldControl(initial, {
      type: 'enter-vehicle',
      vehicleId: 'copper',
    });
    const exited = transitionWorldControl(driving.state, { type: 'exit-vehicle' });

    expect(driving.state).toMatchObject({
      mode: 'vehicle',
      residentId: PLAYER_RESIDENT_ID,
      vehicleId: 'copper',
    });
    expect(exited.state).toMatchObject({
      mode: 'resident',
      residentId: PLAYER_RESIDENT_ID,
      vehicleId: null,
    });
  });

  it('释放控制事件不再进入全镇俯瞰，也不会让固定主角恢复 NPC 路线', () => {
    const driving = transitionWorldControl(createWorldControlState(), {
      type: 'enter-vehicle',
      vehicleId: 'sage',
    });
    const released = transitionWorldControl(driving.state, { type: 'release-control' });

    expect(released.state).toEqual(driving.state);
    expect(released.effects).toEqual([]);
  });

  it('上下车固定使用左侧驾驶门，角色不会从副驾侧穿过车厢', () => {
    const pose = getVehicleDriverDoorPose([0, 0.38, 0], 0);

    expect(pose.outside[0]).toBeLessThan(-1.5);
    expect(pose.inside[0]).toBeLessThan(0);
    expect(pose.enterForward).toEqual([1, 0, 0]);
    expect(pose.exitForward).toEqual([-1, 0, 0]);
  });

  it('自主居民会选择当前一侧最近的可达车门，不会被车身挡在对侧', () => {
    const rightApproach = getClosestVehicleDoorPose([0, 0.38, 0], 0, [1.4, 0.22, 0]);
    const leftApproach = getClosestVehicleDoorPose([0, 0.38, 0], 0, [-1.4, 0.22, 0]);

    expect(rightApproach.side).toBe('right');
    expect(rightApproach.pose.outside[0]).toBeGreaterThan(1);
    expect(leftApproach.side).toBe('left');
    expect(leftApproach.pose.outside[0]).toBeLessThan(-1);
  });

  it('固定主角从副驾侧上车时绕过车头到驾驶门，不横穿车身', () => {
    const oppositeSide = getVehicleDriverDoorApproach([0, 0.38, 0], 0, [1.4, 0.22, 0]);
    const driverSide = getVehicleDriverDoorApproach([0, 0.38, 0], 0, [-1.4, 0.22, 0]);

    expect(oppositeSide.pose.outside[0]).toBeLessThan(-1.5);
    expect(oppositeSide.waypoints).toHaveLength(2);
    expect(oppositeSide.waypoints[0]?.[0]).toBeGreaterThan(1.5);
    expect(oppositeSide.waypoints[1]?.[0]).toBeLessThan(-1.5);
    expect(oppositeSide.waypoints.every((point) => point[2] > 2)).toBe(true);
    expect(driverSide.waypoints).toEqual([]);
  });
});
