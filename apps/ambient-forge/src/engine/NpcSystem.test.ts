import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { NPC_PROFILES } from '../core/npc';
import { getClosestVehicleDoorPose } from '../core/playable-world';
import { getQualityProfile } from '../core/quality';
import {
  getResidentDestinationSlotOffset,
  getResidentRoutineDestinationStop,
} from '../core/resident-schedule';
import { deriveSceneSignals } from '../core/scene-signals';
import { scaleTownVec3 } from '../core/town-layout';
import { createGroundTown } from './createGroundTown';
import { createNpcSystem } from './NpcSystem';

describe('NpcSystem', () => {
  it('装配十八名分布在七个街区的居民', () => {
    const system = createNpcSystem(getQualityProfile('high'));

    expect(system.root.getObjectByName('npc-traveler')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-mechanic')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-gardener')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('traveler-backpack')).toBeTruthy();
    expect(system.root.getObjectByName('mechanic-goggles')).toBeTruthy();
    expect(system.root.getObjectByName('gardener-watering-can')).toBeTruthy();
    expect(system.root.getObjectByName('npc-high-detail')).toBeTruthy();
    expect(system.root.getObjectByName('npc-baker')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-courier')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-ranger')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-shopkeeper')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-nurse')).toBeInstanceOf(Group);
    expect(system.root.getObjectByName('npc-groundskeeper')).toBeInstanceOf(Group);
    expect(system.getSnapshots()).toHaveLength(18);

    system.dispose();
  });

  it('固定主角附近只保留少量可见居民，其余居民沿各自路线分散出生', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    system.teleportResident('traveler', [7.02, 0.22, -7.02], [0, 0, -1]);
    system.setControlled('traveler');
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    for (let frame = 0; frame < 60; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 7.8, [7.02, 3.6, -2.4]);
    }
    const snapshots = system.getSnapshots();
    const hero = snapshots.find((snapshot) => snapshot.id === 'traveler');
    const nearbyResidents = snapshots.filter(
      (snapshot) =>
        snapshot.id !== 'traveler' &&
        Math.hypot(
          snapshot.position[0] - (hero?.position[0] ?? 0),
          snapshot.position[2] - (hero?.position[2] ?? 0),
        ) < 5,
    );

    expect(nearbyResidents).toHaveLength(2);
    expect(
      snapshots.some(
        (snapshot) =>
          snapshot.id !== 'traveler' &&
          Math.hypot(
            snapshot.position[0] - (hero?.position[0] ?? 0),
            snapshot.position[2] - (hero?.position[2] ?? 0),
          ) < 14,
      ),
    ).toBe(true);
    expect(system.root.userData.initialRouteSpread).toBe('normalized-distance');
    expect(
      new Set(
        snapshots.map(
          (snapshot) =>
            system.root.getObjectByName(`npc-${snapshot.id}`)?.userData.initialRouteProgress,
        ),
      ).size,
    ).toBeGreaterThan(10);

    system.dispose();
    town.dispose();
  });

  it('更新移动状态、提供镜头姿态并按质量档裁剪装饰细节', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 1, 0.5);
    const after = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const pose = system.getCameraPose('traveler', 'pov');

    expect(after?.position).not.toEqual(before?.position);
    expect(pose?.target[2]).not.toBe(pose?.position[2]);

    system.setQuality(getQualityProfile('low'));
    expect(system.root.getObjectByName('npc-high-detail')?.visible).toBe(false);
    system.setQuality(getQualityProfile('high'));
    expect(system.root.getObjectByName('npc-high-detail')?.visible).toBe(true);

    system.dispose();
  });

  it('暴露基础路线位置与人群避让偏移，便于区分寻路抖动和错身抖动', () => {
    const system = createNpcSystem(getQualityProfile('high'));

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 1, 0.05);

    const basePositions = String(system.root.userData.npcBasePositions ?? '');
    const crowdOffsets = String(system.root.userData.npcCrowdOffsets ?? '');
    const animationStates = String(system.root.userData.npcAnimationStates ?? '');
    const motionStates = String(system.root.userData.npcMotionStates ?? '');
    expect(basePositions.split('|')).toHaveLength(18);
    expect(crowdOffsets.split('|')).toHaveLength(18);
    expect(animationStates.split('|')).toHaveLength(18);
    expect(motionStates.split('|')).toHaveLength(18);
    expect(basePositions).toMatch(/traveler:-?\d+\.\d{3},-?\d+\.\d{3}/);
    expect(crowdOffsets).toMatch(/traveler:-?\d+\.\d{3},-?\d+\.\d{3}/);
    expect(animationStates).toMatch(/traveler:none:0\.000/);
    expect(motionStates).toMatch(/traveler:-?\d+\.\d{3}:-?\d+\.\d{3}:[a-z]+/);

    system.dispose();
  });

  it('根据玩家距离切换英雄、近景、中景和远景模型档位', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.teleportResident('mechanic', [18, 0.22, 0], [0, 0, 1]);
    system.teleportResident('gardener', [42, 0.22, 0], [0, 0, 1]);
    system.teleportResident('ranger', [86, 0.22, 0], [0, 0, 1]);
    system.playVehicleTransition('mechanic', 'exiting', [18, 0.22, 0], [0, 0, 1], 10);
    system.playVehicleTransition('gardener', 'exiting', [42, 0.22, 0], [0, 0, 1], 10);
    system.playVehicleTransition('ranger', 'exiting', [86, 0.22, 0], [0, 0, 1], 10);
    system.setControlled('traveler');

    system.update(signals, 0.1, 0.1, 12, [0, 2, 0]);

    expect(system.root.getObjectByName('npc-traveler')?.userData.detailTier).toBe('hero');
    expect(system.root.getObjectByName('npc-mechanic')?.userData.detailTier).toBe('near');
    expect(system.root.getObjectByName('npc-gardener')?.userData.detailTier).toBe('mid');
    expect(system.root.getObjectByName('npc-ranger')?.userData.detailTier).toBe('far');
    expect(system.root.userData.detailTierCounts).toContain('hero:1');

    system.dispose();
  });

  it('非玩家居民走进跟随相机时只隐藏视觉模型，离开后自动恢复', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const photographer = system.getSnapshots().find((npc) => npc.id === 'photographer');
    expect(photographer).toBeTruthy();
    if (!photographer) return;
    system.setControlled('traveler');

    system.update(signals, 0.1, 0.1, 12, photographer.position);
    const root = system.root.getObjectByName('npc-photographer');
    const head = system.root.getObjectByName('photographer-head');
    expect(root?.userData.cameraOccluded).toBe(true);
    expect(head?.visible).toBe(false);

    system.setControlled(null);
    system.update(signals, 0.2, 0.1, 12, [
      photographer.position[0] + 10,
      photographer.position[1],
      photographer.position[2] + 10,
    ]);
    expect(root?.userData.cameraOccluded).toBe(false);
    expect(head?.visible).toBe(true);

    system.dispose();
  });

  it('接管居民后响应移动、奔跑和跳跃输入，释放后恢复自主路线', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.setControlled('traveler');
    system.setControlInput({ moveX: 1, moveZ: 0, sprint: true, jump: true });
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.1, 0.1);
    const controlled = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(controlled?.position[0]).toBeGreaterThan(before?.position[0] ?? 0);
    expect(controlled?.position[1]).toBeGreaterThan(before?.position[1] ?? 0);
    expect(controlled?.activity).toBe('walking');
    expect(controlled?.motion).toBe('jump');

    system.setControlled(null);
    system.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.5, 0.4);
    const autonomous = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    expect(autonomous?.position).not.toEqual(controlled?.position);

    system.dispose();
  });

  it('奔跑跳跃落地后继续奔跑，不在高速中突然切成步行', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.setControlled('traveler');
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: false });
    for (let frame = 0; frame < 8; frame += 1) {
      system.update(signals, frame * 0.05, 0.05);
    }
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: true });
    system.update(signals, 0.45, 0.05);
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: false });

    let sawAirborne = false;
    let landed = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const traveler = system.root.getObjectByName('npc-traveler');
    for (let frame = 0; frame < 40; frame += 1) {
      system.update(signals, 0.5 + frame * 0.05, 0.05);
      landed = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
      sawAirborne ||= landed?.motion === 'jump';
      if (sawAirborne && Number(traveler?.userData.verticalOffset ?? 1) === 0) break;
    }

    expect(sawAirborne).toBe(true);
    expect(traveler?.userData.verticalOffset).toBe(0);
    expect(landed?.motion).toBe('run');

    system.dispose();
  });

  it('居民走向静止车辆时保持实体间距，不会进入车身', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.setVehicleObstacles([{ id: 'copper', position: [0, 0.38, 3], heading: 0 }]);
    expect(system.root.userData.dynamicVehicleColliders).toBe(1);
    system.setControlled('traveler');
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: false });

    for (let frame = 0; frame < 40; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
    }
    const resident = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(resident?.position[2]).toBeLessThanOrEqual(1.02);
    expect(
      Math.hypot(resident?.position[0] ?? 0, (resident?.position[2] ?? 0) - 3),
    ).toBeGreaterThanOrEqual(1.95);
    expect(system.root.userData.controlledCollision).toBe('blocked');

    system.dispose();
  });

  it('居民执行取车任务时只忽略目标车辆的导航阻挡，并在车门外停稳', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('courier', [1.6, 0.22, -3], [0, 0, 1]);
    system.setVehicleObstacles([
      { id: 'copper', position: [0, 0.38, 0], heading: 0 },
      { id: 'sage', position: [4, 0.38, 0], heading: 0 },
    ]);
    system.assignWorldTask({
      eventId: 'resident-trip:test:walk-to-vehicle',
      residentId: 'courier',
      label: '前往停车位取车',
      action: 'drive',
      target: [1.58, 0.22, 0],
      ignoreVehicleId: 'copper',
    });

    for (let frame = 0; frame < 80; frame += 1) system.update(signals, frame * 0.05, 0.05);

    expect(system.root.userData.ignoredVehicleCollider).toBe('copper');
    expect(system.getWorldTaskStatus()).toMatchObject({ phase: 'working' });
    expect(system.getSnapshots().find((npc) => npc.id === 'courier')?.position[0]).toBeCloseTo(
      1.58,
      1,
    );

    system.dispose();
  });

  it('角色撞到物体时保持输入朝向，跟随镜头不会被碰撞推出方向扭转', () => {
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: [
        {
          id: 'corner-building',
          center: [0, 0],
          halfSize: [0.5, 0.5],
          height: 3,
          vaultable: false,
        },
      ],
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [-1.15, 0.22, -1.15], [1, 0, 1]);
    system.setControlled('traveler');
    system.setControlInput({ moveX: 1, moveZ: 1, sprint: false, jump: false });

    for (let frame = 0; frame < 4; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 12);
    }
    const resident = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const pose = system.getCameraPose('traveler', 'follow');
    const cameraForward = pose
      ? [pose.target[0] - pose.position[0], pose.target[2] - pose.position[2]]
      : [0, 0];
    const cameraForwardLength = Math.max(0.001, Math.hypot(...cameraForward));

    expect(resident?.forward[0]).toBeCloseTo(Math.SQRT1_2, 2);
    expect(resident?.forward[2]).toBeCloseTo(Math.SQRT1_2, 2);
    expect(cameraForward[0] / cameraForwardLength).toBeCloseTo(Math.SQRT1_2, 2);
    expect(cameraForward[1] / cameraForwardLength).toBeCloseTo(Math.SQRT1_2, 2);
    expect(system.root.userData.controlledCollision).toBe('blocked');

    system.dispose();
  });

  it('职业居民会前往世界事件地点工作，玩家释放控制后继续原任务', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.assignWorldTask({
      eventId: 'roadside-repair',
      residentId: 'mechanic',
      label: '检修抛锚车辆',
      action: 'repair',
      target: [-16.8, 0.22, 2.8],
    });
    system.update(signals, 0.2, 0.2, 12);
    const working = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');

    system.setControlled('mechanic');
    system.setControlInput({ moveX: 1, moveZ: 0, sprint: false, jump: false });
    system.update(signals, 0.4, 0.2, 12);
    const controlled = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');

    system.setControlled(null);
    system.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
    system.update(signals, 0.6, 0.2, 12);
    const resumed = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');

    expect(working?.task).toBe('检修抛锚车辆');
    expect(system.getWorldTaskStatus()).toMatchObject({
      eventId: 'roadside-repair',
      residentId: 'mechanic',
    });
    expect(controlled?.position[0]).toBeGreaterThan(working?.position[0] ?? 0);
    expect(resumed?.task).toBe('检修抛锚车辆');
    expect(resumed?.position).not.toEqual(controlled?.position);

    system.dispose();
  });

  it('居民结束远程任务后从当前位置步行接回最近日程，不会瞬移回原轨迹', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.assignWorldTask({
      eventId: 'resident-trip:return-route',
      residentId: 'mechanic',
      label: '完成远程检修',
      action: 'repair',
      target: [30, 0.22, 0],
    });
    for (let frame = 0; frame < 900; frame += 1) system.update(signals, frame * 0.05, 0.05);
    const atDestination = system.getSnapshots().find((npc) => npc.id === 'mechanic');

    system.assignWorldTask(null);
    system.update(signals, 46, 0.1);
    const returning = system.getSnapshots().find((npc) => npc.id === 'mechanic');

    expect(
      Math.hypot(
        (returning?.position[0] ?? 0) - (atDestination?.position[0] ?? 0),
        (returning?.position[2] ?? 0) - (atDestination?.position[2] ?? 0),
      ),
    ).toBeLessThan(0.5);
    expect(returning?.activity).toBe('walking');

    system.dispose();
  });

  it('居民参与 E 互动时停在原地执行任务动作，结束后恢复日程文案', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.setControlled('traveler');
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    system.setWorldParticipation({
      residentId: 'traveler',
      label: '递交包裹',
      action: 'deliver',
    });
    system.setControlInput({ moveX: 1, moveZ: 0, sprint: true, jump: false });
    system.update(signals, 0.2, 0.2, 12);
    const participating = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.setWorldParticipation(null);
    system.update(signals, 0.4, 0.2, 12);
    const resumed = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(participating?.position[0]).toBeCloseTo(before?.position[0] ?? 0, 3);
    expect(participating).toMatchObject({ activity: 'working', task: '递交包裹' });
    expect(resumed?.task).not.toBe('递交包裹');

    system.dispose();
  });

  it('职业居民跨街区处理事件时沿人行导航图抵达，不会被建筑卡住', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const target = scaleTownVec3([4.7, 0.22, -5.05]);
    system.assignWorldTask({
      eventId: 'plaza-escort',
      residentId: 'ranger',
      label: '迷路的访客',
      action: 'guide',
      target,
    });
    for (let frame = 0; frame < 1_200; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
    }
    const ranger = system.getSnapshots().find((snapshot) => snapshot.id === 'ranger');
    expect(system.getWorldTaskStatus()).toMatchObject({
      eventId: 'plaza-escort',
      phase: 'working',
    });
    expect(
      Math.hypot((ranger?.position[0] ?? 0) - target[0], (ranger?.position[2] ?? 0) - target[2]),
    ).toBeLessThan(0.25);

    system.dispose();
    town.dispose();
  });

  it('居民上车隐藏后进入驾驶状态，不再沿旧人行路线隐形移动', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const before = system.getSnapshots().find((npc) => npc.id === 'courier');

    system.setResidentVisible('courier', false);
    for (let frame = 0; frame < 80; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 12);
    }
    const driving = system.getSnapshots().find((npc) => npc.id === 'courier');

    expect(driving?.motion).toBe('driving');
    expect(driving?.position[0]).toBeCloseTo(before?.position[0] ?? 0, 3);
    expect(driving?.position[2]).toBeCloseTo(before?.position[2] ?? 0, 3);

    system.dispose();
    town.dispose();
  });

  it('世界事件会暴露专属任务动作并显示对应的手持道具', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const mechanic = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');
    expect(mechanic).toBeTruthy();
    if (!mechanic) return;

    system.assignWorldTask({
      eventId: 'roadside-repair',
      residentId: 'mechanic',
      label: '拧紧轮毂',
      action: 'repair',
      target: mechanic.position,
    });
    system.update(signals, 0.5, 0.5, 12);
    const working = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');

    expect(working).toMatchObject({ activity: 'working', taskAction: 'repair' });
    expect(system.root.getObjectByName('mechanic-task-repair')?.visible).toBe(true);
    expect(system.root.getObjectByName('npc-mechanic')?.userData.taskAction).toBe('repair');
    expect(system.root.getObjectByName('npc-mechanic')?.userData.groundContact).toBe('stable');

    system.assignWorldTask(null);
    system.update(signals, 0.6, 0.1, 12);
    expect(system.root.getObjectByName('mechanic-task-repair')?.visible).toBe(true);
    for (let index = 0; index < 12; index += 1) {
      system.update(signals, 0.7 + index * 0.1, 0.1, 12);
    }
    expect(system.root.getObjectByName('mechanic-task-repair')?.visible).toBe(false);

    system.dispose();
  });

  it('上下车动作会在指定时长内平滑移动到车门位置', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.setControlled('traveler');
    system.playVehicleTransition('traveler', 'entering', [-8.2, 0.22, -4.5], [0, 0, 1], 0.7);
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.35, 0.35);
    const halfway = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.8, 0.4);
    const complete = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(halfway?.motion).toBe('entering');
    expect(halfway?.position[0]).toBeLessThan(before?.position[0] ?? 0);
    expect(complete?.position[0]).toBeCloseTo(-8.2, 2);
    expect(complete?.motion).toBe('idle');

    system.dispose();
  });

  it('上车后半段在驾驶门原地俯身，不继续向座位滑动', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    system.setControlled('traveler');
    system.playVehicleTransition('traveler', 'entering', [-8.2, 0.22, -4.5], [1, 0, 0], 0.7);

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.56, 0.56);
    const atDoor = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(atDoor?.motion).toBe('entering');
    expect(atDoor?.position[0]).toBeCloseTo(-8.2, 2);
    expect(system.root.getObjectByName('npc-traveler')?.userData.interactionCrouch).toBeGreaterThan(
      0.35,
    );

    system.dispose();
  });

  it('从车辆另一侧上车时按折线绕行，不会横穿车身', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [1.4, 0.22, 0], [0, 0, 1]);
    system.setControlled('traveler');
    system.playVehicleTransition('traveler', 'entering', [-1.58, 0.22, 0], [1, 0, 0], 3, [
      [1.72, 0.22, 2.2],
      [-1.72, 0.22, 2.2],
    ]);

    let crossedBody = false;
    for (let frame = 0; frame < 45; frame += 1) {
      system.update(signals, frame * 0.05, 0.05);
      const position = system.getSnapshots().find((npc) => npc.id === 'traveler')?.position;
      if (position && Math.abs(position[0]) < 1.05 && Math.abs(position[2]) < 1.7) {
        crossedBody = true;
      }
    }
    const atDoor = system.getSnapshots().find((npc) => npc.id === 'traveler');

    expect(crossedBody).toBe(false);
    expect(atDoor?.position[0]).toBeCloseTo(-1.58, 2);
    expect(atDoor?.position[2]).toBeCloseTo(0, 2);

    system.dispose();
  });

  it('居民上下车时保持车门轨迹，并让附近行人让出落脚空间', () => {
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: [
        {
          id: 'door-side-planter',
          center: [0.12, 0.62],
          halfSize: [0.55, 0.12],
          height: 0.7,
          vaultable: false,
        },
      ],
    });
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'traveler' && snapshot.id !== 'photographer') {
        system.setResidentVisible(snapshot.id, false);
      }
    }
    system.teleportResident('traveler', [0, 0.22, 0], [1, 0, 0]);
    system.teleportResident('photographer', [0.12, 0.22, 0], [-1, 0, 0]);
    system.assignWorldTask({
      eventId: 'door-clearance',
      residentId: 'photographer',
      label: '等候乘客',
      action: 'guide',
      target: [0.12, 0.22, 0],
    });
    system.playVehicleTransition('traveler', 'entering', [0, 0.22, 0], [1, 0, 0], 10);

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.05, 0.05, 12);
    const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const photographer = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');

    expect(traveler?.position[2]).toBeCloseTo(0, 3);
    expect(
      Math.hypot(
        (traveler?.position[0] ?? 0) - (photographer?.position[0] ?? 0),
        (traveler?.position[2] ?? 0) - (photographer?.position[2] ?? 0),
      ),
    ).toBeGreaterThan(0.55);

    system.dispose();
  });

  it('角色越界时可以回到最近记录的安全位置', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const safe = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.teleportResident('traveler', [90, -12, 90], [0, 0, 1]);
    system.recover('traveler');
    const recovered = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(recovered?.position[0]).toBeCloseTo(safe?.position[0] ?? 0);
    expect(recovered?.position[2]).toBeCloseTo(safe?.position[2] ?? 0);

    system.dispose();
  });

  it('居民相遇时会停步打招呼并显示社交提示', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    system.teleportResident('traveler', [-4, 0.22, -4], [1, 0, 0]);
    system.teleportResident('photographer', [-3.25, 0.22, -4], [-1, 0, 0]);

    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 1, 0.1, 12);
    const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const photographer = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');

    expect(traveler?.motion).toBe('greet');
    expect(traveler?.socialPartner).toBe('photographer');
    expect(photographer?.socialPartner).toBe('traveler');
    expect(system.root.getObjectByName('traveler-social-marker')?.visible).toBe(true);

    system.dispose();
  });

  it('玩家靠近时居民会主动回应，车辆鸣笛时前方居民会让行', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.teleportResident('photographer', [0.8, 0.22, 0], [-1, 0, 0]);
    system.setControlled('traveler');

    system.update(signals, 0.1, 0.1, 12);
    expect(system.getSnapshots().find((snapshot) => snapshot.id === 'photographer')).toMatchObject({
      motion: 'idle',
      reaction: 'nod',
    });

    system.setControlled(null);
    system.teleportResident('photographer', [0, 0.22, 2.2], [0, 0, -1]);
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');
    const reacted = system.triggerVehicleHorn([0, 0.38, 0], [0, 0, 1]);
    system.update(signals, 0.2, 0.2, 12);
    const after = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');

    expect(reacted).toContain('photographer');
    expect(after?.reaction).toBe('yield');
    expect(after?.position[2]).toBeGreaterThan(before?.position[2] ?? 0);

    system.dispose();
  });

  it('居民让行离开人行线后平滑接回附近路段，不会瞬间跳回反应前位置', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');
    expect(before).toBeTruthy();
    if (!before) return;
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'photographer') system.setResidentVisible(snapshot.id, false);
    }
    const hornPosition: [number, number, number] = [
      before.position[0] - before.forward[0],
      0.38,
      before.position[2] - before.forward[2],
    ];
    expect(system.triggerVehicleHorn(hornPosition, before.forward)).toContain('photographer');

    let previous = before.position;
    let maximumFrameTravel = 0;
    for (let frame = 0; frame < 45; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 12);
      const current = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');
      if (!current) continue;
      maximumFrameTravel = Math.max(
        maximumFrameTravel,
        Math.hypot(current.position[0] - previous[0], current.position[2] - previous[2]),
      );
      previous = current.position;
    }

    expect(maximumFrameTravel).toBeLessThan(0.35);

    system.dispose();
    town.dispose();
  });

  it('共同完成事件会累计居民熟悉度并触发庆祝回应', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    system.recordCollaboration('traveler', 'gardener', 'greenhouse-water:finish');
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.1, 0.1, 12);

    expect(system.getRelations()).toEqual([
      expect.objectContaining({
        residents: ['gardener', 'traveler'],
        familiarity: 1,
        label: '面熟',
      }),
    ]);
    expect(system.getSnapshots().find((snapshot) => snapshot.id === 'gardener')?.reaction).toBe(
      'celebrate',
    );

    system.dispose();
  });

  it('陌生、面熟、熟人和老朋友会产生不同的靠近回应', () => {
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const stranger = createNpcSystem(getQualityProfile('high'));
    stranger.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    stranger.teleportResident('photographer', [1.4, 0.22, 0], [-1, 0, 0]);
    stranger.setControlled('traveler');
    stranger.update(signals, 0.1, 0.1, 12);
    expect(stranger.getSnapshots().find((npc) => npc.id === 'photographer')?.reaction).toBe('nod');
    stranger.dispose();

    const familiar = createNpcSystem(getQualityProfile('high'));
    familiar.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    familiar.teleportResident('photographer', [1.4, 0.22, 0], [-1, 0, 0]);
    familiar.recordCollaboration('traveler', 'photographer', 'event:1');
    familiar.setControlled('traveler');
    familiar.update(signals, 0.1, 0.1, 12);
    expect(familiar.getSnapshots().find((npc) => npc.id === 'photographer')?.reaction).toBe('wave');
    familiar.dispose();

    const friend = createNpcSystem(getQualityProfile('high'));
    friend.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    friend.teleportResident('photographer', [2, 0.22, 0], [-1, 0, 0]);
    friend.recordCollaboration('traveler', 'photographer', 'event:1');
    friend.recordCollaboration('traveler', 'photographer', 'event:2');
    friend.setControlled('traveler');
    const before = friend.getSnapshots().find((npc) => npc.id === 'photographer');
    friend.update(signals, 0.2, 0.2, 12);
    const approached = friend.getSnapshots().find((npc) => npc.id === 'photographer');
    expect(approached?.reaction).toBe('approach');
    expect(Math.abs(approached?.position[0] ?? 0)).toBeLessThan(Math.abs(before?.position[0] ?? 0));
    friend.dispose();

    const closeFriend = createNpcSystem(getQualityProfile('high'));
    closeFriend.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    closeFriend.teleportResident('photographer', [1.8, 0.22, 0], [-1, 0, 0]);
    for (let index = 0; index < 4; index += 1) {
      closeFriend.recordCollaboration('traveler', 'photographer', `event:${index}`);
    }
    closeFriend.setControlled('traveler');
    closeFriend.update(signals, 0.1, 0.1, 12);
    expect(closeFriend.getSnapshots().find((npc) => npc.id === 'photographer')?.reaction).toBe(
      'follow',
    );
    closeFriend.dispose();
  });

  it('只允许与附近空闲居民互动并触发对应关系动作', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.teleportResident('photographer', [1.2, 0.22, 0], [-1, 0, 0]);
    system.setControlled('traveler');

    expect(system.getNearestResident('traveler', 2.4)?.id).toBe('photographer');
    expect(system.triggerResidentInteraction('traveler', 'photographer')).toBe('nod');
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.1, 0.1, 12);
    expect(system.getSnapshots().find((npc) => npc.id === 'photographer')?.reaction).toBe('nod');
    expect(system.getNearestResident('traveler', 0.4)).toBeNull();

    system.dispose();
  });

  it('深夜居民进入休息日程并返回各自路线起点', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 1, 0.1, 23);
    const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(traveler?.routine).toBe('rest');

    system.dispose();
  });

  it('固定职业通勤到站后持续留在目的地，不会在同一日程下重新绕闭环', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'mechanic') system.setResidentVisible(snapshot.id, false);
    }

    let sawWalking = false;
    for (let frame = 0; frame < 1_200; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 7.8);
      const mechanic = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');
      if (!mechanic) continue;
      if (mechanic.motion === 'walk') sawWalking = true;
    }

    const arrival = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');
    expect(sawWalking).toBe(true);
    expect(arrival?.motion).toBe('idle');
    const workshop = town.pedestrianGraph.nodes.find((node) => node.id === 'workshop');
    const workshopSlot = getResidentDestinationSlotOffset('mechanic', 'commute');
    expect(workshop).toBeTruthy();
    expect(
      Math.hypot(
        (arrival?.position[0] ?? 0) - ((workshop?.position[0] ?? 0) + workshopSlot[0]),
        (arrival?.position[2] ?? 0) - ((workshop?.position[1] ?? 0) + workshopSlot[1]),
      ),
    ).toBeLessThan(0.2);

    let resumedAfterArrival = false;
    let maximumDrift = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      system.update(signals, 120 + frame * 0.1, 0.1, 7.8);
      const mechanic = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');
      if (!mechanic || !arrival) continue;
      const drift = Math.hypot(
        mechanic.position[0] - arrival.position[0],
        mechanic.position[2] - arrival.position[2],
      );
      maximumDrift = Math.max(maximumDrift, drift);
      resumedAfterArrival ||= mechanic.motion === 'walk' && drift > 0.15;
    }
    expect(resumedAfterArrival).toBe(false);
    expect(maximumDrift).toBeLessThan(0.2);

    system.dispose();
    town.dispose();
  });

  it('受控角色平滑起步、转向和停步，并暴露实际动画速度', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const traveler = system.root.getObjectByName('npc-traveler');
    system.setControlled('traveler');
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: false, jump: false });
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.1, 0.1);
    const startedSpeed = Number(traveler?.userData.motionSpeed ?? 0);

    system.setControlInput({ moveX: 1, moveZ: 0, sprint: false, jump: false });
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.2, 0.08);
    const turning = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.3, 0.08);
    const stoppingSpeed = Number(traveler?.userData.motionSpeed ?? 0);

    expect(startedSpeed).toBeGreaterThan(0);
    expect(startedSpeed).toBeLessThan(3.05);
    expect(turning?.forward[0]).toBeGreaterThan(0);
    expect(turning?.forward[2]).toBeGreaterThan(0);
    expect(stoppingSpeed).toBeGreaterThan(0);
    expect(stoppingSpeed).toBeLessThan(Number(traveler?.userData.previousMotionSpeed ?? Infinity));

    system.dispose();
  });

  it('急转时逻辑朝向跟随实际位移方向，视觉惯性只作用于模型而不叠加侧滑', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.setControlled('traveler');
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: false });
    for (let frame = 0; frame < 8; frame += 1) {
      system.update(signals, frame * 0.05, 0.05);
    }
    const beforeTurn = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    system.setControlInput({ moveX: 1, moveZ: 0, sprint: true, jump: false });
    system.update(signals, 0.45, 0.05);
    const afterTurn = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const moveX = (afterTurn?.position[0] ?? 0) - (beforeTurn?.position[0] ?? 0);
    const moveZ = (afterTurn?.position[2] ?? 0) - (beforeTurn?.position[2] ?? 0);
    const moveLength = Math.hypot(moveX, moveZ);
    const alignment =
      moveLength > 0
        ? (moveX * (afterTurn?.forward[0] ?? 0) + moveZ * (afterTurn?.forward[2] ?? 0)) / moveLength
        : 0;

    expect(alignment).toBeGreaterThan(0.998);

    system.dispose();
  });

  it('受控角色奔跑和急转会逐步改变身体重心，停步后平滑回正', () => {
    const system = createNpcSystem(getQualityProfile('high'));
    const traveler = system.root.getObjectByName('npc-traveler');
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [0, 0.22, 0], [0, 0, 1]);
    system.setControlled('traveler');
    system.setControlInput({ moveX: 0, moveZ: 1, sprint: true, jump: false });
    for (let frame = 0; frame < 8; frame += 1) {
      system.update(signals, frame * 0.05, 0.05);
    }
    const runningLean = Number(traveler?.userData.motionLeanForward ?? 0);

    system.setControlInput({ moveX: 1, moveZ: 0, sprint: true, jump: false });
    system.update(signals, 0.45, 0.05);
    const turnLean = Number(traveler?.userData.motionLeanTurn ?? 0);
    const firstTurnVelocity = Number(traveler?.userData.motionTurnVelocity ?? 0);
    system.update(signals, 0.5, 0.05);
    const secondTurnVelocity = Number(traveler?.userData.motionTurnVelocity ?? 0);

    system.setControlInput({ moveX: 0, moveZ: 0, sprint: false, jump: false });
    system.update(signals, 0.55, 0.05);
    const brakingLean = Number(traveler?.userData.motionLeanForward ?? 0);
    for (let frame = 0; frame < 18; frame += 1) {
      system.update(signals, 0.6 + frame * 0.05, 0.05);
    }
    const recoveredLean = Number(traveler?.userData.motionLeanForward ?? 0);
    const recoveredTurnVelocity = Number(traveler?.userData.motionTurnVelocity ?? 0);

    expect(runningLean).toBeGreaterThan(0.04);
    expect(turnLean).toBeGreaterThan(0);
    expect(firstTurnVelocity).toBeGreaterThan(0);
    expect(secondTurnVelocity).toBeGreaterThan(firstTurnVelocity);
    expect(brakingLean).toBeGreaterThan(0);
    expect(recoveredLean).toBeLessThan(runningLean);
    expect(recoveredLean).toBeLessThan(0.01);
    expect(Math.abs(recoveredTurnVelocity)).toBeLessThan(0.03);

    system.dispose();
  });

  it('使用人行导航图生成居民路线并把拥挤分离落实到模拟位置', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const easternResidents = system
      .getSnapshots()
      .filter((snapshot) => snapshot.id === 'florist' || snapshot.id === 'photographer');
    expect(easternResidents.every((snapshot) => snapshot.position[0] > 50)).toBe(true);
    const riversideResident = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    expect(riversideResident?.position[2]).toBeGreaterThan(50);
    system.teleportResident('traveler', [-4, 0.22, -4], [1, 0, 0]);
    system.teleportResident('photographer', [-3.7, 0.22, -4], [-1, 0, 0]);
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.1, 0.1, 12);
    system.update(deriveSceneSignals(createDefaultAmbientInputs()), 0.2, 0.1, 12);
    const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
    const photographer = system.getSnapshots().find((snapshot) => snapshot.id === 'photographer');

    expect(system.root.userData.navigationMode).toBe('pedestrian-graph');
    expect(
      Math.hypot(
        (traveler?.position[0] ?? 0) - (photographer?.position[0] ?? 0),
        (traveler?.position[2] ?? 0) - (photographer?.position[2] ?? 0),
      ),
    ).toBeGreaterThan(0.55);

    system.dispose();
    town.dispose();
  });

  it('早晨居民从当前位置直达职业目的地，不再沿完整生活环线乱绕', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const before = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');

    system.update(signals, 0.1, 0.1, 7.8);
    const after = system.getSnapshots().find((snapshot) => snapshot.id === 'mechanic');
    const scheduleRoutes = String(system.root.userData.residentScheduleRoutes ?? '');
    const firstStep = Math.hypot(
      (after?.position[0] ?? 0) - (before?.position[0] ?? 0),
      (after?.position[2] ?? 0) - (before?.position[2] ?? 0),
    );

    expect(scheduleRoutes).toMatch(/mechanic:commute:workshop:direct:\d+/);
    expect(firstStep).toBeGreaterThan(0);
    expect(firstStep).toBeLessThan(0.2);

    system.dispose();
    town.dispose();
  });

  it('完整早高峰后所有自主居民都抵达各自职业地点并停止通勤', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    for (let frame = 0; frame < 1600; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 7.8);
    }
    const nodes = new Map(town.pedestrianGraph.nodes.map((node) => [node.id, node]));
    const snapshots = new Map(system.getSnapshots().map((snapshot) => [snapshot.id, snapshot]));

    for (const profile of NPC_PROFILES.filter((profile) => profile.id !== 'traveler')) {
      const snapshot = snapshots.get(profile.id);
      const destination = nodes.get(getResidentRoutineDestinationStop(profile.id, 'commute'));
      expect(destination, profile.id).toBeTruthy();
      expect(snapshot?.motion, profile.id).not.toBe('walk');
      expect(
        Math.hypot(
          (snapshot?.position[0] ?? 0) - (destination?.position[0] ?? 0),
          (snapshot?.position[2] ?? 0) - (destination?.position[1] ?? 0),
        ),
        `${profile.id}:${snapshot?.position.join(',')}:${snapshot?.motion}:${String(system.root.userData.npcCrowdOffsets ?? '')}:${String(system.root.userData.npcRouteStates ?? '')}:${String(system.root.userData.npcCrowdAvoidance ?? '')}:${String(system.root.userData.npcCrowdTravelScales ?? '')}`,
      ).toBeLessThan(1.8);
    }

    system.dispose();
    town.dispose();
  });

  it('晚间居民直达各自休闲地点并驻足，不再沿整条生活环线来回走', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.update(signals, 0.1, 0.1, 18.5);
    expect(String(system.root.userData.residentScheduleRoutes ?? '')).toMatch(
      /mechanic:leisure:harbor:direct:\d+/,
    );

    const sampledPositions = new Map<string, readonly [number, number]>();
    const sampledDirections = new Map<string, readonly [number, number]>();
    const sampledReversals = new Map<string, number>();
    const sampledReversalEvents: string[] = [];
    let minimumDistance = Number.POSITIVE_INFINITY;
    let minimumDistanceEvent = '';
    for (let frame = 1; frame < 1800; frame += 1) {
      system.update(signals, frame * 0.1, 0.1, 18.5);
      const frameSnapshots = system.getSnapshots();
      for (let left = 0; left < frameSnapshots.length; left += 1) {
        const leftSnapshot = frameSnapshots[left];
        if (!leftSnapshot) continue;
        for (let right = left + 1; right < frameSnapshots.length; right += 1) {
          const rightSnapshot = frameSnapshots[right];
          if (!rightSnapshot) continue;
          const distance = Math.hypot(
            leftSnapshot.position[0] - rightSnapshot.position[0],
            leftSnapshot.position[2] - rightSnapshot.position[2],
          );
          if (distance < minimumDistance) {
            minimumDistance = distance;
            minimumDistanceEvent = `${leftSnapshot.id}:${rightSnapshot.id}@${frame}:${leftSnapshot.position.join(',')}:${leftSnapshot.motion}:${leftSnapshot.socialPartner ?? '-'}|${rightSnapshot.position.join(',')}:${rightSnapshot.motion}:${rightSnapshot.socialPartner ?? '-'}`;
          }
        }
      }
      if (frame % 5 !== 0) continue;
      for (const snapshot of frameSnapshots) {
        if (snapshot.id === 'traveler') continue;
        const current: readonly [number, number] = [snapshot.position[0], snapshot.position[2]];
        const previous = sampledPositions.get(snapshot.id);
        if (previous && snapshot.motion === 'walk') {
          const movement: readonly [number, number] = [
            current[0] - previous[0],
            current[1] - previous[1],
          ];
          const travel = Math.hypot(...movement);
          if (travel > 0.04) {
            const direction: readonly [number, number] = [
              movement[0] / travel,
              movement[1] / travel,
            ];
            const previousDirection = sampledDirections.get(snapshot.id);
            if (
              previousDirection &&
              direction[0] * previousDirection[0] + direction[1] * previousDirection[1] < -0.55
            ) {
              sampledReversals.set(snapshot.id, (sampledReversals.get(snapshot.id) ?? 0) + 1);
              if (sampledReversalEvents.length < 12) {
                sampledReversalEvents.push(
                  `${snapshot.id}@${frame}:${previous.join(',')}=>${current.join(',')}:${String(system.root.userData.npcRouteStates ?? '')}:${String(system.root.userData.npcCrowdOffsets ?? '')}`,
                );
              }
            }
            sampledDirections.set(snapshot.id, direction);
          }
        } else if (snapshot.motion !== 'walk') {
          sampledDirections.delete(snapshot.id);
        }
        sampledPositions.set(snapshot.id, current);
      }
    }
    const nodes = new Map(town.pedestrianGraph.nodes.map((node) => [node.id, node]));
    const snapshots = new Map(system.getSnapshots().map((snapshot) => [snapshot.id, snapshot]));
    for (const profile of NPC_PROFILES.filter((profile) => profile.id !== 'traveler')) {
      const snapshot = snapshots.get(profile.id);
      const destination = nodes.get(getResidentRoutineDestinationStop(profile.id, 'leisure'));
      expect(destination, profile.id).toBeTruthy();
      expect(snapshot?.motion, profile.id).not.toBe('walk');
      expect(
        Math.hypot(
          (snapshot?.position[0] ?? 0) - (destination?.position[0] ?? 0),
          (snapshot?.position[2] ?? 0) - (destination?.position[1] ?? 0),
        ),
        `${profile.id}:${snapshot?.position.join(',')}:${snapshot?.motion}:${String(system.root.userData.npcBasePositions ?? '')}:${String(system.root.userData.npcCrowdOffsets ?? '')}:${String(system.root.userData.npcRouteStates ?? '')}:${String(system.root.userData.npcCrowdAvoidance ?? '')}:${String(system.root.userData.npcCrowdTravelScales ?? '')}`,
      ).toBeLessThan(1.8);
    }
    expect(minimumDistance, minimumDistanceEvent).toBeGreaterThan(0.75);
    expect(
      Math.max(0, ...sampledReversals.values()),
      `${JSON.stringify(Object.fromEntries(sampledReversals))}::${sampledReversalEvents.join('::')}`,
    ).toBeLessThanOrEqual(2);

    system.dispose();
    town.dispose();
  });

  it('晚间山地路线逐帧移动连续，不会在碰撞边界左右弹跳', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const previousPositions = new Map<string, readonly [number, number]>();
    let maximumFrameTravel = 0;
    let maximumTravelEvent = '';

    for (let frame = 0; frame < 1_200; frame += 1) {
      system.update(signals, frame / 60, 1 / 60, 18.5);
      for (const snapshot of system.getSnapshots()) {
        const current: readonly [number, number] = [snapshot.position[0], snapshot.position[2]];
        const previous = previousPositions.get(snapshot.id);
        if (previous) {
          const travel = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
          if (travel > maximumFrameTravel) {
            maximumFrameTravel = travel;
            maximumTravelEvent = `${snapshot.id}@${frame}:${previous.join(',')}=>${current.join(',')}:${String(system.root.userData.npcBasePositions ?? '')}:${String(system.root.userData.npcCrowdOffsets ?? '')}`;
          }
        }
        previousPositions.set(snapshot.id, current);
      }
    }

    expect(maximumFrameTravel, maximumTravelEvent).toBeLessThan(0.12);

    system.dispose();
    town.dispose();
  });

  it('自主居民遇到路线正中的路灯会绕行，不会卡住或穿模', () => {
    const lamp = {
      id: 'test-lamp',
      center: [0, 0] as const,
      halfSize: [0.18, 0.18] as const,
      height: 2.8,
      vaultable: false,
    };
    const system = createNpcSystem(getQualityProfile('high'), { colliders: [lamp] });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    system.teleportResident('traveler', [-1.2, 0.22, 0], [1, 0, 0]);
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'traveler') system.setResidentVisible(snapshot.id, false);
    }
    system.assignWorldTask({
      eventId: 'lamp-detour',
      residentId: 'traveler',
      label: '穿过街角',
      action: 'guide',
      target: [1.2, 0.22, 0],
    });

    let minimumClearance = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 160; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
      const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');
      if (!traveler) continue;
      const outsideX = Math.abs(traveler.position[0]) - lamp.halfSize[0] - 0.42;
      const outsideZ = Math.abs(traveler.position[2]) - lamp.halfSize[1] - 0.42;
      minimumClearance = Math.min(minimumClearance, Math.max(outsideX, outsideZ));
    }
    const traveler = system.getSnapshots().find((snapshot) => snapshot.id === 'traveler');

    expect(minimumClearance).toBeGreaterThanOrEqual(-0.001);
    expect(traveler?.position[0]).toBeGreaterThan(0.8);

    system.dispose();
  });

  it('邮差往返扩展街区时不会在面包房边缘持续折返', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'courier') system.setResidentVisible(snapshot.id, false);
    }

    let previous: readonly [number, number] | null = null;
    let previousVelocity: readonly [number, number] | null = null;
    let reversals = 0;
    let bakeryBoundaryFrames = 0;
    for (let frame = 0; frame < 3000; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
      const courier = system.getSnapshots().find((snapshot) => snapshot.id === 'courier');
      if (!courier) continue;
      const current: readonly [number, number] = [courier.position[0], courier.position[2]];
      if (current[1] >= 22.28 && current[1] <= 22.34 && current[0] < -2.8) {
        bakeryBoundaryFrames += 1;
      }
      if (previous) {
        const velocity: readonly [number, number] = [
          (current[0] - previous[0]) / 0.05,
          (current[1] - previous[1]) / 0.05,
        ];
        const speed = Math.hypot(...velocity);
        if (speed > 0.12) {
          if (previousVelocity) {
            const previousSpeed = Math.hypot(...previousVelocity);
            const directionDot =
              (velocity[0] * previousVelocity[0] + velocity[1] * previousVelocity[1]) /
              (speed * previousSpeed);
            if (directionDot < -0.55) {
              reversals += 1;
            }
          }
          previousVelocity = velocity;
        }
      }
      previous = current;
    }

    expect(bakeryBoundaryFrames).toBeLessThan(40);
    expect(reversals).toBeLessThan(8);

    system.dispose();
    town.dispose();
  });

  it('邮差执行跨区取车任务时不会卡在河岸入口反复折返', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    for (const snapshot of system.getSnapshots()) {
      if (snapshot.id !== 'courier') system.setResidentVisible(snapshot.id, false);
    }
    const courierStart: readonly [number, number, number] = [-5, 0.22, 22.29];
    const parkedVehicle = scaleTownVec3([5.8, 0.38, 37.2]);
    const vehicleDoor = getClosestVehicleDoorPose(parkedVehicle, 0, courierStart);
    system.teleportResident('courier', courierStart, [0, 0, 1]);
    system.assignWorldTask({
      eventId: 'courier-cross-district-pickup',
      stageId: 'walk-to-vehicle',
      residentId: 'courier',
      label: '前往河岸停车位取车',
      action: 'drive',
      target: vehicleDoor.pose.outside,
    });

    let previous: readonly [number, number] | null = null;
    let previousVelocity: readonly [number, number] | null = null;
    let reversals = 0;
    let riverEntranceFrames = 0;
    for (let frame = 0; frame < 2400; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
      const courier = system.getSnapshots().find((snapshot) => snapshot.id === 'courier');
      if (!courier) continue;
      const current: readonly [number, number] = [courier.position[0], courier.position[2]];
      if (current[1] >= 22.2 && current[1] <= 22.4 && current[0] < -2.8) {
        riverEntranceFrames += 1;
      }
      if (previous) {
        const velocity: readonly [number, number] = [
          (current[0] - previous[0]) / 0.05,
          (current[1] - previous[1]) / 0.05,
        ];
        const speed = Math.hypot(...velocity);
        if (speed > 0.12) {
          if (previousVelocity) {
            const previousSpeed = Math.hypot(...previousVelocity);
            const directionDot =
              (velocity[0] * previousVelocity[0] + velocity[1] * previousVelocity[1]) /
              (speed * previousSpeed);
            if (directionDot < -0.55) reversals += 1;
          }
          previousVelocity = velocity;
        }
      }
      previous = current;
    }

    expect(riverEntranceFrames).toBeLessThan(40);
    expect(reversals).toBeLessThan(8);
    expect(system.getWorldTaskStatus()?.phase).toBe('working');

    system.dispose();
    town.dispose();
  });

  it('三名居民在同一窄路节点相遇后仍收敛到不重叠的位置', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    let minimumDistance = Number.POSITIVE_INFINITY;
    let minimumDistanceEvent = '';
    for (let frame = 0; frame < 240; frame += 1) {
      system.update(deriveSceneSignals(createDefaultAmbientInputs()), frame * 0.05, 0.05, 12);
      const snapshots = system.getSnapshots();
      snapshots.forEach((left, index) => {
        snapshots.slice(index + 1).forEach((right) => {
          const distance = Math.hypot(
            left.position[0] - right.position[0],
            left.position[2] - right.position[2],
          );
          if (distance < minimumDistance) {
            minimumDistance = distance;
            minimumDistanceEvent = `${left.id}:${right.id}@${frame}:${left.position.join(',')}|${right.position.join(',')}:${String(system.root.userData.npcBasePositions ?? '')}:${String(system.root.userData.npcCrowdOffsets ?? '')}`;
          }
        });
      });
    }

    expect(minimumDistance, minimumDistanceEvent).toBeGreaterThan(0.6);

    system.dispose();
    town.dispose();
  });

  it('全体居民长时间巡游不会连续急转掉头或单帧弹跳', () => {
    const town = createGroundTown();
    const system = createNpcSystem(getQualityProfile('high'), {
      colliders: town.colliders,
      pedestrianGraph: town.pedestrianGraph,
    });
    const signals = deriveSceneSignals(createDefaultAmbientInputs());
    const previousPositions = new Map<string, readonly [number, number]>();
    const previousVelocities = new Map<string, readonly [number, number]>();
    const reversals = new Map<string, number>();
    const reversalEvents: string[] = [];
    let maximumFrameTravel = 0;
    let maximumTravelEvent = '';

    for (let frame = 0; frame < 1_200; frame += 1) {
      system.update(signals, frame * 0.05, 0.05, 12);
      for (const snapshot of system.getSnapshots()) {
        const current: readonly [number, number] = [snapshot.position[0], snapshot.position[2]];
        const previous = previousPositions.get(snapshot.id);
        if (previous) {
          const movement: readonly [number, number] = [
            current[0] - previous[0],
            current[1] - previous[1],
          ];
          const travel = Math.hypot(...movement);
          if (travel > maximumFrameTravel) {
            maximumFrameTravel = travel;
            maximumTravelEvent = `${snapshot.id}@${frame}:${previous.join(',')}=>${current.join(',')}:${snapshot.activity}:${snapshot.motion}`;
          }
          if (travel > 0.05) {
            const velocity: readonly [number, number] = [
              movement[0] / travel,
              movement[1] / travel,
            ];
            const previousVelocity = previousVelocities.get(snapshot.id);
            if (
              previousVelocity &&
              velocity[0] * previousVelocity[0] + velocity[1] * previousVelocity[1] < -0.55
            ) {
              reversals.set(snapshot.id, (reversals.get(snapshot.id) ?? 0) + 1);
              if (reversalEvents.length < 12) {
                reversalEvents.push(
                  `${snapshot.id}@${frame}:${previous.join(',')}=>${current.join(',')}:${String(system.root.userData.npcCrowdOffsets ?? '')}:${String(system.root.userData.npcCrowdAvoidance ?? '')}`,
                );
              }
            }
            previousVelocities.set(snapshot.id, velocity);
          } else {
            previousVelocities.delete(snapshot.id);
          }
        }
        previousPositions.set(snapshot.id, current);
      }
    }

    expect(maximumFrameTravel, maximumTravelEvent).toBeLessThan(0.35);
    expect(
      Math.max(0, ...reversals.values()),
      `${[...reversals.entries()].map(([id, count]) => `${id}:${count}`).join('|')}::${reversalEvents.join('::')}`,
    ).toBeLessThanOrEqual(2);

    system.dispose();
    town.dispose();
  });
});
