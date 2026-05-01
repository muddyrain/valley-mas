/**
 * toyBlockTower.ts
 * 关卡：玩具积木塔（Toy Block Tower）
 *
 * 主题：桌面玩具世界 — 积木、书本、铅笔、橡皮
 * 规格：
 *   - 26 个平台（≤ 30）
 *   - 纯 Box 几何，无任何 GLB / FBX 模型
 *   - 3 个安全存档点（每 6~8 步一个）
 *   - 全程经过可达性验证（最大跳高 ≈1.84m，步行最大水平距离 ≈4.5m）
 *
 * 路径概要（每段行进方向交替，整体螺旋向上）：
 *   出发 → 段1（向+X+Z 方向爬升）→ 存档点A
 *       → 段2（向-X+Z 方向折返）  → 存档点B
 *       → 段3（向-X-Z 方向爬升）  → 存档点C
 *       → 段4（向+X-Z 折返最终）  → 终点
 */

import type { ClimberLevelDefinition } from '../types';

// ─── 平台顶面高度快速参考（中心 y + 高度/2）────────────────────────────────────
//   start:       top = 0 + 0.4 = 0.4
//   p01..p05:    顶面每步 +0.8 ~ +1.0
//   cp_a:        存档点，顶面更宽（高度 0.8）
//   ...以此类推

