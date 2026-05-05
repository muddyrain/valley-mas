/**
 * grandClimbWorld.ts — 玩具世界攀顶（Grand Climb World v3）
 *
 * 设计参考《Getting Over It》式掉落惩罚：
 *   - 无存档点，掉落=回起点，这就是紧张感来源
 *   - 0-60m 是宽幅玩具平台群：主路、侧路、接落层和回爬路线并存
 *   - 接落层是真实落地空间，不是存档点，仍然会损失高度和路线进度
 *   - 所有可站部分走 GLB 模型级碰撞，降低空气墙和穿模感
 *
 * 物理边界（勿随意修改）：
 *   MAX_JUMP_HEIGHT   约1.84m（相邻顶面高差安全上限 1.3m）
 *   MAX_JUMP_DIST_WALK   约4.53m（步行，边缘到边缘安全 3.5m）
 *   MAX_JUMP_DIST_SPRINT 约6.87m（冲刺，挑战段落 4.5-5.5m）
 *
 * 主题路径（俯视）：
 *   谷仓玩具区(中心→东→北侧屋顶) → 城堡积木区(西→东→外墙回爬) →
 *   高空云岛过渡 → 奥林匹斯终点
 *
 * 约 40+ 个平台，高度 0→90m
 */

import type { ClimberLevelDefinition } from '../types';

