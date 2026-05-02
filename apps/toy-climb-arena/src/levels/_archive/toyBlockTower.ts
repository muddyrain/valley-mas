/**
 * toyBlockTower.ts
 * 关卡：玩具积木塔（Toy Block Tower）v2
 *
 * 核心设计：玩具世界风格的《攀爬动物》——无存档，掉落归零，技术积累
 *
 * 规格：
 *   - 29 个平台（start + 27 + goal）
 *   - 目标高度 ~32m（较 v1 的 24m 提升 35%）
 *   - 无存档点，任意掉落重置到起点
 *
 * 难度分区（越高越难）：
 *   Zone 1 "初学者坡道" (0-7m):   平台 2-2.5m，间距适中，1个移动平台
 *   Zone 2 "窄道"       (7-14m):  平台 1.5-1.8m，1个快速移动+1个不稳定
 *   Zone 3 "移动迷宫"   (14-21m): 2个快速移动平台，1个不稳定，宽平台缓冲
 *   Zone 4 "高空挑战"   (21-27m): 极窄(1.4m)，超快移动(≤2.0s)，极快不稳定(≤220ms)
 *   Zone 5 "最终冲顶"   (27-32m): 最小平台+最快机制，需精准时机
 *
 * 可达性参数：
 *   MAX_JUMP_HEIGHT ≈ 1.84m | MAX_JUMP_DIST_WALK ≈ 4.5m
 *   设计约束：Δtop ≤ 1.4m | 边缘间距 ≤ 3.5m
 */

import type { ClimberLevelDefinition } from '../types';

// ─── 平台顶面高度快速参考 ─────────────────────────────────────────────────────
//   start:   top=0.4    Zone1: 1.25→7.0   Zone2: 8.15→13.65
//   Zone3:   14.75→21.3  Zone4: 21.85→26.55  Zone5: 27.75→32.5