export const TOY_BLOCK_TOWER_LEVEL: ClimberLevelDefinition = {
  id: 'toy-block-tower',
  name: '玩具积木塔',
  description: '积木、书本、铅笔搭建的桌面玩具世界。26 块平台，螺旋向上，纯白盒，无模型加载。',

  startPosition: [0, 1.2, 0],
  cameraOffset: [0, 5.5, 11],

  theme: {
    skyColor: '#FFF9F0',
    floorColor: '#FDE68A',
    gridPrimaryColor: '#FBB924',
    gridSecondaryColor: '#FEF3C7',
    sunColor: '#FFF3CD',
  },

  designRules: {
    minPlayableSurfaceSize: 1.8,
    smallPieceClusterRadius: 2.5,
    maxNearbySmallPieces: 2,
    minJumpHeadroom: 1.0,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 平台数据（按路径顺序）
  //
  // 可达性关键参数（步行）：
  //   PLAYER_PHYSICS.gravity     = 21
  //   PLAYER_PHYSICS.jumpVelocity = 8.8
  //   MAX_JUMP_HEIGHT            ≈ 1.84 m
  //   MAX_JUMP_DISTANCE_WALK     ≈ 4.53 m（同高）
  //
  // 每步设计约束：
  //   高差（platform top 差）≤ 1.5 m（含余量）
  //   边缘水平距离（center-to-center - 两半宽之和）≤ 3.8 m
  // ──────────────────────────────────────────────────────────────────────────
  platforms: [
    // ── 出发大块（黄色积木地基）─────────────────────────────────────────────
    // top = 0 + 0.4 = 0.4
    {
      id: 'start',
      size: [8, 0.8, 8],
      position: [0, 0, 0],
      color: '#F6D365',
    },

    // ── 段 1：向 +X / +Z 爬升，~6 步到存档点 A ──────────────────────────────
    // p01: top=1.45  Δtop=+1.05  hDist(center)=4.0  → 边缘≈4.0-1.5-1.25=1.25m ✓
    {
      id: 'p01',
      size: [3, 0.5, 2.5],
      position: [4, 1.2, 0],
      color: '#EF4444', // 红色积木
    },
    // p02: top=2.25  Δtop=+0.8   hDist=3.6  边缘≈3.6-1.25-1.25=1.1m ✓
    {
      id: 'p02',
      size: [2.5, 0.5, 2.5],
      position: [7, 2.0, 1.5],
      color: '#3B82F6', // 蓝色书本
    },
    // p03: top=3.05  Δtop=+0.8   hDist≈3.2
    {
      id: 'p03',
      size: [2.5, 0.5, 2],
      position: [9, 2.8, 3.5],
      color: '#22C55E', // 绿色橡皮
      moving: { axis: 'x', amplitude: 1.2, period: 3.0, phaseOffset: 0 },
    },
    // p04: top=3.75  Δtop=+0.7   hDist≈2.7
    {
      id: 'p04',
      size: [2, 0.5, 2.5],
      position: [10, 3.5, 6],
      color: '#FBBF24', // 黄色积木
    },
    // p05: top=4.45  Δtop=+0.7   hDist≈2.7
    {
      id: 'p05',
      size: [2.5, 0.5, 2],
      position: [9.5, 4.2, 8.5],
      color: '#F97316', // 橙色积木
    },

    // ── 存档点 A（蓝色宽书本）──────────────────────────────────────────────
    // top=5.9  Δtop=+1.45  hDist≈2.95  边缘≈2.95-1.25-2.0=−0.3m（重叠）✓
    {
      id: 'cp_a',
      size: [4, 0.8, 4],
      position: [8, 5.5, 11],
      color: '#60A5FA',
      isCheckpoint: true,
    },

    // ── 段 2：向 -X / +Z 折返，~6 步到存档点 B ──────────────────────────────
    // p07: top=6.75  Δtop=+0.85  hDist≈2.8
    {
      id: 'p07',
      size: [2.5, 0.5, 2],
      position: [6, 6.5, 13],
      color: '#A855F7', // 紫色积木
    },
    // p08: top=7.75  Δtop=+1.0   hDist≈2.7
    {
      id: 'p08',
      size: [2.5, 0.5, 2.5],
      position: [4, 7.5, 14.5],
      color: '#EF4444',
    },
    // p09: top=8.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p09',
      size: [2.5, 0.5, 2],
      position: [2, 8.5, 13],
      color: '#3B82F6',
      moving: { axis: 'z', amplitude: 1.4, period: 2.6, phaseOffset: 1.0 },
    },
    // p10: top=9.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p10',
      size: [2, 0.5, 2.5],
      position: [0, 9.5, 11],
      color: '#22C55E',
      unstable: { shakeDelay: 500, shakeDuration: 1000, fallSpeed: 5, resetDelay: 2200 },
    },
    // p11: top=10.75  Δtop=+1.0  hDist≈2.7
    {
      id: 'p11',
      size: [2.5, 0.5, 2],
      position: [-1.5, 10.5, 9],
      color: '#FBBF24',
    },

    // ── 存档点 B（绿色宽积木）──────────────────────────────────────────────
    // 修正：top=11.9  Δtop=+1.15  hDist≈2.55 ✓
    {
      id: 'cp_b',
      size: [4, 0.8, 4],
      position: [-2, 11.5, 6.5],
      color: '#60A5FA',
      isCheckpoint: true,
    },

    // ── 段 3：向 -X / -Z 爬升，~6 步到存档点 C ──────────────────────────────
    // p13: top=12.75  Δtop=+0.85  hDist≈2.7
    {
      id: 'p13',
      size: [2.5, 0.5, 2],
      position: [-1, 12.5, 4],
      color: '#F97316',
    },
    // p14: top=13.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p14',
      size: [2.5, 0.5, 2.5],
      position: [1, 13.5, 2],
      color: '#EC4899', // 粉色橡皮
    },

    // ── 弹跳板 B：段3中段悬空小垫，可弹跳跳过 p15 直接到 p16 ───────────────
    // top=14.35  与 p14 同高，hDist(to p16)≈3.6m（正常不可直接跳，借力可到）
    {
      id: 'bounce_b',
      size: [1.8, 0.3, 1.8],
      position: [3.5, 14.1, 1.2],
      color: '#F472B6',
      bouncy: { boostVelocity: 12.0, squishDuration: 80 },
    },
    // p15: top=14.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p15',
      size: [2.5, 0.5, 2],
      position: [3, 14.5, 0],
      color: '#14B8A6', // 青色积木
      moving: { axis: 'x', amplitude: 1.5, period: 3.4, phaseOffset: 2.1 },
    },
    // p16: top=15.75  Δtop=+1.0   hDist≈2.7
    {
      id: 'p16',
      size: [2, 0.5, 2.5],
      position: [4.5, 15.5, -2],
      color: '#EF4444',
    },
    // p17: top=16.75  Δtop=+1.0   hDist≈2.5
    {
      id: 'p17',
      size: [2.5, 0.5, 2],
      position: [5, 16.5, -4.5],
      color: '#3B82F6',
    },

    // ── 存档点 C（黄色宽积木）──────────────────────────────────────────────
    // 修正：top=17.9  Δtop=+1.15  hDist≈2.7 ✓
    {
      id: 'cp_c',
      size: [4, 0.8, 4],
      position: [4, 17.5, -7],
      color: '#60A5FA',
      isCheckpoint: true,
    },

    // ── 段 4：向 +X / -Z 折返冲顶，~6 步到终点 ──────────────────────────────
    // p19: top=18.75  Δtop=+0.85  hDist≈2.9
    {
      id: 'p19',
      size: [2.5, 0.5, 2],
      position: [2.5, 18.5, -9.5],
      color: '#22C55E',
    },
    // p20: top=19.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p20',
      size: [2.5, 0.5, 2.5],
      position: [0.5, 19.5, -11.5],
      color: '#FBBF24',
    },
    // p21: top=20.75  Δtop=+1.0   hDist≈2.8
    {
      id: 'p21',
      size: [2.5, 0.5, 2],
      position: [-1.5, 20.5, -13],
      color: '#F97316',
      unstable: { shakeDelay: 400, shakeDuration: 900, fallSpeed: 6, resetDelay: 2000 },
    },
    // p22: top=21.75  Δtop=+1.0   hDist≈3.0
    {
      id: 'p22',
      size: [2, 0.5, 2.5],
      position: [-3, 21.5, -11],
      color: '#A855F7',
      moving: { axis: 'z', amplitude: 1.3, period: 2.2, phaseOffset: 3.5 },
    },
    // p23: top=22.75  Δtop=+1.0   hDist≈2.3
    {
      id: 'p23',
      size: [2.5, 0.5, 2],
      position: [-4, 22.5, -9],
      color: '#EC4899',
      unstable: { shakeDelay: 350, shakeDuration: 800, fallSpeed: 7, resetDelay: 1800 },
    },
    // p24: top=23.75  Δtop=+1.0   hDist=2.5
    {
      id: 'p24',
      size: [2.5, 0.5, 2],
      position: [-4, 23.5, -6.5],
      color: '#14B8A6',
    },

    // ── 终点（金色奖章台）──────────────────────────────────────────────────
    // top=24.9  Δtop=+1.15  hDist≈2.7 ✓
    {
      id: 'goal',
      size: [3.5, 0.8, 3.5],
      position: [-3, 24.5, -4],
      color: '#FCD34D',
      isGoal: true,
    },
  ],

  // 无 setPieces：不加载任何 GLB / FBX
};
