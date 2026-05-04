import toyBarnAbcBlockPileUrl from '../assets/models/platforms/toy_barn_abc_block_pile.glb';
import toyBarnButtonCushionUrl from '../assets/models/platforms/toy_barn_button_cushion.glb';
import toyBarnCookieStackUrl from '../assets/models/platforms/toy_barn_cookie_stack.glb';
import toyBarnHayBaleUrl from '../assets/models/platforms/toy_barn_hay_bale.glb';
import toyBarnPicnicBasketUrl from '../assets/models/platforms/toy_barn_picnic_basket.glb';
import toyBarnPuddingCupUrl from '../assets/models/platforms/toy_barn_pudding_cup.glb';
import toyBarnSeesawBoardUrl from '../assets/models/platforms/toy_barn_seesaw_board.glb';
import toyBarnXylophoneBridgeUrl from '../assets/models/platforms/toy_barn_xylophone_bridge.glb';
import toyBarnYarnBallUrl from '../assets/models/platforms/toy_barn_yarn_ball.glb';
import toyBarrelRoundTopUrl from '../assets/models/platforms/toy_barrel_round_top.glb';
import toyBlinkAcrylicPanelUrl from '../assets/models/platforms/toy_blink_acrylic_panel.glb';
import toyBrokenPuzzlePieceUrl from '../assets/models/platforms/toy_broken_puzzle_piece.glb';
import toyCastleBookStackUrl from '../assets/models/platforms/toy_castle_book_stack.glb';
import toyCastleBrickBlockUrl from '../assets/models/platforms/toy_castle_brick_block.glb';
import toyCastleCoinStackUrl from '../assets/models/platforms/toy_castle_coin_stack.glb';
import toyCastleCrownPlatformUrl from '../assets/models/platforms/toy_castle_crown_platform.glb';
import toyCastleDrawbridgeUrl from '../assets/models/platforms/toy_castle_drawbridge.glb';
import toyCastleExtendableRulerBridgeUrl from '../assets/models/platforms/toy_castle_extendable_ruler_bridge.glb';
import toyCastleGearDiscUrl from '../assets/models/platforms/toy_castle_gear_disc.glb';
import toyCastleHourglassTowerUrl from '../assets/models/platforms/toy_castle_hourglass_tower.glb';
import toyCastleKeyBridgeUrl from '../assets/models/platforms/toy_castle_key_bridge.glb';
import toyCastleRibbonBridgeUrl from '../assets/models/platforms/toy_castle_ribbon_bridge.glb';
import toyCastleShieldTileUrl from '../assets/models/platforms/toy_castle_shield_tile.glb';
import toyCastleTiltBalanceBoardUrl from '../assets/models/platforms/toy_castle_tilt_balance_board.glb';
import toyCastleTowerCapUrl from '../assets/models/platforms/toy_castle_tower_cap.glb';
import toyCastleTreasureChestUrl from '../assets/models/platforms/toy_castle_treasure_chest.glb';
import toyCloudBouncePadUrl from '../assets/models/platforms/toy_cloud_bounce_pad.glb';
import toyConveyorTrackBeltUrl from '../assets/models/platforms/toy_conveyor_track_belt.glb';
import toyCrackedPuzzleCrumbleUrl from '../assets/models/platforms/toy_cracked_puzzle_crumble.glb';
import toyCrumbleCookieTileUrl from '../assets/models/platforms/toy_crumble_cookie_tile.glb';
import toyGummyStickyPadUrl from '../assets/models/platforms/toy_gummy_sticky_pad.glb';
import toyNarrowPlankS3Url from '../assets/models/platforms/toy_narrow_plank_s3.glb';
import toyOlympusGoldenRingUrl from '../assets/models/platforms/toy_olympus_golden_ring.glb';
// Z4 Olympus
import toyOlympusMarbleDaisUrl from '../assets/models/platforms/toy_olympus_marble_dais.glb';
import toyOlympusRainbowCloudUrl from '../assets/models/platforms/toy_olympus_rainbow_cloud.glb';
import toyOlympusStarFinaleUrl from '../assets/models/platforms/toy_olympus_star_finale.glb';
import toyPlasticIceBlockUrl from '../assets/models/platforms/toy_plastic_ice_block.glb';
import toyRopePlankBridgeUrl from '../assets/models/platforms/toy_rope_plank_bridge.glb';
import toyRoundDiscS2Url from '../assets/models/platforms/toy_round_disc_s2.glb';
import toySkyCloudIslandUrl from '../assets/models/platforms/toy_sky_cloud_island.glb';
import toySkyCrystalShardUrl from '../assets/models/platforms/toy_sky_crystal_shard.glb';
// Z3 Sky Island
import toySkyMetalPlateUrl from '../assets/models/platforms/toy_sky_metal_plate.glb';
import toySkyNarrowBeamUrl from '../assets/models/platforms/toy_sky_narrow_beam.glb';
import toySkySpinningDiscUrl from '../assets/models/platforms/toy_sky_spinning_disc.glb';
import toySquarePlateS1Url from '../assets/models/platforms/toy_square_plate_s1.glb';
import toyTrampolinePadUrl from '../assets/models/platforms/toy_trampoline_pad.glb';
import toyWoodCrateStepUrl from '../assets/models/platforms/toy_wood_crate_step.glb';
import { toRuntimeAssetUrl } from './assetUrl';
import type { ResolvedToyPlatformProfile } from './platformCatalog';
import type { ToyPlatformKind } from './types';

