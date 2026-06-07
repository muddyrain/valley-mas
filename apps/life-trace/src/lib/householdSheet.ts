import type { HouseholdSummary } from '@/types';

export function sortHouseholdsForSheet(households: HouseholdSummary[]) {
  return [...households].sort((left, right) => {
    const rank = (household: HouseholdSummary) => {
      if (household.kind === 'personal') {
        return 0;
      }
      if (household.status === 'active') {
        return 1;
      }
      return 2;
    };

    return rank(left) - rank(right);
  });
}
