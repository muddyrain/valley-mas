import type { HouseholdSummary } from '@/types';

type ResolveHouseholdSelectionOptions = {
  households: HouseholdSummary[];
  explicitHouseholdId?: string;
  optimisticHouseholdId?: string;
  serverCurrentHouseholdId?: string;
  preferredHouseholdId?: string;
};

function hasHousehold(households: HouseholdSummary[], householdId?: string) {
  const trimmed = householdId?.trim() ?? '';
  return Boolean(trimmed && households.some((item) => item.id === trimmed));
}

export function resolveHouseholdSelection({
  households,
  explicitHouseholdId,
  optimisticHouseholdId,
  serverCurrentHouseholdId,
  preferredHouseholdId,
}: ResolveHouseholdSelectionOptions) {
  const explicitId = explicitHouseholdId?.trim() ?? '';
  if (hasHousehold(households, explicitId)) {
    return explicitId;
  }

  const optimisticId = optimisticHouseholdId?.trim() ?? '';
  if (hasHousehold(households, optimisticId)) {
    return optimisticId;
  }

  const serverId = serverCurrentHouseholdId?.trim() ?? '';
  if (hasHousehold(households, serverId)) {
    return serverId;
  }

  const preferredId = preferredHouseholdId?.trim() ?? '';
  if (hasHousehold(households, preferredId)) {
    return preferredId;
  }

  return households[0]?.id ?? '';
}

export function findHouseholdById(households: HouseholdSummary[], householdId?: string) {
  const trimmed = householdId?.trim() ?? '';
  if (!trimmed) {
    return null;
  }

  return households.find((item) => item.id === trimmed) ?? null;
}