export type ToyPlatformModelAssetId =
  | 'toy_square_plate_s1'
  | 'toy_round_disc_s2'
  | 'toy_narrow_plank_s3'
  | 'toy_barn_hay_bale'
  | 'toy_barn_cookie_stack'
  | 'toy_barn_abc_block_pile'
  | 'toy_barn_pudding_cup'
  | 'toy_barn_button_cushion'
  | 'toy_barn_picnic_basket'
  | 'toy_barn_yarn_ball'
  | 'toy_barn_xylophone_bridge'
  | 'toy_barn_seesaw_board'
  | 'toy_wood_crate_step'
  | 'toy_barrel_round_top'
  | 'toy_rope_plank_bridge'
  | 'toy_broken_puzzle_piece'
  | 'toy_blink_acrylic_panel'
  | 'toy_crumble_cookie_tile'
  | 'toy_trampoline_pad'
  | 'toy_conveyor_track_belt'
  | 'toy_plastic_ice_block'
  | 'toy_gummy_sticky_pad'
  | 'toy_cloud_bounce_pad'
  | 'toy_cracked_puzzle_crumble'
  | 'toy_castle_brick_block'
  | 'toy_castle_book_stack'
  | 'toy_castle_coin_stack'
  | 'toy_castle_key_bridge'
  | 'toy_castle_crown_platform'
  | 'toy_castle_shield_tile'
  | 'toy_castle_hourglass_tower'
  | 'toy_castle_ribbon_bridge'
  | 'toy_castle_treasure_chest'
  | 'toy_castle_gear_disc'
  | 'toy_castle_drawbridge'
  | 'toy_castle_extendable_ruler_bridge'
  | 'toy_castle_tilt_balance_board'
  | 'toy_castle_tower_cap'
  // Z3 Sky Island
  | 'toy_sky_metal_plate'
  | 'toy_sky_spinning_disc'
  | 'toy_sky_crystal_shard'
  | 'toy_sky_cloud_island'
  | 'toy_sky_narrow_beam'
  // Z4 Olympus
  | 'toy_olympus_marble_dais'
  | 'toy_olympus_golden_ring'
  | 'toy_olympus_rainbow_cloud'
  | 'toy_olympus_star_finale';

export interface ToyPlatformModelAssetDefinition {
  id: ToyPlatformModelAssetId;
  name: string;
  url: string;
  platformKind: ToyPlatformKind;
  source: 'generated-glb';
}

export const TOY_PLATFORM_MODEL_ASSETS: Record<
  ToyPlatformModelAssetId,
  ToyPlatformModelAssetDefinition
