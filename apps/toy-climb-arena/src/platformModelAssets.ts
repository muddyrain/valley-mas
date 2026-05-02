import toyBarnHayBaleUrl from '../assets/models/platforms/toy_barn_hay_bale.glb';
import toyBarrelRoundTopUrl from '../assets/models/platforms/toy_barrel_round_top.glb';
import toyBrokenPuzzlePieceUrl from '../assets/models/platforms/toy_broken_puzzle_piece.glb';
import toyCrumbleCookieTileUrl from '../assets/models/platforms/toy_crumble_cookie_tile.glb';
import toyNarrowPlankS3Url from '../assets/models/platforms/toy_narrow_plank_s3.glb';
import toyRopePlankBridgeUrl from '../assets/models/platforms/toy_rope_plank_bridge.glb';
import toyRoundDiscS2Url from '../assets/models/platforms/toy_round_disc_s2.glb';
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
  | 'toy_wood_crate_step'
  | 'toy_barrel_round_top'
  | 'toy_rope_plank_bridge'
  | 'toy_broken_puzzle_piece'
  | 'toy_crumble_cookie_tile'
  | 'toy_trampoline_pad';

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
      return TOY_PLATFORM_MODEL_ASSETS.toy_barn_hay_bale;
    case 'stacked_steps':
      return TOY_PLATFORM_MODEL_ASSETS.toy_wood_crate_step;
    case 'round_disc':
    case 'balance_pole':
      return TOY_PLATFORM_MODEL_ASSETS.toy_barrel_round_top;
    case 'narrow_plank':
      return TOY_PLATFORM_MODEL_ASSETS.toy_rope_plank_bridge;
    case 'irregular_fragment':
    case 'blink_panel':
      return TOY_PLATFORM_MODEL_ASSETS.toy_broken_puzzle_piece;
    case 'crumble_tile':
      return TOY_PLATFORM_MODEL_ASSETS.toy_crumble_cookie_tile;
    case 'trampoline':
    case 'bounce_pad':
      return TOY_PLATFORM_MODEL_ASSETS.toy_trampoline_pad;
    default:
      return null;
  }
}