export const TOY_BLOCK_TOWER_LEVEL: ClimberLevelDefinition = {
  id: 'toy-block-tower',
  name: '玩具积木塔',
  description:
    '积木搭建的玩具高塔。32m 登顶，无存档，掉落归零。' +
    '越往上越难——窄台、快速移动平台、瞬间坠落的不稳定积木，考验你的耐心与精准。',

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
    minPlayableSurfaceSize: 1.4,
    smallPieceClusterRadius: 2.5,
    maxNearbySmallPieces: 2,
    minJumpHeadroom: 1.0,
  },

  platforms: [
    // ──────────────────────────────────────────────────────────────────────
    // 出发大块（宽 8m，给玩家足够起跳空间）
    // ──────────────────────────────────────────────────────────────────────
    {
      id: 'start',
      size: [8, 0.8, 8],
      position: [0, 0, 0],
      color: '#F6D365',
    },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 1 "初学者坡道"  0→7m  宽台热身，1个慢速移动平台
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p01', size: [3, 0.5, 3], position: [6, 1.0, 1], color: '#EF4444' },
    { id: 'p02', size: [2.5, 0.5, 2.5], position: [9, 2.1, 3.5], color: '#3B82F6' },
    // 移动平台：慢速 period=4.0s，振幅小 ±1.2
    {
      id: 'p03',
      size: [2.5, 0.5, 2.5],
      position: [10.5, 3.2, 6.5],
      color: '#22C55E',
      moving: { axis: 'x', amplitude: 1.2, period: 4.0, phaseOffset: 0 },
    },
    { id: 'p04', size: [3, 0.5, 2.5], position: [9.5, 4.2, 9.5], color: '#FBBF24' },
    { id: 'p05', size: [2.5, 0.5, 3], position: [7.5, 5.3, 12], color: '#F97316' },
    // Zone1 末尾宽平台，喘息
    { id: 'wide_a', size: [4.5, 0.8, 4.5], position: [6, 6.6, 14.5], color: '#818CF8' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 2 "窄道入门"  7→14m  平台 2m 左右，1个中速移动，1个不稳定（宽容时间长）
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p07', size: [2.5, 0.5, 3], position: [3.5, 7.9, 17], color: '#A855F7' },
    { id: 'p08', size: [2, 0.5, 2], position: [1, 9.0, 18.5], color: '#EF4444' },
    // 移动平台：period=3.2s，振幅 ±1.8（可观察节拍再跳）
    {
      id: 'p09',
      size: [3, 0.5, 2],
      position: [-1.5, 10.1, 17],
      color: '#14B8A6',
      moving: { axis: 'z', amplitude: 1.8, period: 3.2, phaseOffset: 1.0 },
    },
    { id: 'p10', size: [2, 0.5, 2], position: [-4, 11.2, 14.5], color: '#EC4899' },
    { id: 'p11', size: [2.5, 0.5, 2.5], position: [-5.5, 12.3, 12], color: '#22C55E' },
    // 不稳定：shakeDelay=900ms（给玩家1秒缓冲），fallSpeed=4（下落慢）
    {
      id: 'p12',
      size: [2, 0.5, 2],
      position: [-6.5, 13.4, 9.5],
      color: '#F97316',
      unstable: { shakeDelay: 900, shakeDuration: 800, fallSpeed: 4, resetDelay: 2500 },
    },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 3 "移动练习"  14→21m  2个移动平台（中速），1个不稳定，宽台缓冲
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p13', size: [2.5, 0.5, 2.5], position: [-6, 14.5, 7], color: '#A855F7' },
    // 移动：period=3.0s，振幅 ±2.0
    {
      id: 'p14',
      size: [2, 0.5, 2],
      position: [-4, 15.6, 5],
      color: '#EF4444',
      moving: { axis: 'x', amplitude: 2.0, period: 3.0, phaseOffset: 0.5 },
    },
    // 移动：period=2.8s，振幅 ±1.6
    {
      id: 'p15',
      size: [2, 0.5, 2],
      position: [-2, 16.7, 3],
      color: '#60A5FA',
      moving: { axis: 'z', amplitude: 1.6, period: 2.8, phaseOffset: 2.0 },
    },
    // Zone3 宽台喘息
    { id: 'wide_b', size: [4, 0.8, 4], position: [-0.5, 17.9, 1], color: '#34D399' },
    // 不稳定：shakeDelay=700ms，fallSpeed=5
    {
      id: 'p16',
      size: [2, 0.5, 2.5],
      position: [1.5, 19.3, -1.5],
      color: '#FB923C',
      unstable: { shakeDelay: 700, shakeDuration: 800, fallSpeed: 5, resetDelay: 2200 },
    },
    { id: 'p17', size: [2.5, 0.5, 2.5], position: [3, 20.4, -3.5], color: '#FBBF24' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 4 "高空挑战"  21→27m  平台 1.8m，移动加速，不稳定变快
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p18', size: [2, 0.5, 3.5], position: [1.5, 21.6, -6], color: '#C084FC' },
    // 移动：period=2.6s，振幅 ±2.5
    {
      id: 'p19',
      size: [2, 0.5, 2],
      position: [-0.5, 22.8, -8.5],
      color: '#3B82F6',
      moving: { axis: 'x', amplitude: 2.5, period: 2.6, phaseOffset: 0 },
    },
    // 不稳定：shakeDelay=500ms，fallSpeed=6
    {
      id: 'p20',
      size: [1.8, 0.5, 1.8],
      position: [-2.5, 24.0, -10.5],
      color: '#F472B6',
      unstable: { shakeDelay: 500, shakeDuration: 700, fallSpeed: 6, resetDelay: 2000 },
    },
    // 移动：period=2.4s，振幅 ±2.0
    {
      id: 'p21',
      size: [1.8, 0.5, 2],
      position: [-1, 25.2, -12.5],
      color: '#F97316',
      moving: { axis: 'z', amplitude: 2.0, period: 2.4, phaseOffset: 1.2 },
    },
    { id: 'p22', size: [2.5, 0.5, 2.5], position: [1, 26.3, -10.5], color: '#22C55E' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 5 "最终冲顶"  27→32m  移动+不稳定组合，节奏感强但有规律可循
    // ══════════════════════════════════════════════════════════════════════

    // 不稳定：shakeDelay=600ms，fallSpeed=6
    {
      id: 'p23',
      size: [2, 0.5, 2],
      position: [2.5, 27.5, -8],
      color: '#EF4444',
      unstable: { shakeDelay: 600, shakeDuration: 700, fallSpeed: 6, resetDelay: 2000 },
    },
    // 移动：period=2.5s，振幅 ±2.0
    {
      id: 'p24',
      size: [2, 0.5, 2],
      position: [4, 28.7, -10],
      color: '#60A5FA',
      moving: { axis: 'x', amplitude: 2.0, period: 2.5, phaseOffset: 0.8 },
    },
    // 不稳定：shakeDelay=500ms，fallSpeed=7
    {
      id: 'p25',
      size: [2, 0.5, 2],
      position: [2, 29.7, -12],
      color: '#C084FC',
      unstable: { shakeDelay: 500, shakeDuration: 650, fallSpeed: 7, resetDelay: 2000 },
    },
    // 移动：period=2.2s，振幅 ±2.0
    {
      id: 'p26',
      size: [1.8, 0.5, 1.8],
      position: [0.5, 30.9, -10],
      color: '#FBBF24',
      moving: { axis: 'z', amplitude: 2.0, period: 2.2, phaseOffset: 2.5 },
    },

    // ── 终点（金色宽台面）── 5×5，历经磨难终于登顶！
    {
      id: 'goal',
      size: [5, 0.8, 5],
      position: [-2, 32.1, -8],
      color: '#FCD34D',
      isGoal: true,
    },
  ],

  // 无 setPieces：不加载任何 GLB / FBX
};
