/**
 * forestTower.ts
 * 关卡：森林高塔（Forest Tower）v2
 *
 * 修复 v1 线性 Z 延伸问题，改为螺旋盘绕布局（与 toyBlockTower 相同风格）。
 *
 * 布局规则：
 *   - XZ 范围：±12m（螺旋回绕，路径经过四个象限）
 *   - Y 轴：0→35m 登顶，每步 Δtop ≤ 1.3m
 *   - 路径：东北 → 西北 → 东南 → 西南 → 中心 的螺旋盘绕
 *
 * Zone 划分：
 *   Zone 1 "热身林地"   (0-7m):   宽台热身 + 旋转台 + 传送带
 *   Zone 2 "消失峡谷"   (7-16m):  消失/重现平台节奏踩踏
 *   Zone 3 "碎裂树干"   (16-24m): 碎裂平台心跳感
 *   Zone 4 "冰雪高原"   (24-30m): 冰面 + 旋转组合
 *   Zone 5 "最终冲顶"   (30-35m): 混合所有机制
 */

import type { ClimberLevelDefinition } from '../types';

export const FOREST_TOWER_LEVEL: ClimberLevelDefinition = {
  id: 'forest-tower',
  name: '森林高塔',
  description:
    '穿越神秘森林的玩具高塔。35m 登顶，无存档，掉落归零。' +
    '旋转台、传送带、消失平台、碎裂树干、冰面……各种机关螺旋盘绕而上！',

  startPosition: [0, 1.2, 0],
  cameraOffset: [0, 5.5, 11],

  theme: {
    skyColor: '#E8F5E9',
    floorColor: '#A5D6A7',
    gridPrimaryColor: '#66BB6A',
    gridSecondaryColor: '#C8E6C9',
    sunColor: '#F9FBE7',
  },

  designRules: {
    minPlayableSurfaceSize: 1.4,
    smallPieceClusterRadius: 2.5,
    maxNearbySmallPieces: 3,
    minJumpHeadroom: 1.0,
  },

  platforms: [
    // ──────────────────────────────────────────────────────────────────────
    // 起点大台
    // ──────────────────────────────────────────────────────────────────────
    { id: 'start', size: [8, 0.8, 8], position: [0, 0, 0], color: '#81C784' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 1 "热身林地"  0→7m  ── 东北象限
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p01', size: [3, 0.5, 3], position: [5, 1.0, 3], color: '#AED581' },
    { id: 'p02', size: [2.5, 0.5, 2.5], position: [8, 2.1, 6], color: '#DCE775' },
    {
      id: 'p03-rotate',
      size: [2.8, 0.5, 2.8],
      position: [9, 3.2, 9],
      color: '#FFD54F',
      rotating: { speed: 0.6 },
    },
    { id: 'p04', size: [3, 0.5, 2.5], position: [7, 4.3, 12], color: '#A5D6A7' },
    {
      id: 'p05-conv',
      size: [3, 0.5, 2],
      position: [4, 5.4, 14],
      color: '#80DEEA',
      conveyor: { axis: 'z', speed: 4.0 },
    },
    { id: 'p06-safe', size: [4, 0.5, 3.5], position: [1, 6.5, 12], color: '#81C784' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 2 "消失峡谷"  7→16m  ── 西北象限
    // ══════════════════════════════════════════════════════════════════════

    {
      id: 'p07-blink',
      size: [2.2, 0.5, 2.2],
      position: [-2, 7.6, 10],
      color: '#CE93D8',
      blink: { visibleMs: 2000, hiddenMs: 1500, phaseOffset: 0 },
    },
    {
      id: 'p08-blink',
      size: [2.2, 0.5, 2.2],
      position: [-5, 8.7, 8],
      color: '#CE93D8',
      blink: { visibleMs: 2000, hiddenMs: 1500, phaseOffset: 500 },
    },
    {
      id: 'p09-blink',
      size: [2, 0.5, 2],
      position: [-7, 9.8, 5],
      color: '#F48FB1',
      blink: { visibleMs: 1800, hiddenMs: 1800, phaseOffset: 1000 },
    },
    { id: 'p10-safe', size: [4, 0.5, 3.5], position: [-8, 11.0, 2], color: '#A5D6A7' },
    {
      id: 'p11-conv',
      size: [2.5, 0.5, 2],
      position: [-6, 12.0, -1],
      color: '#80DEEA',
      conveyor: { axis: 'x', speed: -3.5 },
    },
    {
      id: 'p12-blink',
      size: [2, 0.5, 2],
      position: [-3, 13.1, -3],
      color: '#CE93D8',
      blink: { visibleMs: 1600, hiddenMs: 2000, phaseOffset: 800 },
    },
    { id: 'p13-safe', size: [4, 0.5, 3.5], position: [0, 14.2, -4], color: '#81C784' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 3 "碎裂树干"  16→24m  ── 东南象限
    // ══════════════════════════════════════════════════════════════════════

    {
      id: 'p14-crumble',
      size: [2.2, 0.5, 2.2],
      position: [3, 15.3, -3],
      color: '#BCAAA4',
      crumble: { standMs: 900, crumbleMs: 350, resetMs: 3500 },
    },
    {
      id: 'p15-crumble',
      size: [2, 0.5, 2],
      position: [6, 16.4, -1],
      color: '#BCAAA4',
      crumble: { standMs: 700, crumbleMs: 300, resetMs: 3000 },
    },
    { id: 'p16-safe', size: [3, 0.5, 2.5], position: [8, 17.5, 2], color: '#A5D6A7' },
    {
      id: 'p17-crumble-rot',
      size: [2.5, 0.5, 2.5],
      position: [9, 18.6, 5],
      color: '#FF8A65',
      crumble: { standMs: 1000, crumbleMs: 400, resetMs: 4000 },
      rotating: { speed: 0.5 },
    },
    {
      id: 'p18-crumble',
      size: [1.9, 0.5, 1.9],
      position: [7, 19.7, 8],
      color: '#BCAAA4',
      crumble: { standMs: 600, crumbleMs: 300, resetMs: 2500 },
    },
    {
      id: 'p19-crumble',
      size: [1.8, 0.5, 1.8],
      position: [4, 20.8, 9],
      color: '#BCAAA4',
      crumble: { standMs: 550, crumbleMs: 280, resetMs: 2500 },
    },
    { id: 'p20-safe', size: [4, 0.5, 3.5], position: [1, 22.0, 8], color: '#81C784' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 4 "冰雪高原"  24→30m  ── 西南象限
    // ══════════════════════════════════════════════════════════════════════

    { id: 'p21-icy', size: [3, 0.5, 3], position: [-2, 23.0, 6], color: '#B3E5FC', icy: true },
    { id: 'p22-icy', size: [2.5, 0.5, 2.5], position: [-5, 24.1, 4], color: '#B3E5FC', icy: true },
    {
      id: 'p23-icy-rot',
      size: [2.8, 0.5, 2.8],
      position: [-7, 25.2, 1],
      color: '#E1F5FE',
      icy: true,
      rotating: { speed: 0.7 },
    },
    { id: 'p24-icy', size: [2.2, 0.5, 2.2], position: [-8, 26.3, -2], color: '#B3E5FC', icy: true },
    {
      id: 'p25-blink-icy',
      size: [2, 0.5, 2],
      position: [-6, 27.4, -4],
      color: '#80DEEA',
      blink: { visibleMs: 2200, hiddenMs: 1800, phaseOffset: 600 },
      icy: true,
    },
    { id: 'p26-safe', size: [4, 0.5, 3], position: [-3, 28.5, -5], color: '#E3F2FD' },

    // ══════════════════════════════════════════════════════════════════════
    // Zone 5 "最终冲顶"  30→35m  ── 回归中心，混合全部机制
    // ══════════════════════════════════════════════════════════════════════

    {
      id: 'p27-crumble',
      size: [2, 0.5, 2],
      position: [0, 29.6, -5],
      color: '#BCAAA4',
      crumble: { standMs: 600, crumbleMs: 280, resetMs: 2000 },
    },
    {
      id: 'p28-blink',
      size: [2, 0.5, 2],
      position: [3, 30.7, -3],
      color: '#CE93D8',
      blink: { visibleMs: 1500, hiddenMs: 2000, phaseOffset: 200 },
    },
    {
      id: 'p29-rot-conv',
      size: [2.5, 0.5, 2.5],
      position: [5, 31.8, 0],
      color: '#FFD54F',
      rotating: { speed: 0.9 },
      conveyor: { axis: 'z', speed: 3.0 },
    },
    {
      id: 'p30-crumble',
      size: [1.8, 0.5, 1.8],
      position: [3, 32.9, 3],
      color: '#F48FB1',
      crumble: { standMs: 500, crumbleMs: 260, resetMs: 2000 },
    },
    {
      id: 'p31-icy',
      size: [2, 0.5, 2],
      position: [0, 34.0, 5],
      color: '#B3E5FC',
      icy: true,
    },

    // ──────────────────────────────────────────────────────────────────────
    // 终点（金色大台）
    // ──────────────────────────────────────────────────────────────────────
    {
      id: 'goal',
      size: [5, 0.8, 5],
      position: [-2, 35.1, 3],
      color: '#FCD34D',
      isGoal: true,
    },
  ],
};