> = {
  toy_square_plate_s1: {
    id: 'toy_square_plate_s1',
    name: 'S1 方形玩具板实体模型',
    url: toRuntimeAssetUrl(toySquarePlateS1Url, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_round_disc_s2: {
    id: 'toy_round_disc_s2',
    name: 'S2 圆形纽扣盘实体模型',
    url: toRuntimeAssetUrl(toyRoundDiscS2Url, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_narrow_plank_s3: {
    id: 'toy_narrow_plank_s3',
    name: 'S3 窄长踏板实体模型',
    url: toRuntimeAssetUrl(toyNarrowPlankS3Url, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  toy_barn_hay_bale: {
    id: 'toy_barn_hay_bale',
    name: '草垛跳跃模块',
    url: toRuntimeAssetUrl(toyBarnHayBaleUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_barn_cookie_stack: {
    id: 'toy_barn_cookie_stack',
    name: '谷仓夹心饼干叠平台',
    url: toRuntimeAssetUrl(toyBarnCookieStackUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_barn_abc_block_pile: {
    id: 'toy_barn_abc_block_pile',
    name: '谷仓 ABC 积木堆平台',
    url: toRuntimeAssetUrl(toyBarnAbcBlockPileUrl, import.meta.url),
    platformKind: 'stacked_steps',
    source: 'generated-glb',
  },
  toy_barn_pudding_cup: {
    id: 'toy_barn_pudding_cup',
    name: '谷仓布丁杯圆形落点',
    url: toRuntimeAssetUrl(toyBarnPuddingCupUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_barn_button_cushion: {
    id: 'toy_barn_button_cushion',
    name: '谷仓软垫按钮平台',
    url: toRuntimeAssetUrl(toyBarnButtonCushionUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_barn_picnic_basket: {
    id: 'toy_barn_picnic_basket',
    name: '谷仓野餐篮平台',
    url: toRuntimeAssetUrl(toyBarnPicnicBasketUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_barn_yarn_ball: {
    id: 'toy_barn_yarn_ball',
    name: '谷仓毛线球圆形落点',
    url: toRuntimeAssetUrl(toyBarnYarnBallUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_barn_xylophone_bridge: {
    id: 'toy_barn_xylophone_bridge',
    name: '谷仓木琴踏板桥',
    url: toRuntimeAssetUrl(toyBarnXylophoneBridgeUrl, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  toy_barn_seesaw_board: {
    id: 'toy_barn_seesaw_board',
    name: '谷仓弹簧跷跷板机关',
    url: toRuntimeAssetUrl(toyBarnSeesawBoardUrl, import.meta.url),
    platformKind: 'wobble_board',
    source: 'generated-glb',
  },
  toy_wood_crate_step: {
    id: 'toy_wood_crate_step',
    name: '木箱阶梯跳跃模块',
    url: toRuntimeAssetUrl(toyWoodCrateStepUrl, import.meta.url),
    platformKind: 'stacked_steps',
    source: 'generated-glb',
  },
  toy_barrel_round_top: {
    id: 'toy_barrel_round_top',
    name: '木桶圆顶落点模块',
    url: toRuntimeAssetUrl(toyBarrelRoundTopUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_rope_plank_bridge: {
    id: 'toy_rope_plank_bridge',
    name: '绳索木桥踏板模块',
    url: toRuntimeAssetUrl(toyRopePlankBridgeUrl, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  toy_broken_puzzle_piece: {
    id: 'toy_broken_puzzle_piece',
    name: '破碎拼图落点模块',
    url: toRuntimeAssetUrl(toyBrokenPuzzlePieceUrl, import.meta.url),
    platformKind: 'irregular_fragment',
    source: 'generated-glb',
  },
  toy_blink_acrylic_panel: {
    id: 'toy_blink_acrylic_panel',
    name: '发光亚克力忽隐忽现板',
    url: toRuntimeAssetUrl(toyBlinkAcrylicPanelUrl, import.meta.url),
    platformKind: 'blink_panel',
    source: 'generated-glb',
  },
  toy_crumble_cookie_tile: {
    id: 'toy_crumble_cookie_tile',
    name: '酥饼碎裂倒计时平台',
    url: `${toRuntimeAssetUrl(toyCrumbleCookieTileUrl, import.meta.url)}?v=20260502-cookie`,
    platformKind: 'crumble_tile',
    source: 'generated-glb',
  },
  toy_trampoline_pad: {
    id: 'toy_trampoline_pad',
    name: '弹力垫跳跃模块',
    url: toRuntimeAssetUrl(toyTrampolinePadUrl, import.meta.url),
    platformKind: 'trampoline',
    source: 'generated-glb',
  },
  toy_conveyor_track_belt: {
    id: 'toy_conveyor_track_belt',
    name: '玩具履带传送带平台',
    url: toRuntimeAssetUrl(toyConveyorTrackBeltUrl, import.meta.url),
    platformKind: 'conveyor_belt',
    source: 'generated-glb',
  },
  toy_plastic_ice_block: {
    id: 'toy_plastic_ice_block',
    name: '透明塑料冰块平台',
    url: toRuntimeAssetUrl(toyPlasticIceBlockUrl, import.meta.url),
    platformKind: 'ice_block',
    source: 'generated-glb',
  },
  toy_gummy_sticky_pad: {
    id: 'toy_gummy_sticky_pad',
    name: '软糖粘性平台',
    url: toRuntimeAssetUrl(toyGummyStickyPadUrl, import.meta.url),
    platformKind: 'sticky_pad',
    source: 'generated-glb',
  },
  toy_cloud_bounce_pad: {
    id: 'toy_cloud_bounce_pad',
    name: '玩具云朵小弹跳垫',
    url: toRuntimeAssetUrl(toyCloudBouncePadUrl, import.meta.url),
    platformKind: 'bounce_pad',
    source: 'generated-glb',
  },
  toy_cracked_puzzle_crumble: {
    id: 'toy_cracked_puzzle_crumble',
    name: '裂纹拼图崩塌平台',
    url: toRuntimeAssetUrl(toyCrackedPuzzleCrumbleUrl, import.meta.url),
    platformKind: 'crumble_tile',
    source: 'generated-glb',
  },
  toy_castle_brick_block: {
    id: 'toy_castle_brick_block',
    name: '城堡石砖积木平台',
    url: toRuntimeAssetUrl(toyCastleBrickBlockUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_castle_book_stack: {
    id: 'toy_castle_book_stack',
    name: '城堡童话书叠平台',
    url: toRuntimeAssetUrl(toyCastleBookStackUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_castle_coin_stack: {
    id: 'toy_castle_coin_stack',
    name: '城堡金币叠圆形落点',
    url: toRuntimeAssetUrl(toyCastleCoinStackUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_castle_key_bridge: {
    id: 'toy_castle_key_bridge',
    name: '城堡金钥匙踏板',
    url: toRuntimeAssetUrl(toyCastleKeyBridgeUrl, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  toy_castle_crown_platform: {
    id: 'toy_castle_crown_platform',
    name: '城堡皇冠终点平台',
    url: toRuntimeAssetUrl(toyCastleCrownPlatformUrl, import.meta.url),
    platformKind: 'goal_crown',
    source: 'generated-glb',
  },
  toy_castle_shield_tile: {
    id: 'toy_castle_shield_tile',
    name: '城堡盾牌纹章平台',
    url: toRuntimeAssetUrl(toyCastleShieldTileUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_castle_hourglass_tower: {
    id: 'toy_castle_hourglass_tower',
    name: '城堡沙漏塔圆形落点',
    url: toRuntimeAssetUrl(toyCastleHourglassTowerUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  toy_castle_ribbon_bridge: {
    id: 'toy_castle_ribbon_bridge',
    name: '城堡缎带踏板桥',
    url: toRuntimeAssetUrl(toyCastleRibbonBridgeUrl, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  toy_castle_treasure_chest: {
    id: 'toy_castle_treasure_chest',
    name: '城堡宝箱平台',
    url: toRuntimeAssetUrl(toyCastleTreasureChestUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_castle_gear_disc: {
    id: 'toy_castle_gear_disc',
    name: '城堡齿轮旋转圆盘',
    url: toRuntimeAssetUrl(toyCastleGearDiscUrl, import.meta.url),
    platformKind: 'rotating_gear',
    source: 'generated-glb',
  },
  toy_castle_drawbridge: {
    id: 'toy_castle_drawbridge',
    name: '城堡伸缩吊桥踏板',
    url: toRuntimeAssetUrl(toyCastleDrawbridgeUrl, import.meta.url),
    platformKind: 'moving_lift',
    source: 'generated-glb',
  },
  toy_castle_extendable_ruler_bridge: {
    id: 'toy_castle_extendable_ruler_bridge',
    name: '城堡伸缩尺玩具桥',
    url: toRuntimeAssetUrl(toyCastleExtendableRulerBridgeUrl, import.meta.url),
    platformKind: 'extendable_bridge',
    source: 'generated-glb',
  },
  toy_castle_tilt_balance_board: {
    id: 'toy_castle_tilt_balance_board',
    name: '城堡半球底座倾斜板',
    url: toRuntimeAssetUrl(toyCastleTiltBalanceBoardUrl, import.meta.url),
    platformKind: 'tilting_board',
    source: 'generated-glb',
  },
  toy_castle_tower_cap: {
    id: 'toy_castle_tower_cap',
    name: '城堡塔顶圆形落点',
    url: toRuntimeAssetUrl(toyCastleTowerCapUrl, import.meta.url),
    platformKind: 'round_disc',
    source: 'generated-glb',
  },
  // Z3 Sky Island
  toy_sky_metal_plate: {
    id: 'toy_sky_metal_plate',
    name: '高空金属科技落点板',
    url: toRuntimeAssetUrl(toySkyMetalPlateUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_sky_spinning_disc: {
    id: 'toy_sky_spinning_disc',
    name: '高空彩虹旋转圆盘',
    url: toRuntimeAssetUrl(toySkySpinningDiscUrl, import.meta.url),
    platformKind: 'rotating_gear',
    source: 'generated-glb',
  },
  toy_sky_crystal_shard: {
    id: 'toy_sky_crystal_shard',
    name: '高空水晶碎片忽隐忽现台',
    url: toRuntimeAssetUrl(toySkyCrystalShardUrl, import.meta.url),
    platformKind: 'blink_panel',
    source: 'generated-glb',
  },
  toy_sky_cloud_island: {
    id: 'toy_sky_cloud_island',
    name: '高空彩虹云岛休息平台',
    url: toRuntimeAssetUrl(toySkyCloudIslandUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_sky_narrow_beam: {
    id: 'toy_sky_narrow_beam',
    name: '高空科技窄梁踏板',
    url: toRuntimeAssetUrl(toySkyNarrowBeamUrl, import.meta.url),
    platformKind: 'narrow_plank',
    source: 'generated-glb',
  },
  // Z4 Olympus
  toy_olympus_marble_dais: {
    id: 'toy_olympus_marble_dais',
    name: '奥林匹斯大理石廊台',
    url: toRuntimeAssetUrl(toyOlympusMarbleDaisUrl, import.meta.url),
    platformKind: 'square_plate',
    source: 'generated-glb',
  },
  toy_olympus_golden_ring: {
    id: 'toy_olympus_golden_ring',
    name: '奥林匹斯黄金宝石环台',
    url: toRuntimeAssetUrl(toyOlympusGoldenRingUrl, import.meta.url),
    platformKind: 'rotating_gear',
    source: 'generated-glb',
  },
  toy_olympus_rainbow_cloud: {
    id: 'toy_olympus_rainbow_cloud',
    name: '奥林匹斯彩虹弹跳云',
    url: toRuntimeAssetUrl(toyOlympusRainbowCloudUrl, import.meta.url),
    platformKind: 'trampoline',
    source: 'generated-glb',
  },
  toy_olympus_star_finale: {
    id: 'toy_olympus_star_finale',
    name: '奥林匹斯星光终点台',
    url: toRuntimeAssetUrl(toyOlympusStarFinaleUrl, import.meta.url),
    platformKind: 'goal_crown',
    source: 'generated-glb',
  },
};

export function getToyPlatformModelAsset(
  assetId: ToyPlatformModelAssetId,
): ToyPlatformModelAssetDefinition {
  return TOY_PLATFORM_MODEL_ASSETS[assetId];
}

export function getAllToyPlatformModelAssets(): ToyPlatformModelAssetDefinition[] {
  return Object.values(TOY_PLATFORM_MODEL_ASSETS);
}

export function resolveToyPlatformModelAsset(
  profile: ResolvedToyPlatformProfile,
): ToyPlatformModelAssetDefinition | null {
  const explicitAsset =
    profile.visualVariant && profile.visualVariant in TOY_PLATFORM_MODEL_ASSETS
      ? TOY_PLATFORM_MODEL_ASSETS[profile.visualVariant as ToyPlatformModelAssetId]
      : null;
  if (explicitAsset) return explicitAsset;

  switch (profile.kind) {
    case 'square_plate':
      if (profile.themeZone === 'olympus') return TOY_PLATFORM_MODEL_ASSETS.toy_olympus_marble_dais;
      if (profile.themeZone === 'sky_island') return TOY_PLATFORM_MODEL_ASSETS.toy_sky_metal_plate;
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_castle_brick_block
        : TOY_PLATFORM_MODEL_ASSETS.toy_barn_hay_bale;
    case 'stacked_steps':
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_castle_brick_block
        : TOY_PLATFORM_MODEL_ASSETS.toy_wood_crate_step;
    case 'round_disc':
    case 'balance_pole':
      if (profile.themeZone === 'sky_island')
        return TOY_PLATFORM_MODEL_ASSETS.toy_sky_spinning_disc;
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_castle_tower_cap
        : TOY_PLATFORM_MODEL_ASSETS.toy_barrel_round_top;
    case 'narrow_plank':
      if (profile.themeZone === 'sky_island') return TOY_PLATFORM_MODEL_ASSETS.toy_sky_narrow_beam;
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_castle_drawbridge
        : TOY_PLATFORM_MODEL_ASSETS.toy_rope_plank_bridge;
    case 'moving_lift':
      if (profile.themeZone === 'sky_island') return TOY_PLATFORM_MODEL_ASSETS.toy_sky_narrow_beam;
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_castle_drawbridge
        : TOY_PLATFORM_MODEL_ASSETS.toy_rope_plank_bridge;
    case 'wobble_board':
      return TOY_PLATFORM_MODEL_ASSETS.toy_barn_seesaw_board;
    case 'rotating_gear':
      return TOY_PLATFORM_MODEL_ASSETS.toy_castle_gear_disc;
    case 'extendable_bridge':
      return TOY_PLATFORM_MODEL_ASSETS.toy_castle_extendable_ruler_bridge;
    case 'tilting_board':
      return TOY_PLATFORM_MODEL_ASSETS.toy_castle_tilt_balance_board;
    case 'irregular_fragment':
      return TOY_PLATFORM_MODEL_ASSETS.toy_broken_puzzle_piece;
    case 'blink_panel':
      return TOY_PLATFORM_MODEL_ASSETS.toy_blink_acrylic_panel;
    case 'crumble_tile':
      return profile.themeZone === 'castle'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_cracked_puzzle_crumble
        : TOY_PLATFORM_MODEL_ASSETS.toy_crumble_cookie_tile;
    case 'trampoline':
      return TOY_PLATFORM_MODEL_ASSETS.toy_trampoline_pad;
    case 'bounce_pad':
      return TOY_PLATFORM_MODEL_ASSETS.toy_cloud_bounce_pad;
    case 'conveyor_belt':
      return TOY_PLATFORM_MODEL_ASSETS.toy_conveyor_track_belt;
    case 'ice_block':
      return TOY_PLATFORM_MODEL_ASSETS.toy_plastic_ice_block;
    case 'sticky_pad':
      return TOY_PLATFORM_MODEL_ASSETS.toy_gummy_sticky_pad;
    case 'goal_crown':
      return profile.themeZone === 'olympus'
        ? TOY_PLATFORM_MODEL_ASSETS.toy_olympus_star_finale
        : TOY_PLATFORM_MODEL_ASSETS.toy_castle_crown_platform;
    default:
      return null;
  }
}
