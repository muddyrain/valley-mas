/**
 * grandClimbWorld.ts — 城市攀顶（Grand Climb World v2）
 *
 * 设计参考《Only Up!》/《Getting Over It》风格：
 *   - 无存档点，掉落=回起点，这就是紧张感来源
 *   - 平台是真实世界大型结构（屋顶/管道/吊车臂/云岛），不是小方块台阶
 *   - 每个"平台"足够大，玩家需要在上面走动探索
 *   - 部分间隙需要冲刺跳（4-5m 边缘距离）
 *   - 路径横向蜿蜒再向上，制造"爬上整个世界"的感觉
 *
 * 物理边界（勿随意修改）：
 *   MAX_JUMP_HEIGHT   约1.84m（相邻顶面高差安全上限 1.3m）
 *   MAX_JUMP_DIST_WALK   约4.53m（步行，边缘到边缘安全 3.5m）
 *   MAX_JUMP_DIST_SPRINT 约6.87m（冲刺，挑战段落 4.5-5.5m）
 *
 * 主题路径（俯视）：
 *   废铁场(中心) → 工厂厂区(东→东北) → 城市楼顶(东北→北→西北) →
 *   港口吊车(西北→西) → 云端浮岛(西→南→中心高空) → 终点
 *
 * 约 55 个平台，高度 0→90m
 */

import type { ClimberLevelDefinition } from '../types';

