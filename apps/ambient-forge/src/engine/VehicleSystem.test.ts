import { describe, expect, it } from 'vitest';
import type { NpcSnapshot } from '../core/npc';
import type { VehicleId } from '../core/playable-world';
import { TOWN_LAYOUT_SCALE } from '../core/town-layout';
import type { NavigationGraph } from '../core/town-navigation';
import { getOrientedVehicleOverlap } from '../core/town-traffic';
import { createGroundTown } from './createGroundTown';
import { createVehicleSystem } from './VehicleSystem';

describe('VehicleSystem', () => {
  it('装配九辆分布在七个街区的车辆并能找到居民附近的空车', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    expect(vehicles.root.getObjectByName('vehicle-copper')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-sage')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-cream')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-navy')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-amber')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-teal')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-rose')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-slate')).toBeTruthy();
    expect(vehicles.root.getObjectByName('vehicle-sand')).toBeTruthy();
    expect(vehicles.getSnapshots()).toHaveLength(9);
    expect(vehicles.getSnapshots().filter((vehicle) => vehicle.status === 'traffic')).toHaveLength(
      6,
    );
    expect(
      vehicles.getNearestVehicle([-9 * TOWN_LAYOUT_SCALE, 0, -4.5 * TOWN_LAYOUT_SCALE], 3)?.id,
    ).toBe('copper');

    vehicles.dispose();
    town.dispose();
  });

  it('所有移动中的车辆都有可见驾驶员，停稳空车不保留驾驶员', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const traffic = vehicles.getSnapshots().filter((vehicle) => vehicle.status === 'traffic');

    expect(traffic.every((vehicle) => Boolean(vehicle.driverId))).toBe(true);
    for (const vehicle of traffic) {
      expect(vehicles.root.getObjectByName(`${vehicle.id}-driver`)?.visible).toBe(true);
    }
    expect(vehicles.getSnapshot('copper')?.driverId).toBeNull();
    expect(vehicles.root.getObjectByName('copper-driver')?.visible).toBe(false);

    vehicles.setControlled('copper', 'traveler');
    vehicles.update(0.1);
    expect(vehicles.getSnapshot('copper')?.driverId).toBe('traveler');
    expect(vehicles.root.getObjectByName('copper-driver')?.visible).toBe(true);

    vehicles.requestAutopark('copper');
    expect(vehicles.getSnapshot('copper')?.driverId).toBe('copper-valet');
    for (let index = 0; index < 600; index += 1) vehicles.update(0.1);
    expect(vehicles.getSnapshot('copper')?.status).toBe('parked');
    expect(vehicles.getSnapshot('copper')?.driverId).toBeNull();
    expect(vehicles.root.getObjectByName('copper-driver')?.visible).toBe(false);

    vehicles.dispose();
    town.dispose();
  });

  it('居民步行取车期间会预约空车，玩家不能抢占且车内不会提前出现驾驶员', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const copper = vehicles.getSnapshot('copper');
    expect(copper).toBeTruthy();
    if (!copper) return;

    vehicles.reserveForResident('copper', 'courier');

    expect(vehicles.getSnapshot('copper')?.reservedBy).toBe('courier');
    expect(vehicles.getSnapshot('copper')?.driverId).toBeNull();
    expect(vehicles.root.getObjectByName('copper-driver')?.visible).toBe(false);
    expect(vehicles.getNearestVehicle(copper.position, 3)).toBeNull();

    vehicles.reserveForResident('copper', null);
    expect(vehicles.getNearestVehicle(copper.position, 3)?.id).toBe('copper');

    vehicles.dispose();
    town.dispose();
  });

  it('居民驾驶任务会显示对应驾驶员，并由同一居民完成自动泊车', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const target = town.parkingSpots.find((spot) => spot.id === 'south-market');
    expect(target).toBeTruthy();
    if (!target) return;

    vehicles.assignWorldTask({
      eventId: 'resident-trip',
      stageId: 'drive',
      vehicleId: 'copper',
      driverId: 'courier',
      label: '前往河岸市场送件',
      action: 'drive',
      target: [target.position[0], 0.38, target.position[1]],
    });
    expect(vehicles.getSnapshot('copper')?.driverId).toBe('courier');
    expect(vehicles.root.getObjectByName('copper-driver')?.visible).toBe(true);

    vehicles.assignWorldTask(null);
    vehicles.requestAutopark('copper', 'courier');
    expect(vehicles.getSnapshot('copper')?.driverId).toBe('courier');

    vehicles.dispose();
    town.dispose();
  });

  it('受控车辆响应油门和转向，并提供车后方第三人称镜头', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const before = vehicles.getSnapshot('copper');

    vehicles.setControlled('copper');
    vehicles.setControlInput({ throttle: 1, steer: 0.65, brake: false });
    vehicles.update(0.6);
    const after = vehicles.getSnapshot('copper');
    const pose = vehicles.getCameraPose('copper');

    expect(after?.position).not.toEqual(before?.position);
    expect(after?.heading).not.toBe(before?.heading);
    expect(pose?.position[1]).toBeGreaterThan((after?.position[1] ?? 0) + 2);
    expect(pose?.fov).toBeGreaterThanOrEqual(42);

    vehicles.dispose();
    town.dispose();
  });

  it('自动车辆转弯时沿车头方向推进，不会车身尚未转正就横向平移', () => {
    const vehicles = createVehicleSystem([], []);
    const before = vehicles.getSnapshot('copper');
    expect(before).toBeTruthy();
    if (!before) return;
    vehicles.assignWorldTask({
      eventId: 'turn-alignment',
      stageId: 'drive',
      vehicleId: 'copper',
      label: '驶入侧向道路',
      action: 'drive',
      target: [before.position[0] + 12, before.position[1], before.position[2]],
    });

    vehicles.update(0.1);
    const after = vehicles.getSnapshot('copper');
    const moveX = (after?.position[0] ?? before.position[0]) - before.position[0];
    const moveZ = (after?.position[2] ?? before.position[2]) - before.position[2];
    const movementHeading = Math.atan2(moveX, moveZ);

    expect(Math.hypot(moveX, moveZ)).toBeGreaterThan(0.01);
    expect(Math.cos(movementHeading - (after?.heading ?? 0))).toBeGreaterThan(0.98);

    vehicles.dispose();
  });

  it('释放道路中的车辆后会回到最近停车点并停止', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    vehicles.setControlled('sage');
    vehicles.setControlInput({ throttle: 1, steer: 0, brake: false });
    vehicles.update(0.8);
    vehicles.requestAutopark('sage');
    for (let index = 0; index < 80; index += 1) vehicles.update(0.25);

    const parked = vehicles.getSnapshot('sage');
    expect(parked?.status).toBe('parked');
    expect(parked?.speed).toBeCloseTo(0);

    vehicles.dispose();
    town.dispose();
  });

  it('两辆交通车辆会沿道路网络持续巡行并保持安全车距', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const navyBefore = vehicles.getSnapshot('navy');

    for (let index = 0; index < 240; index += 1) vehicles.update(1 / 30);

    const navy = vehicles.getSnapshot('navy');
    const amber = vehicles.getSnapshot('amber');
    expect(navy?.status).toBe('traffic');
    expect(amber?.status).toBe('traffic');
    expect(navy?.position).not.toEqual(navyBefore?.position);
    expect(
      Math.hypot(
        (navy?.position[0] ?? 0) - (amber?.position[0] ?? 0),
        (navy?.position[2] ?? 0) - (amber?.position[2] ?? 0),
      ),
    ).toBeGreaterThan(2.4);

    vehicles.dispose();
    town.dispose();
  });

  it('车辆长时间巡行后车头角度保持归一化，不持续累积到高精度风险区', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    for (let frame = 0; frame < 1_800; frame += 1) vehicles.update(0.1);

    expect(
      Math.max(...vehicles.getSnapshots().map((vehicle) => Math.abs(vehicle.heading))),
    ).toBeLessThanOrEqual(Math.PI);

    vehicles.dispose();
    town.dispose();
  });

  it('六辆交通车连续运行三分钟不会死锁、反向弹回或车身重叠', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const trafficIds = vehicles
      .getSnapshots()
      .filter((vehicle) => vehicle.status === 'traffic')
      .map((vehicle) => vehicle.id);
    const previousPositions = new Map<VehicleId, readonly [number, number]>();
    const previousDirections = new Map<VehicleId, readonly [number, number]>();
    const totalDistances = new Map<VehicleId, number>();
    const stoppedRuns = new Map<VehicleId, number>();
    const longestStops = new Map<VehicleId, number>();
    const reversals = new Map<VehicleId, number>();
    const reversalEvents = new Map<VehicleId, string[]>();
    let maximumOverlap = 0;
    let maximumOverlapPair = '';
    let maximumFrameTravel = 0;
    let maximumFrameTravelEvent = '';
    let maximumLateralTravel = 0;
    let maximumLateralTravelEvent = '';

    for (let frame = 0; frame < 1_800; frame += 1) {
      vehicles.update(0.1);
      const snapshots = vehicles.getSnapshots();
      for (const snapshot of snapshots) {
        if (!trafficIds.includes(snapshot.id)) continue;
        const current: readonly [number, number] = [snapshot.position[0], snapshot.position[2]];
        const previous = previousPositions.get(snapshot.id);
        if (previous) {
          const movement: readonly [number, number] = [
            current[0] - previous[0],
            current[1] - previous[1],
          ];
          const travel = Math.hypot(...movement);
          const lateralTravel = Math.abs(
            movement[0] * Math.cos(snapshot.heading) - movement[1] * Math.sin(snapshot.heading),
          );
          if (travel > maximumFrameTravel) {
            maximumFrameTravel = travel;
            maximumFrameTravelEvent = `${snapshot.id}@${frame}:${travel.toFixed(3)}:${snapshot.speed.toFixed(2)}:${snapshot.laneMode}`;
          }
          if (lateralTravel > maximumLateralTravel) {
            maximumLateralTravel = lateralTravel;
            maximumLateralTravelEvent = `${snapshot.id}@${frame}:${lateralTravel.toFixed(3)}:${snapshot.heading.toFixed(2)}:${snapshot.laneMode}`;
          }
          totalDistances.set(snapshot.id, (totalDistances.get(snapshot.id) ?? 0) + travel);
          if (travel > 0.02) {
            const direction: readonly [number, number] = [
              movement[0] / travel,
              movement[1] / travel,
            ];
            const previousDirection = previousDirections.get(snapshot.id);
            if (
              previousDirection &&
              direction[0] * previousDirection[0] + direction[1] * previousDirection[1] < -0.55
            ) {
              reversals.set(snapshot.id, (reversals.get(snapshot.id) ?? 0) + 1);
              reversalEvents.set(snapshot.id, [
                ...(reversalEvents.get(snapshot.id) ?? []),
                `${frame}:${current[0].toFixed(2)},${current[1].toFixed(2)}:${snapshot.heading.toFixed(2)}:${snapshot.laneMode}:from=${previousDirection[0].toFixed(2)},${previousDirection[1].toFixed(2)}:to=${direction[0].toFixed(2)},${direction[1].toFixed(2)}:speed=${snapshot.speed.toFixed(2)}`,
              ]);
            }
            previousDirections.set(snapshot.id, direction);
          }
        }
        previousPositions.set(snapshot.id, current);
        const stopped = Math.abs(snapshot.speed) < 0.08;
        const stoppedSeconds = stopped ? (stoppedRuns.get(snapshot.id) ?? 0) + 0.1 : 0;
        stoppedRuns.set(snapshot.id, stoppedSeconds);
        longestStops.set(snapshot.id, Math.max(longestStops.get(snapshot.id) ?? 0, stoppedSeconds));
      }
      snapshots.forEach((left, index) => {
        snapshots.slice(index + 1).forEach((right) => {
          const overlap = getOrientedVehicleOverlap(
            { position: [left.position[0], left.position[2]], heading: left.heading },
            { position: [right.position[0], right.position[2]], heading: right.heading },
          );
          if ((overlap?.depth ?? 0) > maximumOverlap) {
            maximumOverlap = overlap?.depth ?? 0;
            maximumOverlapPair = `${left.id}:${right.id}@${frame}`;
          }
        });
      });
    }

    const metrics = Object.fromEntries(
      trafficIds.map((id) => [
        id,
        {
          distance: totalDistances.get(id) ?? 0,
          longestStop: longestStops.get(id) ?? 0,
          reversals: reversals.get(id) ?? 0,
          reversalEvents: reversalEvents.get(id) ?? [],
        },
      ]),
    );
    expect(maximumOverlap, maximumOverlapPair).toBeLessThan(0.05);
    expect(maximumFrameTravel, maximumFrameTravelEvent).toBeLessThan(0.62);
    expect(maximumLateralTravel, maximumLateralTravelEvent).toBeLessThan(0.09);
    expect(
      Math.min(...Object.values(metrics).map((metric) => metric.distance)),
      JSON.stringify(metrics),
    ).toBeGreaterThan(80);
    expect(
      Math.max(...Object.values(metrics).map((metric) => metric.longestStop)),
      JSON.stringify(metrics),
    ).toBeLessThan(18);
    expect(
      Math.max(...Object.values(metrics).map((metric) => metric.reversals)),
      JSON.stringify(metrics),
    ).toBeLessThanOrEqual(2);

    vehicles.dispose();
    town.dispose();
  });

  it('两辆交通车辆从相交方向同时抵达路口时只放行一辆', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const intersectionX = -12 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('navy', [intersectionX, 0.38, 3 * TOWN_LAYOUT_SCALE], Math.PI);
    vehicles.teleportVehicle(
      'amber',
      [intersectionX - 3 * TOWN_LAYOUT_SCALE, 0.38, 0],
      Math.PI / 2,
    );

    vehicles.update(0.1);

    expect(vehicles.getSnapshot('amber')?.speed).toBeGreaterThan(0.1);
    expect(vehicles.getSnapshot('navy')?.speed).toBeLessThan(0.02);

    vehicles.dispose();
    town.dispose();
  });

  it('右侧车道被静止车辆阻挡时，交通车辆会安全借道并在超过后回正', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const roadZ = -8 * TOWN_LAYOUT_SCALE;
    const rightLaneZ = roadZ + 0.86 * TOWN_LAYOUT_SCALE;
    const blockerX = -5 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('copper', [blockerX, 0.38, rightLaneZ], Math.PI / 2);

    let sawPassing = false;
    let returnedRight = false;
    let minimumDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < 500; index += 1) {
      vehicles.update(0.05);
      const navy = vehicles.getSnapshot('navy');
      const blocker = vehicles.getSnapshot('copper');
      if (!navy || !blocker) continue;
      sawPassing ||= navy.laneMode === 'passing';
      minimumDistance = Math.min(
        minimumDistance,
        Math.hypot(navy.position[0] - blocker.position[0], navy.position[2] - blocker.position[2]),
      );
      if (sawPassing && navy.laneMode === 'right' && navy.position[0] > blockerX + 3) {
        returnedRight = true;
        break;
      }
    }

    expect(sawPassing).toBe(true);
    expect(returnedRight).toBe(true);
    expect(minimumDistance).toBeGreaterThanOrEqual(2.6);

    vehicles.dispose();
    town.dispose();
  });

  it('车辆已经发生重叠时会主动分离并恢复安全间距', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    vehicles.teleportVehicle('navy', [0, 0.38, -8 * TOWN_LAYOUT_SCALE], 0);
    vehicles.teleportVehicle('amber', [0.3, 0.38, -8 * TOWN_LAYOUT_SCALE], Math.PI);

    for (let index = 0; index < 20; index += 1) vehicles.update(0.1);

    const navy = vehicles.getSnapshot('navy');
    const amber = vehicles.getSnapshot('amber');
    expect(navy).toBeTruthy();
    expect(amber).toBeTruthy();
    if (navy && amber) {
      const overlap = getOrientedVehicleOverlap(
        { position: [navy.position[0], navy.position[2]], heading: navy.heading },
        { position: [amber.position[0], amber.position[2]], heading: amber.heading },
      );
      expect(overlap?.depth ?? 0).toBeLessThan(0.01);
    }

    vehicles.dispose();
    town.dispose();
  });

  it('自动车辆重叠兜底沿各自车身前后退让，不横向弹开', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const roadX = -12 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('navy', [roadX, 0.38, 0], 0);
    vehicles.teleportVehicle('amber', [roadX + 0.2, 0.38, 0.2], Math.PI / 2);
    const navyBefore = vehicles.getSnapshot('navy');
    const amberBefore = vehicles.getSnapshot('amber');

    vehicles.update(0.1);

    const navy = vehicles.getSnapshot('navy');
    const amber = vehicles.getSnapshot('amber');
    expect(Math.abs((navy?.position[0] ?? 0) - (navyBefore?.position[0] ?? 0))).toBeLessThan(0.04);
    expect(Math.abs((amber?.position[2] ?? 0) - (amberBefore?.position[2] ?? 0))).toBeLessThan(
      0.04,
    );

    vehicles.dispose();
    town.dispose();
  });

  it('玩家车辆碰到静止车时沿车身轴平滑退让，不横向瞬移也不推动静止车', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const roadZ = -8 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('copper', [0, 0.38, roadZ], 0);
    vehicles.teleportVehicle('sage', [0, 0.38, roadZ + 2.4], 0);
    vehicles.setControlled('copper', 'traveler');
    vehicles.setControlInput({ throttle: 0, steer: 0, brake: true });

    vehicles.update(0.1);

    expect(vehicles.getSnapshot('copper')?.position[0]).toBeCloseTo(0, 3);
    expect(vehicles.getSnapshot('copper')?.position[2]).toBeGreaterThan(roadZ - 0.16);
    expect(vehicles.getSnapshot('sage')?.position[2]).toBeCloseTo(roadZ + 2.4, 3);

    for (let index = 0; index < 16; index += 1) vehicles.update(0.1);
    expect(
      (vehicles.getSnapshot('sage')?.position[2] ?? 0) -
        (vehicles.getSnapshot('copper')?.position[2] ?? 0),
    ).toBeGreaterThan(3.05);

    vehicles.dispose();
    town.dispose();
  });

  it('离开视野的弃置车辆会在四十五秒后自行驶向停车位', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    vehicles.setControlled('copper');
    vehicles.setControlInput({ throttle: 1, steer: 0.4, brake: false });
    for (let index = 0; index < 25; index += 1) vehicles.update(0.1);
    vehicles.setControlled(null);
    const abandoned = vehicles.getSnapshot('copper');
    for (let index = 0; index < 520; index += 1) vehicles.update(0.1, [80, 8, 80]);

    const recovered = vehicles.getSnapshot('copper');
    expect(recovered?.position).not.toEqual(abandoned?.position);
    expect(
      Math.min(
        ...town.parkingSpots.map((spot) =>
          Math.hypot(
            spot.position[0] - (recovered?.position[0] ?? 0),
            spot.position[1] - (recovered?.position[2] ?? 0),
          ),
        ),
      ),
    ).toBeLessThan(0.3);

    vehicles.dispose();
    town.dispose();
  });

  it('上下车时车门会完成打开再关闭的完整动作', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const door = vehicles.root.getObjectByName('copper-left-door');
    const passengerDoor = vehicles.root.getObjectByName('copper-right-door');

    vehicles.playDoorTransition('copper', 0.72, 'left');
    vehicles.update(0.2);
    expect(Math.abs(door?.rotation.y ?? 0)).toBeGreaterThan(0.2);
    expect(passengerDoor?.rotation.y).toBeCloseTo(0, 3);
    for (let index = 0; index < 8; index += 1) vehicles.update(0.1);
    expect(door?.rotation.y).toBeCloseTo(0, 2);

    vehicles.dispose();
    town.dispose();
  });

  it('后车靠近前车时保持连续停车，不会把前车强制推走', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    vehicles.teleportVehicle('copper', [0, 0.38, 0], 0);
    vehicles.teleportVehicle('sage', [0, 0.38, 3], 0);
    vehicles.setControlled('copper');
    vehicles.setControlInput({ throttle: 1, steer: 0, brake: false });

    for (let frame = 0; frame < 40; frame += 1) vehicles.update(0.1);
    const rear = vehicles.getSnapshot('copper');
    const front = vehicles.getSnapshot('sage');

    expect(front?.position[0]).toBeCloseTo(0, 3);
    expect(front?.position[2]).toBeCloseTo(3, 3);
    expect((rear?.position[2] ?? 0) <= 0.41).toBe(true);
    expect((front?.position[2] ?? 0) - (rear?.position[2] ?? 0)).toBeGreaterThanOrEqual(2.59);

    vehicles.dispose();
    town.dispose();
  });

  it('长时间跟随临时停车的任务车辆时留在原行驶方向，不突然掉头', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const roadZ = -8 * TOWN_LAYOUT_SCALE + 0.86 * TOWN_LAYOUT_SCALE;
    const navyStartX = -12 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('navy', [navyStartX, 0.38, roadZ], Math.PI / 2);
    vehicles.teleportVehicle('copper', [-9 * TOWN_LAYOUT_SCALE, 0.38, roadZ], Math.PI / 2);
    vehicles.setControlled('copper', 'traveler');
    vehicles.setControlInput({ throttle: 0, steer: 0, brake: true });

    let minimumNavyX = navyStartX;
    for (let frame = 0; frame < 90; frame += 1) {
      vehicles.update(0.1);
      minimumNavyX = Math.min(minimumNavyX, vehicles.getSnapshot('navy')?.position[0] ?? 0);
    }
    const navy = vehicles.getSnapshot('navy');

    expect(minimumNavyX).toBeGreaterThanOrEqual(navyStartX - 1.5);
    expect(Math.cos((navy?.heading ?? 0) - Math.PI / 2)).toBeGreaterThan(0.5);

    vehicles.dispose();
    town.dispose();
  });

  it('前车持续停在车道中时等待后直接安全借道，不先倒车再突然横移', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const roadZ = -8 * TOWN_LAYOUT_SCALE + 0.86 * TOWN_LAYOUT_SCALE;
    vehicles.teleportVehicle('navy', [-12 * TOWN_LAYOUT_SCALE, 0.38, roadZ], Math.PI / 2);
    vehicles.teleportVehicle('copper', [-9 * TOWN_LAYOUT_SCALE, 0.38, roadZ], Math.PI / 2);
    vehicles.setControlled('copper', 'traveler');
    vehicles.setControlInput({ throttle: 0, steer: 0, brake: true });

    let minimumSpeed = Number.POSITIVE_INFINITY;
    let sawPassing = false;
    for (let frame = 0; frame < 160; frame += 1) {
      vehicles.update(0.1);
      const navy = vehicles.getSnapshot('navy');
      minimumSpeed = Math.min(minimumSpeed, navy?.speed ?? 0);
      sawPassing ||= navy?.laneMode === 'passing';
    }

    expect(minimumSpeed).toBeGreaterThanOrEqual(0);
    expect(sawPassing).toBe(true);

    vehicles.dispose();
    town.dispose();
  });

  it('道路车辆探测到前方行人后会主动减速停车', () => {
    const town = createGroundTown();
    const clearRoad = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const crossing = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const clearPlayer = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const safePlayer = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    const pedestrian = {
      id: 'traveler',
      position: [-12 * TOWN_LAYOUT_SCALE + 2.1, 0.22, -8 * TOWN_LAYOUT_SCALE],
    } as NpcSnapshot;
    const playerPedestrian = {
      id: 'traveler',
      position: [-9.3 * TOWN_LAYOUT_SCALE, 0.22, -4.5 * TOWN_LAYOUT_SCALE + 2.1],
    } as NpcSnapshot;

    clearRoad.update(0.1, undefined, []);
    crossing.update(0.1, undefined, [pedestrian]);

    expect(crossing.getSnapshot('navy')?.speed).toBeLessThan(
      clearRoad.getSnapshot('navy')?.speed ?? 0,
    );

    clearPlayer.setControlled('copper');
    safePlayer.setControlled('copper');
    clearPlayer.setControlInput({ throttle: 1, steer: 0, brake: false });
    safePlayer.setControlInput({ throttle: 1, steer: 0, brake: false });
    for (let index = 0; index < 6; index += 1) {
      clearPlayer.update(0.1, undefined, []);
      safePlayer.update(0.1, undefined, [playerPedestrian]);
    }
    expect(safePlayer.getSnapshot('copper')?.speed).toBeLessThan(
      clearPlayer.getSnapshot('copper')?.speed ?? 0,
    );

    clearRoad.dispose();
    crossing.dispose();
    clearPlayer.dispose();
    safePlayer.dispose();
    town.dispose();
  });

  it('玩家车辆不会穿过其他车辆，自动泊车会在车位前减速并对齐', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    vehicles.teleportVehicle('copper', [0, 0.38, 0], 0);
    vehicles.teleportVehicle('sage', [0, 0.38, 3], 0);
    vehicles.setControlled('copper');
    vehicles.setControlInput({ throttle: 1, steer: 0, brake: false });
    for (let index = 0; index < 30; index += 1) vehicles.update(0.1);
    const copper = vehicles.getSnapshot('copper');
    const sage = vehicles.getSnapshot('sage');

    expect(
      Math.hypot(
        (copper?.position[0] ?? 0) - (sage?.position[0] ?? 0),
        (copper?.position[2] ?? 0) - (sage?.position[2] ?? 0),
      ),
    ).toBeGreaterThanOrEqual(2.25);
    expect(Math.abs(copper?.speed ?? 0)).toBeLessThan(0.4);

    vehicles.teleportVehicle('sage', [16, 0.38, 0], -Math.PI / 2);
    vehicles.requestAutopark('sage');
    let finalApproachSpeed = Number.POSITIVE_INFINITY;
    for (let index = 0; index < 240; index += 1) {
      vehicles.update(0.1);
      const snapshot = vehicles.getSnapshot('sage');
      const nearest = Math.min(
        ...town.parkingSpots.map((spot) =>
          Math.hypot(
            spot.position[0] - (snapshot?.position[0] ?? 0),
            spot.position[1] - (snapshot?.position[2] ?? 0),
          ),
        ),
      );
      if (nearest < 1.2 && snapshot?.status === 'autoparking') {
        finalApproachSpeed = Math.min(finalApproachSpeed, Math.abs(snapshot.speed));
      }
    }
    expect(finalApproachSpeed).toBeLessThan(2);
    expect(vehicles.getSnapshot('sage')?.status).toBe('parked');

    vehicles.dispose();
    town.dispose();
  });

  it('自动泊车沿车位朝向驶入，停稳状态切换时不会瞬间旋转车身', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);
    vehicles.teleportVehicle('copper', [0, 0.38, 45], 0);
    vehicles.requestAutopark('copper');

    let transitionHeadingDelta = Number.POSITIVE_INFINITY;
    let maximumAutoparkHeadingDelta = 0;
    let previous = vehicles.getSnapshot('copper');
    for (let frame = 0; frame < 600; frame += 1) {
      vehicles.update(0.1);
      const current = vehicles.getSnapshot('copper');
      if (previous?.status === 'autoparking' && current?.status === 'autoparking') {
        maximumAutoparkHeadingDelta = Math.max(
          maximumAutoparkHeadingDelta,
          Math.abs(
            Math.atan2(
              Math.sin(current.heading - previous.heading),
              Math.cos(current.heading - previous.heading),
            ),
          ),
        );
      }
      if (previous?.status === 'autoparking' && current?.status === 'parked') {
        transitionHeadingDelta = Math.abs(
          Math.atan2(
            Math.sin(current.heading - previous.heading),
            Math.cos(current.heading - previous.heading),
          ),
        );
        break;
      }
      previous = current;
    }

    expect(vehicles.getSnapshot('copper')?.status).toBe('parked');
    expect(maximumAutoparkHeadingDelta).toBeLessThanOrEqual(0.221);
    expect(transitionHeadingDelta).toBeLessThanOrEqual(0.181);

    vehicles.dispose();
    town.dispose();
  });

  it('居民任务车在长直路上驶入右侧车道，不长时间占用道路中线', () => {
    const laneGraph: NavigationGraph = {
      nodes: [
        { id: 'south', position: [0, 0], neighbors: ['north'] },
        { id: 'north', position: [0, 20], neighbors: ['south'] },
      ],
    };
    const vehicles = createVehicleSystem([], [], laneGraph);
    vehicles.teleportVehicle('copper', [0, 0.38, 0], 0);
    vehicles.assignWorldTask({
      eventId: 'resident-trip:lane-test',
      stageId: 'drive',
      vehicleId: 'copper',
      driverId: 'courier',
      label: '前往北侧停车点',
      action: 'drive',
      target: [0, 0.38, 20],
    });

    for (let frame = 0; frame < 25; frame += 1) vehicles.update(0.1);
    const mission = vehicles.getSnapshot('copper');

    expect(mission?.status).toBe('mission');
    expect(mission?.position[0]).toBeLessThan(-0.2);
    expect(mission?.position[2]).toBeGreaterThan(4);

    vehicles.dispose();
  });

  it('事件车辆会沿道路前往任务点，完成后恢复原来的交通或停车身份', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    vehicles.assignWorldTask({
      eventId: 'harbor-cargo',
      stageId: 'greenhouse-transfer',
      vehicleId: 'cream',
      label: '运送温室补给',
      action: 'drive',
      target: [16, 0.38, 0],
    });
    for (let index = 0; index < 600; index += 1) vehicles.update(0.1);
    const arrived = vehicles.getSnapshot('cream');

    expect(arrived?.status).toBe('mission');
    expect(
      vehicles.getWorldTaskStatus()?.distance,
      JSON.stringify({ arrived, task: vehicles.getWorldTaskStatus() }),
    ).toBeLessThan(0.8);
    expect(vehicles.getWorldTaskStatus()).toMatchObject({
      eventId: 'harbor-cargo',
      stageId: 'greenhouse-transfer',
      vehicleId: 'cream',
      phase: 'working',
    });
    expect(Math.hypot((arrived?.position[0] ?? 0) - 16, arrived?.position[2] ?? 0)).toBeLessThan(
      0.8,
    );

    vehicles.assignWorldTask(null);
    expect(vehicles.getSnapshot('cream')?.status).toBe('traffic');
    expect(vehicles.getWorldTaskStatus()).toBeNull();

    vehicles.assignWorldTask({
      eventId: 'roadside-repair',
      stageId: 'workshop-tow',
      vehicleId: 'sage',
      label: '拖离港口主路',
      action: 'tow',
      target: [-14, 0.38, 0],
    });
    for (let index = 0; index < 600; index += 1) vehicles.update(0.1);
    expect(
      vehicles.getWorldTaskStatus(),
      JSON.stringify({
        sage: vehicles.getSnapshot('sage'),
        intersection: {
          id: vehicles.root.getObjectByName('vehicle-sage')?.userData.intersectionId,
          priority: vehicles.root.getObjectByName('vehicle-sage')?.userData.intersectionPriority,
        },
        vehicles: vehicles.getSnapshots(),
      }),
    ).toMatchObject({
      eventId: 'roadside-repair',
      vehicleId: 'sage',
      phase: 'working',
    });
    vehicles.assignWorldTask(null);
    expect(vehicles.getSnapshot('sage')?.status).toBe('autoparking');
    for (let index = 0; index < 600; index += 1) vehicles.update(0.1);
    const reparked = vehicles.getSnapshot('sage');
    expect(reparked?.status).toBe('parked');
    expect(
      Math.min(
        ...town.parkingSpots.map((spot) =>
          Math.hypot(
            spot.position[0] - (reparked?.position[0] ?? 0),
            spot.position[1] - (reparked?.position[2] ?? 0),
          ),
        ),
      ),
    ).toBeLessThan(0.3);

    vehicles.dispose();
    town.dispose();
  });

  it('车辆任务会显示货物、乘客或拖车装置并在任务结束后淡出', () => {
    const town = createGroundTown();
    const vehicles = createVehicleSystem(town.colliders, town.parkingSpots, town.vehicleGraph);

    vehicles.assignWorldTask({
      eventId: 'harbor-cargo',
      stageId: 'greenhouse-transfer',
      vehicleId: 'cream',
      label: '运送温室补给',
      action: 'drive',
      target: [16, 0.38, 0],
    });
    vehicles.update(0.1);
    expect(vehicles.root.getObjectByName('cream-mission-cargo')?.visible).toBe(true);
    expect(vehicles.root.getObjectByName('vehicle-cream')?.userData.missionVisual).toBe('cargo');

    vehicles.assignWorldTask({
      eventId: 'plaza-escort',
      stageId: 'visitor-transfer',
      vehicleId: 'amber',
      label: '接送访客',
      action: 'drive',
      target: [4, 0.38, 0],
    });
    vehicles.update(0.1);
    expect(vehicles.root.getObjectByName('amber-mission-passenger')?.visible).toBe(true);

    vehicles.assignWorldTask({
      eventId: 'roadside-repair',
      stageId: 'workshop-tow',
      vehicleId: 'sage',
      label: '拖离港口主路',
      action: 'tow',
      target: [-14, 0.38, 0],
    });
    vehicles.update(0.1);
    expect(vehicles.root.getObjectByName('sage-mission-tow')?.visible).toBe(true);

    vehicles.assignWorldTask(null);
    for (let index = 0; index < 16; index += 1) vehicles.update(0.1);
    expect(vehicles.root.getObjectByName('sage-mission-tow')?.visible).toBe(false);
    expect(vehicles.root.getObjectByName('vehicle-sage')?.userData.missionVisual).toBe('none');

    vehicles.dispose();
    town.dispose();
  });
});