export const GRAND_CLIMB_WORLD_LEVEL: ClimberLevelDefinition = {
  id: 'grand-climb-world',
  name: '玩具世界攀顶',
  description:
    '从谷仓玩具堆爬到城堡外墙，再接上云端。无存档，掉落会损失高度，但 0-60m 有真实接落层和回爬路线。',

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
    // Zone 0 — 谷仓玩具区  surf 0.6→25m：宽幅岛组、侧向接落层和回爬路线
    {
      id: 'start',
      size: [22, 1.2, 22],
      position: [0, 0, 0],
      color: '#FDE68A',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_button_cushion',
      },
    },
    {
      id: 'z0-crate-stack-a',
      size: [5.2, 1.0, 4.8],
      position: [9, 1.0, 5],
      color: '#F97316',
      toyProfile: {
        kind: 'stacked_steps',
        themeZone: 'barn',
        visualVariant: 'toy_wood_crate_step',
      },
    },
    {
      id: 'z0-pudding-hop',
      size: [4.2, 0.9, 4.2],
      position: [15, 2.45, 9],
      color: '#F9A8D4',
      toyProfile: { kind: 'round_disc', themeZone: 'barn', visualVariant: 'toy_barn_pudding_cup' },
    },
    {
      id: 'z0-cookie-landing',
      size: [12, 1.2, 8],
      position: [13, 3.9, 17],
      color: '#FBBF24',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_cookie_stack',
      },
    },
    {
      id: 'z0-low-catch-cushion',
      size: [9, 1, 7],
      position: [2, 5.3, 21],
      color: '#FB7185',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_button_cushion',
      },
    },
    {
      id: 'z0-return-blocks-a',
      size: [5.5, 1.4, 5.2],
      position: [-5, 6.3, 18],
      color: '#38BDF8',
      toyProfile: {
        kind: 'stacked_steps',
        themeZone: 'barn',
        visualVariant: 'toy_barn_abc_block_pile',
      },
    },
    {
      id: 'z0-return-blocks-b',
      size: [5.2, 1.2, 5],
      position: [-8, 7.95, 11],
      color: '#22C55E',
      toyProfile: {
        kind: 'stacked_steps',
        themeZone: 'barn',
        visualVariant: 'toy_stacked_steps_s5',
      },
    },
    {
      id: 'z0-xylophone-bridge',
      size: [9.2, 0.6, 2],
      position: [-3, 10.5, 7],
      color: '#FACC15',
      toyProfile: {
        kind: 'narrow_plank',
        themeZone: 'barn',
        visualVariant: 'toy_barn_xylophone_bridge',
      },
    },
    {
      id: 'z0-hayloft-main',
      size: [15, 1.1, 10],
      position: [5, 11.75, 1],
      color: '#D97706',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_rooftop_hayloft',
      },
    },
    {
      id: 'z0-yarn-side-hop',
      size: [4, 1, 4],
      position: [15, 13.5, -4],
      color: '#A78BFA',
      toyProfile: { kind: 'round_disc', themeZone: 'barn', visualVariant: 'toy_barn_yarn_ball' },
    },
    {
      id: 'z0-seesaw-risk',
      size: [8, 0.8, 2.4],
      position: [18, 15.0, -11],
      color: '#F97316',
      unstable: { shakeDelay: 700, shakeDuration: 1100, fallSpeed: 2.8, resetDelay: 2200 },
      toyProfile: {
        kind: 'wobble_board',
        themeZone: 'barn',
        visualVariant: 'toy_barn_seesaw_board',
      },
    },
    {
      id: 'z0-rooftop-catch-20m',
      size: [16, 1.2, 10],
      position: [8, 17.0, -17],
      color: '#F59E0B',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_rooftop_hayloft',
      },
    },
    {
      id: 'z0-picnic-main',
      size: [10, 1.1, 7],
      position: [-4, 18.65, -19],
      color: '#EF4444',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_picnic_basket',
      },
    },
    {
      id: 'z0-trampoline-lift',
      size: [5.8, 0.8, 5.8],
      position: [-12, 20.6, -13],
      color: '#F9A8D4',
      bouncy: { boostVelocity: 12.2, squishDuration: 110 },
      toyProfile: { kind: 'trampoline', themeZone: 'barn', visualVariant: 'toy_trampoline_pad' },
    },
    {
      id: 'z0-hayloft-high',
      size: [14, 1.2, 9],
      position: [-9, 22.8, -4],
      color: '#FBBF24',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'barn',
        visualVariant: 'toy_barn_rooftop_hayloft',
      },
    },
    {
      id: 'z0-barn-exit',
      size: [9, 1, 7],
      position: [-2, 24.7, 2],
      color: '#FDE68A',
      toyProfile: { kind: 'square_plate', themeZone: 'barn', visualVariant: 'toy_barn_hay_bale' },
    },

    // Zone 1 — 城堡积木区  surf 25→60m：外墙接落层、横向回爬和动态机关
    {
      id: 'z1-castle-gate-block',
      size: [9, 1.2, 7],
      position: [6, 26.2, 7],
      color: '#94A3B8',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_brick_block',
      },
    },
    {
      id: 'z1-wall-lower',
      size: [18, 1.2, 7],
      position: [15, 28.4, 8],
      color: '#CBD5E1',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_wall_walkway',
      },
    },
    {
      id: 'z1-coin-hop',
      size: [4.6, 1, 4.6],
      position: [25, 30.5, 2],
      color: '#FACC15',
      toyProfile: {
        kind: 'round_disc',
        themeZone: 'castle',
        visualVariant: 'toy_castle_coin_stack',
      },
    },
    {
      id: 'z1-scaffold-bridge',
      size: [10, 0.7, 2.3],
      position: [22, 32.25, -6],
      color: '#92400E',
      toyProfile: {
        kind: 'narrow_plank',
        themeZone: 'castle',
        visualVariant: 'toy_castle_tower_scaffold',
      },
    },
    {
      id: 'z1-wall-catch-35m',
      size: [17, 1.2, 8],
      position: [11, 34.2, -13],
      color: '#BFDBFE',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_wall_walkway',
      },
    },
    {
      id: 'z1-key-return-moving',
      size: [8.5, 0.7, 2],
      position: [1, 35.65, -15],
      color: '#FBBF24',
      moving: { axis: 'x', amplitude: 2.6, period: 4.8, phaseOffset: 0.5 },
      toyProfile: {
        kind: 'moving_lift',
        themeZone: 'castle',
        visualVariant: 'toy_castle_key_bridge',
      },
    },
    {
      id: 'z1-bookstack-rest',
      size: [10, 1.4, 7],
      position: [-8, 37.1, -11],
      color: '#C084FC',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_book_stack',
      },
    },
    {
      id: 'z1-drawbridge-main',
      size: [12, 0.7, 2.4],
      position: [-16, 38.85, -4],
      color: '#92400E',
      moving: { axis: 'z', amplitude: 2.2, period: 5.2, phaseOffset: 1.1 },
      toyProfile: {
        kind: 'moving_lift',
        themeZone: 'castle',
        visualVariant: 'toy_castle_drawbridge',
      },
    },
    {
      id: 'z1-tower-cap',
      size: [5.8, 1.1, 5.8],
      position: [-17, 40.45, 4],
      color: '#93C5FD',
      toyProfile: {
        kind: 'round_disc',
        themeZone: 'castle',
        visualVariant: 'toy_castle_tower_cap',
      },
    },
    {
      id: 'z1-shield-step',
      size: [8, 1, 6],
      position: [-10, 42.3, 10],
      color: '#60A5FA',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_shield_tile',
      },
    },
    {
      id: 'z1-gear-risk',
      size: [5.6, 0.9, 5.6],
      position: [-1, 44.05, 13],
      color: '#A78BFA',
      rotating: { speed: 0.75 },
      toyProfile: {
        kind: 'rotating_gear',
        themeZone: 'castle',
        visualVariant: 'toy_castle_gear_disc',
      },
    },
    {
      id: 'z1-wall-upper',
      size: [16, 1.2, 7],
      position: [8, 45.7, 9],
      color: '#CBD5E1',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_wall_walkway',
      },
    },
    {
      id: 'z1-treasure-catch-50m',
      size: [13, 1.2, 8],
      position: [20, 48.4, 3],
      color: '#FACC15',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_treasure_chest',
      },
    },
    {
      id: 'z1-ribbon-return',
      size: [10, 0.7, 2.3],
      position: [15, 50.25, -6],
      color: '#C084FC',
      toyProfile: {
        kind: 'narrow_plank',
        themeZone: 'castle',
        visualVariant: 'toy_castle_ribbon_bridge',
      },
    },
    {
      id: 'z1-hourglass-hop',
      size: [5.2, 1.1, 5.2],
      position: [7, 51.65, -12],
      color: '#F59E0B',
      toyProfile: {
        kind: 'round_disc',
        themeZone: 'castle',
        visualVariant: 'toy_castle_hourglass_tower',
      },
    },
    {
      id: 'z1-extendable-ruler',
      size: [12, 0.7, 2.2],
      position: [-2, 53.55, -13],
      color: '#FDE68A',
      extendable: { axis: 'x', minScale: 0.42, period: 4.4, phaseOffset: 0.3 },
      toyProfile: {
        kind: 'extendable_bridge',
        themeZone: 'castle',
        visualVariant: 'toy_castle_extendable_ruler_bridge',
      },
    },
    {
      id: 'z1-tilt-board',
      size: [8, 0.8, 3],
      position: [-12, 55.2, -8],
      color: '#A78BFA',
      tilting: { axis: 'z', angleDeg: 8, period: 4.6, phaseOffset: 0.8 },
      toyProfile: {
        kind: 'tilting_board',
        themeZone: 'castle',
        visualVariant: 'toy_castle_tilt_balance_board',
      },
    },
    {
      id: 'z1-cracked-choice',
      size: [6.5, 0.8, 5.5],
      position: [-18, 56.8, -1],
      color: '#FCA5A5',
      crumble: { standMs: 900, crumbleMs: 450, resetMs: 2600 },
      toyProfile: {
        kind: 'crumble_tile',
        themeZone: 'castle',
        visualVariant: 'toy_cracked_puzzle_crumble',
      },
    },
    {
      id: 'z1-wall-exit-60m',
      size: [16, 1.2, 8],
      position: [-10, 58.6, 8],
      color: '#DBEAFE',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'castle',
        visualVariant: 'toy_castle_wall_walkway',
      },
    },
    {
      id: 'z2-sky-transfer-a',
      size: [9, 1, 6],
      position: [0, 61.7, 9],
      color: '#BAE6FD',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'sky_island',
        visualVariant: 'toy_sky_metal_plate',
      },
    },
    {
      id: 'z2-sky-transfer-b',
      size: [8, 1, 6],
      position: [11, 64.5, 4],
      color: '#C7D2FE',
      toyProfile: {
        kind: 'square_plate',
        themeZone: 'sky_island',
        visualVariant: 'toy_sky_cloud_island',
      },
    },

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