export const GRAND_CLIMB_WORLD_LEVEL: ClimberLevelDefinition = {
  id: 'grand-climb-world',
  name: '城市攀顶',
  description: '从废铁场出发，爬上工厂、楼顶、吊车和云端。无存档，掉落即重来，越高越心跳加速。',

  startPosition: [0, 1.5, 0],
  cameraOffset: [0, 6, 13],

  theme: {
    skyColor: '#C8DFF7',
    floorColor: '#8B7355',
    gridPrimaryColor: '#6B5E4A',
    gridSecondaryColor: '#A09070',
    sunColor: '#FFF5E0',
  },

  designRules: {
    minPlayableSurfaceSize: 1.2,
    smallPieceClusterRadius: 3.0,
    maxNearbySmallPieces: 4,
    minJumpHeadroom: 0.9,
  },

  platforms: [
    // Zone 0 — 废铁场  surf 0.6→11m
    { id: 'start', size: [22, 1.2, 22], position: [0, 0, 0], color: '#78716C' },
    { id: 'z0-car1', size: [5, 0.7, 2.8], position: [13, 0.95, 8], color: '#B91C1C' },
    { id: 'z0-car2', size: [4.5, 0.6, 2.8], position: [17, 1.55, 14], color: '#7F1D1D' },
    { id: 'z0-crate-a', size: [4.5, 1.5, 4.5], position: [15, 2.3, 21], color: '#92400E' },
    { id: 'z0-crate-b', size: [4.5, 1.5, 4.5], position: [9, 3.5, 25], color: '#78350F' },
    { id: 'z0-container', size: [20, 1.2, 3.5], position: [0, 4.95, 25], color: '#1E40AF' },
    { id: 'z0-pipe', size: [3.5, 1.5, 18], position: [-9, 6.3, 20], color: '#374151' },
    { id: 'z0-shelf', size: [12, 1, 7], position: [-14, 7.75, 11], color: '#4B5563' },
    { id: 'z0-stair', size: [7, 1.5, 5.5], position: [-16, 8.8, 4], color: '#1F2937' },
    { id: 'z0-exit', size: [16, 1, 11], position: [-11, 10.55, -3], color: '#44403C' },

    // Zone 1 — 工厂厂区  surf 11→28m
    { id: 'z1-roof-a', size: [22, 1.5, 15], position: [-3, 11.8, -12], color: '#57534E' },
    { id: 'z1-skylight', size: [7, 1, 6], position: [6, 13.55, -19], color: '#78716C' },
    { id: 'z1-catwalk', size: [1.8, 0.5, 17], position: [14, 14.6, -24], color: '#A8A29E' },
    { id: 'z1-roof-b', size: [18, 1.5, 14], position: [22, 15.3, -27], color: '#44403C' },
    { id: 'z1-equip', size: [6, 2, 6], position: [27, 16.55, -21], color: '#292524' },
    { id: 'z1-chimney-base', size: [5.5, 2, 5.5], position: [29, 18.05, -15], color: '#1C1917' },
    { id: 'z1-chimney-ledge', size: [4, 1, 4], position: [29, 20.05, -11], color: '#1C1917' },
    { id: 'z1-bridge', size: [24, 1, 2.8], position: [17, 21.05, -7], color: '#57534E' },
    { id: 'z1-cooler', size: [10, 1, 10], position: [4, 22.55, -4], color: '#78716C' },
    { id: 'z1-tank-ledge', size: [3.5, 1, 3.5], position: [-2, 24.05, -7], color: '#44403C' },
    { id: 'z1-tank', size: [9, 1.5, 9], position: [-8, 25.3, -12], color: '#292524' },
    { id: 'z1-exit', size: [13, 1, 9], position: [-14, 27.05, -19], color: '#44403C' },

    // Zone 2 — 城市楼顶  surf 27→46m
    { id: 'z2-bld-a', size: [22, 1.5, 15], position: [-6, 28.3, -27], color: '#334155' },
    { id: 'z2-ac-a', size: [4, 1.5, 4], position: [2, 29.8, -33], color: '#475569' },
    { id: 'z2-awning', size: [15, 0.5, 2.2], position: [10, 31.3, -33], color: '#1E293B' },
    { id: 'z2-bld-b', size: [20, 1.5, 16], position: [23, 32.3, -29], color: '#1E293B' },
    { id: 'z2-bld-b-equip', size: [5.5, 2, 5.5], position: [29, 33.55, -22], color: '#334155' },
    { id: 'z2-watertower', size: [5.5, 2, 5.5], position: [30, 35.05, -15], color: '#0F172A' },
    { id: 'z2-billboard', size: [17, 0.5, 1.6], position: [23, 37.3, -9], color: '#0F172A' },
    { id: 'z2-bld-c', size: [18, 1.5, 16], position: [13, 38.3, -2], color: '#475569' },
    { id: 'z2-glass-bridge', size: [2, 0.5, 15], position: [3, 40.3, 5], color: '#7DD3FC' },
    { id: 'z2-penthouse', size: [14, 1, 9], position: [-5, 41.55, 10], color: '#1E293B' },
    { id: 'z2-helipad', size: [9, 1, 9], position: [-11, 43.05, 16], color: '#334155' },
    { id: 'z2-exit', size: [12, 1, 8], position: [-14, 44.55, 22], color: '#0F172A' },

    // Zone 3 — 港口吊车  surf 45→68m
    { id: 'z3-crane-base', size: [13, 2, 11], position: [-10, 45.55, 30], color: '#F59E0B' },
    { id: 'z3-crane-platform', size: [4.5, 2, 4.5], position: [-8, 47.05, 38], color: '#D97706' },
    { id: 'z3-crane-arm', size: [2.5, 0.5, 20], position: [-6, 48.3, 48], color: '#B45309' },
    { id: 'z3-ctr-a', size: [7, 2, 4], position: [-1, 49.05, 57], color: '#1D4ED8' },
    { id: 'z3-ctr-a2', size: [3, 1.5, 3], position: [-5, 50.55, 54], color: '#2563EB' },
    { id: 'z3-ctr-b', size: [7, 2, 4], position: [-9, 52.05, 51], color: '#1E40AF' },
    { id: 'z3-ctr-b2', size: [3, 1.5, 3], position: [-13, 53.55, 48], color: '#1D4ED8' },
    { id: 'z3-ctr-c', size: [6, 2, 4], position: [-17, 55.05, 44], color: '#1D4ED8' },
    { id: 'z3-deck', size: [18, 1, 8], position: [-21, 57.05, 37], color: '#374151' },
    { id: 'z3-bridge-a', size: [7, 1.5, 7], position: [-24, 58.3, 29], color: '#1F2937' },
    { id: 'z3-bridge-b', size: [6, 1.5, 6], position: [-24, 59.8, 21], color: '#111827' },
    { id: 'z3-mast-base', size: [4.5, 2, 4.5], position: [-22, 61.05, 14], color: '#1F2937' },
    { id: 'z3-yard-arm', size: [20, 0.5, 2], position: [-17, 63.3, 8], color: '#374151' },
    { id: 'z3-radar', size: [5.5, 1, 5.5], position: [-10, 64.55, 4], color: '#4B5563' },
    { id: 'z3-lighthouse', size: [6.5, 2, 6.5], position: [-3, 65.55, 2], color: '#F3F4F6' },
    { id: 'z3-exit', size: [11, 1, 8], position: [5, 67.55, 1], color: '#4B5563' },

    // Zone 4 — 云端浮岛  surf 68→89m
    { id: 'z4-cloud-a', size: [26, 2.5, 20], position: [17, 68.3, -4], color: '#EFF6FF' },
    { id: 'z4-rock-a', size: [5.5, 2.5, 5.5], position: [30, 69.8, -14], color: '#C7D2FE' },
    { id: 'z4-cloud-b', size: [18, 2.5, 15], position: [27, 71.3, -25], color: '#DBEAFE' },
    { id: 'z4-rainbow', size: [2.5, 0.5, 18], position: [15, 73.3, -34], color: '#FDE68A' },
    { id: 'z4-rock-b', size: [5.5, 2.5, 5.5], position: [4, 73.8, -42], color: '#A5B4FC' },
    { id: 'z4-cloud-c', size: [24, 2.5, 18], position: [-8, 75.3, -38], color: '#DBEAFE' },
    { id: 'z4-rock-c', size: [5, 2.5, 5], position: [-20, 76.8, -30], color: '#818CF8' },
    { id: 'z4-crescent', size: [18, 0.5, 2], position: [-24, 79.3, -21], color: '#A5B4FC' },
    { id: 'z4-cloud-d', size: [20, 2.5, 16], position: [-17, 79.8, -11], color: '#EFF6FF' },
    { id: 'z4-step-a', size: [6.5, 1.5, 6.5], position: [-9, 81.8, -4], color: '#C7D2FE' },
    { id: 'z4-step-b', size: [6, 1.5, 6], position: [-3, 83.3, 2], color: '#A5B4FC' },
    { id: 'z4-step-c', size: [5.5, 1.5, 5.5], position: [4, 84.8, 7], color: '#818CF8' },
    { id: 'z4-step-d', size: [5.5, 1.5, 5.5], position: [10, 86.3, 11], color: '#6366F1' },
    { id: 'z4-final', size: [13, 1.5, 10], position: [14, 87.8, 15], color: '#4F46E5' },

    // 终点 — 星空之巅
    { id: 'goal', size: [9, 1, 9], position: [8, 90.0, 20], color: '#FCD34D', isGoal: true },
  ],
};
