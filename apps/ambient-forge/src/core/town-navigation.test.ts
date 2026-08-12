import { describe, expect, it } from 'vitest';
import {
  buildNavigationLoop,
  canVaultObstacle,
  createDistrictRouteAssignment,
  findNavigationRoute,
  findNearestNavigationNode,
  type NavigationGraph,
  planNavigationStops,
  resolveCircleAgainstRects,
  resolveCircleMovement,
  resolveCircleSlideMovement,
} from './town-navigation';

const graph: NavigationGraph = {
  nodes: [
    { id: 'square', position: [0, 0], neighbors: ['crossing'] },
    { id: 'crossing', position: [4, 0], neighbors: ['square', 'harbor', 'garden'] },
    { id: 'harbor', position: [8, 0], neighbors: ['crossing'] },
    { id: 'garden', position: [4, 5], neighbors: ['crossing'] },
  ],
};

describe('town navigation', () => {
  it('寻找最近节点，并沿连通道路生成最短路线', () => {
    expect(findNearestNavigationNode(graph, [0.3, -0.2])?.id).toBe('square');
    expect(findNavigationRoute(graph, 'square', 'harbor')).toEqual([
      'square',
      'crossing',
      'harbor',
    ]);
  });

  it('把多个生活地点展开为沿人行节点闭合的循环路线', () => {
    const route = buildNavigationLoop(graph, ['square', 'harbor', 'garden']);

    expect(route.map((node) => node.id)).toEqual([
      'square',
      'crossing',
      'harbor',
      'crossing',
      'garden',
      'crossing',
    ]);
    expect(route.every((node, index) => node.id !== route[index + 1]?.id)).toBe(true);
  });

  it('地图增加街区锚点后自动扩展流动职业路线，本地职业仍保持工作区', () => {
    const expandedGraph: NavigationGraph = {
      nodes: [
        { id: 'harbor', position: [-8, 0], neighbors: ['square'], tags: ['district-anchor'] },
        {
          id: 'square',
          position: [0, 0],
          neighbors: ['harbor', 'garden'],
          tags: ['district-anchor'],
        },
        { id: 'garden', position: [6, 0], neighbors: ['square', 'east'] },
        { id: 'east', position: [14, 0], neighbors: ['garden'], tags: ['district-anchor'] },
      ],
    };

    expect(planNavigationStops(expandedGraph, ['square', 'garden'], 'districts')).toEqual([
      'square',
      'garden',
      'east',
      'harbor',
    ]);
    expect(planNavigationStops(expandedGraph, ['harbor', 'square'], 'local')).toEqual([
      'harbor',
      'square',
    ]);
  });

  it('把新增街区分配给不同流动居民，而不是让所有人跑遍整张地图', () => {
    const expandedGraph: NavigationGraph = {
      nodes: [
        { id: 'square', position: [0, 0], neighbors: ['east', 'south'], tags: ['district-anchor'] },
        { id: 'east', position: [12, 0], neighbors: ['square'], tags: ['district-anchor'] },
        { id: 'south', position: [0, 12], neighbors: ['square'], tags: ['district-anchor'] },
        { id: 'harbor', position: [-12, 0], neighbors: ['square'], tags: ['district-anchor'] },
      ],
    };

    const first = planNavigationStops(expandedGraph, ['square'], 'districts', {
      index: 0,
      total: 2,
    });
    const second = planNavigationStops(expandedGraph, ['square'], 'districts', {
      index: 1,
      total: 2,
    });

    expect(first).toContain('square');
    expect(second).toContain('square');
    expect(first.filter((id) => id !== 'square')).toHaveLength(2);
    expect(second.filter((id) => id !== 'square')).toHaveLength(1);
    expect(new Set([...first, ...second])).toEqual(new Set(['square', 'east', 'south', 'harbor']));
  });

  it('按实际巡游居民总数分配街区槽位，第四名居民不会复用第一名的三槽路线', () => {
    expect(createDistrictRouteAssignment(0, 4)).toEqual({ index: 0, total: 4 });
    expect(createDistrictRouteAssignment(3, 4)).toEqual({ index: 3, total: 4 });
    expect(createDistrictRouteAssignment(4, 4)).toEqual({ index: 0, total: 4 });
  });

  it('把角色推出建筑碰撞盒，避免建筑与绿植穿模', () => {
    const resolved = resolveCircleAgainstRects([2.7, 0], 0.45, [
      { id: 'house', center: [3, 0], halfSize: [1, 1], height: 3, vaultable: false },
    ]);

    expect(resolved[0]).toBeLessThanOrEqual(1.55);
    expect(resolved[1]).toBeCloseTo(0);
  });

  it('正面遇到路灯时沿空闲方向绕行，并在全过程保持实体间距', () => {
    const colliders = [
      {
        id: 'lamp',
        center: [0, 0] as const,
        halfSize: [0.18, 0.18] as const,
        height: 2.8,
        vaultable: false,
      },
    ];
    let position: [number, number] = [-1.2, 0];
    let maximumDetour = 0;

    for (let frame = 0; frame < 80; frame += 1) {
      const distance = Math.max(0.001, Math.hypot(1.2 - position[0], -position[1]));
      const proposed: [number, number] = [
        position[0] + ((1.2 - position[0]) / distance) * 0.08,
        position[1] + (-position[1] / distance) * 0.08,
      ];
      position = resolveCircleMovement(position, proposed, 0.42, colliders);
      maximumDetour = Math.max(maximumDetour, Math.abs(position[1]));
      const insideInflatedLamp = Math.abs(position[0]) < 0.6 && Math.abs(position[1]) < 0.6;
      expect(insideInflatedLamp).toBe(false);
    }

    expect(maximumDetour).toBeGreaterThan(0.55);
    expect(position[0]).toBeGreaterThan(0.8);
  });

  it('角色误入重叠碰撞区时逐帧脱离，不能被单帧推出数米', () => {
    const from: [number, number] = [0, 0];
    const proposed: [number, number] = [0.04, 0];
    const resolved = resolveCircleMovement(from, proposed, 0.42, [
      {
        id: 'overlapping-block',
        center: [1.5, 0],
        halfSize: [2, 2],
        height: 3,
        vaultable: false,
      },
    ]);

    expect(Math.hypot(resolved[0] - from[0], resolved[1] - from[1])).toBeLessThanOrEqual(0.061);
  });

  it('受控角色斜撞墙体时只消除法向位移，保留沿墙滑动', () => {
    const wall = [
      {
        id: 'wall',
        center: [0, 0] as const,
        halfSize: [0.5, 3] as const,
        height: 3,
        vaultable: false,
      },
    ];
    const resolved = resolveCircleSlideMovement([-1.1, -1], [-0.7, -0.45], 0.42, wall);

    expect(resolved[0]).toBeCloseTo(-1.1);
    expect(resolved[1]).toBeCloseTo(-0.45);
  });

  it('只允许翻越高度和落点都安全的矮障碍', () => {
    expect(canVaultObstacle({ height: 0.7, thickness: 0.25, landingBlocked: false })).toBe(true);
    expect(canVaultObstacle({ height: 1.35, thickness: 0.25, landingBlocked: false })).toBe(false);
    expect(canVaultObstacle({ height: 0.6, thickness: 0.25, landingBlocked: true })).toBe(false);
  });
});
