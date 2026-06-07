import { describe, expect, it } from 'vitest';
import { sortHouseholdsForSheet } from '@/lib/householdSheet';
import type { HouseholdSummary } from '@/types';

function buildHousehold(overrides: Partial<HouseholdSummary>): HouseholdSummary {
  return {
    id: '1',
    name: '默认空间',
    kind: 'shared',
    status: 'active',
    ownerUserId: '101',
    role: 'member',
    memberCount: 2,
    ...overrides,
  };
}

describe('sortHouseholdsForSheet', () => {
  it('keeps personal space visible before shared families', () => {
    const households = [
      buildHousehold({ id: 'shared-1', name: '周末家庭' }),
      buildHousehold({
        id: 'personal-1',
        name: '我的空间',
        kind: 'personal',
        role: 'owner',
        memberCount: 1,
      }),
      buildHousehold({ id: 'shared-2', name: '旧家庭', status: 'dissolved' }),
    ];

    expect(sortHouseholdsForSheet(households).map((item) => item.id)).toEqual([
      'personal-1',
      'shared-1',
      'shared-2',
    ]);
  });
});
