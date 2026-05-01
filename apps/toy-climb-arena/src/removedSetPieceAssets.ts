import type { ClimberSetPieceAssetId } from './types';

export const REMOVED_SETPIECE_ASSET_IDS: ReadonlySet<ClimberSetPieceAssetId> = new Set();

export function isRemovedSetPieceAsset(assetId: ClimberSetPieceAssetId): boolean {
  return REMOVED_SETPIECE_ASSET_IDS.has(assetId);
}
