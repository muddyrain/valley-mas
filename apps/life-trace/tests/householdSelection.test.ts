import { describe, expect, it } from 'vitest';
import { findHouseholdById, resolveHouseholdSelection } from '../src/lib/householdSelection';
import type { HouseholdSummary } from '../src/types';

const households: HouseholdSummary[] = [
  {
    id: '-101',
    name: '我的空间',
    kind: 'personal',
    status: 'active',
    ownerUserId: '101',
    role: 'owner',
    memberCount: 1,
  },
  {
    id: '301',
    name: '开心家庭',
    kind: 'shared',
    status: 'active',
    ownerUserId: '101',
    role: 'owner',
    memberCount: 3,
  },
  {
    id: '302',
    name: '爸妈家',
    kind: 'shared',
    status: 'active',
    ownerUserId: '102',
    role: 'member',
    memberCount: 2,
  },
];

describe('household selection', () => {
  it('uses the server current household before stale local preference', () => {
    expect(
      resolveHouseholdSelection({
        households,
        serverCurrentHouseholdId: '301',
        preferredHouseholdId: '302',
      }),
    ).toBe('301');
  });

  it('keeps the optimistic selection while settings persistence is still settling', () => {
    expect(
      resolveHouseholdSelection({
        households,
        optimisticHouseholdId: '301',
        serverCurrentHouseholdId: '-101',
        preferredHouseholdId: '301',
      }),
    ).toBe('301');
  });

  it('lets explicit create or join targets override the current household', () => {
    expect(
      resolveHouseholdSelection({
        households,
        explicitHouseholdId: '302',
        optimisticHouseholdId: '301',
        serverCurrentHouseholdId: '301',
      }),
    ).toBe('302');
  });

  it('does not treat the first household as selected when a selected id cannot be found', () => {
    expect(findHouseholdById(households, 'missing')).toBeNull();
    expect(findHouseholdById(households, '')).toBeNull();
  });
});
