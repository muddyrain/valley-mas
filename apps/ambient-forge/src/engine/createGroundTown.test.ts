import { Box3, Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createDefaultAmbientInputs } from '../core/ambient-inputs';
import { deriveSceneSignals } from '../core/scene-signals';
import {
  TOWN_LAYOUT_SCALE,
  TOWN_PLAYABLE_HALF_DEPTH,
  TOWN_PLAYABLE_HALF_WIDTH,
} from '../core/town-layout';
import { findNavigationRoute, resolveCircleAgainstRects } from '../core/town-navigation';
import { createGroundTown } from './createGroundTown';

describe('ground town', () => {
  it('装配连续地面、道路、外墙建筑与可见世界边界', () => {
    const town = createGroundTown();

    expect(town.root).toBeInstanceOf(Group);
    expect(town.root.getObjectByName('town-ground')).toBeTruthy();
    expect(town.root.getObjectByName('main-road-loop')).toBeTruthy();
    expect(town.root.getObjectByName('town-square')).toBeTruthy();
    expect(town.root.getObjectByName('harbor-workshop')).toBeTruthy();
    expect(town.root.getObjectByName('garden-greenhouse')).toBeTruthy();
    expect(town.root.getObjectByName('cliff-boundary')).toBeTruthy();
    expect(town.root.getObjectByName('closed-tunnel')).toBeTruthy();
    expect(town.colliders.length).toBeGreaterThanOrEqual(8);
    expect(
      town.root.children.filter(
        (child) => child.userData.buildingId || child.name.includes('house'),
      ).length,
    ).toBeGreaterThanOrEqual(4);

    const northRoad = town.root.getObjectByName('north-road');
    const roadSize = northRoad ? new Box3().setFromObject(northRoad).getSize(new Vector3()) : null;
    expect(roadSize?.z).toBeGreaterThanOrEqual(5);

    town.dispose();
  });

  it('提供分离的人行/车行网络和停车点', () => {
    const town = createGroundTown();

    expect(town.pedestrianGraph.nodes.length).toBeGreaterThanOrEqual(12);
    expect(town.vehicleGraph.nodes.length).toBeGreaterThanOrEqual(8);
    expect(town.parkingSpots.length).toBeGreaterThanOrEqual(5);
    expect(town.parkingSpots.every((spot) => spot.roadNodeId.length > 0)).toBe(true);
    const northIn = town.pedestrianGraph.nodes.find((node) => node.id === 'north-cross-in');
    const northOut = town.pedestrianGraph.nodes.find((node) => node.id === 'north-cross-out');
    expect(northIn?.position[0]).toBeCloseTo(5.2 * TOWN_LAYOUT_SCALE);
    expect(northOut?.position[0]).toBeCloseTo(5.2 * TOWN_LAYOUT_SCALE);
    expect(northIn?.position[1]).toBeGreaterThan(-8 * TOWN_LAYOUT_SCALE);
    expect(northOut?.position[1]).toBeLessThan(-8 * TOWN_LAYOUT_SCALE);
    expect(
      Math.max(...town.vehicleGraph.nodes.map((node) => Math.abs(node.position[0]))),
    ).toBeGreaterThanOrEqual(30);

    town.dispose();
  });

  it('向东扩展完整生活街区，并把道路、建筑和停车位接入原有网络', () => {
    const town = createGroundTown();
    const ground = town.root.getObjectByName('town-ground');
    const groundSize = ground ? new Box3().setFromObject(ground).getSize(new Vector3()) : null;

    expect(groundSize?.x).toBeGreaterThanOrEqual(120);
    expect(TOWN_PLAYABLE_HALF_WIDTH).toBeGreaterThanOrEqual(64);
    expect(town.root.getObjectByName('east-district-road-loop')).toBeTruthy();
    expect(town.root.getObjectByName('east-district-square')).toBeTruthy();
    expect(town.root.getObjectByName('east-district-cafe')).toBeTruthy();
    expect(town.root.getObjectByName('east-district-library')).toBeTruthy();
    expect(town.root.getObjectByName('east-district-clinic')).toBeTruthy();
    expect(town.root.getObjectByName('east-district-residence')).toBeTruthy();
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'east-district-square')).toBe(
      true,
    );
    expect(town.vehicleGraph.nodes.some((node) => node.id === 'road-east-district-ne')).toBe(true);
    expect(Math.max(...town.vehicleGraph.nodes.map((node) => node.position[0]))).toBeGreaterThan(
      60,
    );
    expect(town.parkingSpots.length).toBeGreaterThanOrEqual(8);

    town.dispose();
  });

  it('向南扩展连通的河岸生活街区，并提供居民和车辆可用的完整网络', () => {
    const town = createGroundTown();
    const ground = town.root.getObjectByName('town-ground');
    const groundSize = ground ? new Box3().setFromObject(ground).getSize(new Vector3()) : null;

    expect(groundSize?.z).toBeGreaterThanOrEqual(110);
    expect(TOWN_PLAYABLE_HALF_DEPTH).toBeGreaterThanOrEqual(68);
    expect(town.root.userData.districtCount).toBeGreaterThanOrEqual(3);
    expect(town.root.getObjectByName('south-riverside-road-loop')).toBeTruthy();
    expect(town.root.getObjectByName('south-riverside-square')).toBeTruthy();
    expect(town.root.getObjectByName('south-riverside-station')).toBeTruthy();
    expect(town.root.getObjectByName('south-riverside-market')).toBeTruthy();
    expect(town.root.getObjectByName('south-riverside-workshop')).toBeTruthy();
    expect(town.root.getObjectByName('south-riverside-residence')).toBeTruthy();
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'south-riverside-square')).toBe(
      true,
    );
    expect(town.vehicleGraph.nodes.some((node) => node.id === 'road-south-riverside-south')).toBe(
      true,
    );
    expect(Math.max(...town.vehicleGraph.nodes.map((node) => node.position[1]))).toBeGreaterThan(
      60,
    );
    expect(town.parkingSpots.length).toBeGreaterThanOrEqual(12);

    town.dispose();
  });

  it('中心镇通往河岸的人行路线绕开面包房与住宅，不把居民导航进建筑', () => {
    const town = createGroundTown();
    const routeIds = findNavigationRoute(
      town.pedestrianGraph,
      'south-cross-out',
      'south-riverside-gate',
    );
    const nodes = new Map(town.pedestrianGraph.nodes.map((node) => [node.id, node]));
    let maximumCorrection = 0;
    for (let index = 1; index < routeIds.length; index += 1) {
      const from = nodes.get(routeIds[index - 1] ?? '');
      const to = nodes.get(routeIds[index] ?? '');
      if (!from || !to) continue;
      for (let step = 0; step <= 20; step += 1) {
        const progress = step / 20;
        const position: readonly [number, number] = [
          from.position[0] + (to.position[0] - from.position[0]) * progress,
          from.position[1] + (to.position[1] - from.position[1]) * progress,
        ];
        const resolved = resolveCircleAgainstRects(position, 0.42, town.colliders);
        maximumCorrection = Math.max(
          maximumCorrection,
          Math.hypot(resolved[0] - position[0], resolved[1] - position[1]),
        );
      }
    }

    expect(routeIds.length).toBeGreaterThan(2);
    expect(maximumCorrection).toBeLessThan(0.001);

    town.dispose();
  });

  it('整张人行网络的相邻节点之间都避开建筑、路灯和花坛实体', () => {
    const town = createGroundTown();
    const nodes = new Map(town.pedestrianGraph.nodes.map((node) => [node.id, node]));
    const blockedEdges = new Set<string>();
    for (const node of town.pedestrianGraph.nodes) {
      for (const neighborId of node.neighbors) {
        const neighbor = nodes.get(neighborId);
        if (!neighbor) continue;
        const edgeId = [node.id, neighbor.id].sort().join('↔');
        for (let step = 0; step <= 32; step += 1) {
          const progress = step / 32;
          const position: readonly [number, number] = [
            node.position[0] + (neighbor.position[0] - node.position[0]) * progress,
            node.position[1] + (neighbor.position[1] - node.position[1]) * progress,
          ];
          const resolved = resolveCircleAgainstRects(position, 0.42, town.colliders);
          if (Math.hypot(resolved[0] - position[0], resolved[1] - position[1]) <= 0.001) continue;
          blockedEdges.add(edgeId);
          break;
        }
      }
    }

    expect([...blockedEdges].sort()).toEqual([]);
    const districtAnchors = town.pedestrianGraph.nodes.filter((node) =>
      node.tags?.includes('district-anchor'),
    );
    expect(districtAnchors.length).toBeGreaterThanOrEqual(7);
    for (const anchor of districtAnchors) {
      expect(
        findNavigationRoute(town.pedestrianGraph, 'square-n', anchor.id),
        anchor.id,
      ).not.toEqual([]);
    }

    town.dispose();
  });

  it('向西扩展滨海生活街区，填充建筑、广场和交通网络', () => {
    const town = createGroundTown();
    const ground = town.root.getObjectByName('town-ground');
    const groundSize = ground ? new Box3().setFromObject(ground).getSize(new Vector3()) : null;

    expect(groundSize?.x).toBeGreaterThanOrEqual(160);
    expect(TOWN_PLAYABLE_HALF_WIDTH).toBeGreaterThanOrEqual(78);
    expect(town.root.userData.districtCount).toBeGreaterThanOrEqual(4);
    expect(town.root.getObjectByName('west-coast-road-loop')).toBeTruthy();
    expect(town.root.getObjectByName('west-coast-square')).toBeTruthy();
    expect(town.root.getObjectByName('west-coast-ferry-terminal')).toBeTruthy();
    expect(town.root.getObjectByName('west-coast-fish-market')).toBeTruthy();
    expect(town.root.getObjectByName('west-coast-boathouse')).toBeTruthy();
    expect(town.root.getObjectByName('west-coast-residence')).toBeTruthy();
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'west-coast-square')).toBe(true);
    expect(town.vehicleGraph.nodes.some((node) => node.id === 'road-west-coast-west')).toBe(true);
    expect(Math.min(...town.vehicleGraph.nodes.map((node) => node.position[0]))).toBeLessThan(-60);
    expect(town.parkingSpots.length).toBeGreaterThanOrEqual(15);

    town.dispose();
  });

  it('扩展为七个互联街区，并让北部、山地与东南片区同时接入人车网络', () => {
    const town = createGroundTown();
    const ground = town.root.getObjectByName('town-ground');
    const groundSize = ground ? new Box3().setFromObject(ground).getSize(new Vector3()) : null;

    expect(town.root.userData.districtCount).toBe(7);
    expect(town.root.userData.districtNames).toBe(
      'central|west-harbor|east-residential|south-riverside|north-old-town|northeast-hillside|southeast-garden',
    );
    expect(groundSize?.x).toBeGreaterThanOrEqual(190);
    expect(groundSize?.z).toBeGreaterThanOrEqual(170);
    for (const name of [
      'north-old-town-road-loop',
      'north-old-town-square',
      'northeast-hillside-road-loop',
      'northeast-hillside-square',
      'southeast-garden-road-loop',
      'southeast-garden-square',
    ]) {
      expect(town.root.getObjectByName(name), name).toBeTruthy();
    }
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'north-old-town-square')).toBe(
      true,
    );
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'northeast-hillside-square')).toBe(
      true,
    );
    expect(town.pedestrianGraph.nodes.some((node) => node.id === 'southeast-garden-square')).toBe(
      true,
    );
    expect(town.vehicleGraph.nodes.some((node) => node.id === 'road-northeast-hillside-east')).toBe(
      true,
    );
    expect(town.parkingSpots.length).toBeGreaterThanOrEqual(21);

    town.dispose();
  });

  it('把路灯、花坛和长椅全部登记为居民可避让的实体障碍', () => {
    const town = createGroundTown();
    const colliderIds = town.colliders.map((collider) => collider.id);

    expect(colliderIds.filter((id) => id.startsWith('town-lamp-'))).toHaveLength(4);
    expect(colliderIds.filter((id) => id.startsWith('east-district-lamp-'))).toHaveLength(4);
    expect(colliderIds.filter((id) => id.startsWith('east-district-planter-'))).toHaveLength(4);
    expect(colliderIds.filter((id) => id.startsWith('east-district-bench-'))).toHaveLength(2);

    town.dispose();
  });

  it('装配港口吊机、温室植物和按昼夜变化的路灯活动', () => {
    const town = createGroundTown();
    expect(town.root.getObjectByName('harbor-crane')).toBeTruthy();
    expect(town.root.getObjectByName('greenhouse-crops')).toBeTruthy();

    const dayInputs = { ...createDefaultAmbientInputs(), timeOfDay: 12 };
    const nightInputs = { ...createDefaultAmbientInputs(), timeOfDay: 23 };
    town.update(deriveSceneSignals(dayInputs), 0);
    const day = town.getActivitySnapshot();
    town.update(deriveSceneSignals(nightInputs), 4);
    const night = town.getActivitySnapshot();

    expect(night.craneRotation).not.toBe(day.craneRotation);
    expect(day.plantGrowth).toBeGreaterThan(night.plantGrowth);
    expect(night.lampIntensity).toBeGreaterThan(day.lampIntensity);

    town.dispose();
  });
});
