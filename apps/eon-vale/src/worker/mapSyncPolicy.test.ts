import { describe, expect, it } from 'vitest';
import { mapSyncRequiresFullRebuild } from './mapSyncPolicy';

describe('map synchronization policy', () => {
  it('keeps periodic environment refreshes incremental to avoid visible flashing', () => {
    expect(mapSyncRequiresFullRebuild('periodic')).toBe(false);
    expect(mapSyncRequiresFullRebuild('edit')).toBe(false);
  });

  it('rebuilds once when replacing the complete world', () => {
    expect(mapSyncRequiresFullRebuild('initialize')).toBe(true);
    expect(mapSyncRequiresFullRebuild('load')).toBe(true);
  });
});
