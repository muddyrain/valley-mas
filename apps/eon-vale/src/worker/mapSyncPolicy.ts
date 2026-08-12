export type MapSyncReason = 'initialize' | 'load' | 'edit' | 'periodic';

export function mapSyncRequiresFullRebuild(reason: MapSyncReason): boolean {
  return reason === 'initialize' || reason === 'load';
}
