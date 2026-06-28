import type { SettlementSummary, SettlementTier } from '@/shared/types';

export type SettlementStabilityLevel = 'calm' | 'uneasy' | 'plotting';

export interface SettlementStabilityInput {
  tier: SettlementTier;
  isCapital: boolean;
  previous?: Pick<SettlementSummary, 'loyalty' | 'unrest' | 'revoltProgress'> | null;
  adminDistance: number | null;
  regionsPerSettlement: number;
  recentlyConquered: boolean;
  capitalRecentlyFell?: boolean;
}

export interface SettlementStability {
  loyalty: number;
  unrest: number;
  revoltProgress: number;
}

export interface FactionSettlementStabilitySummary {
  settlementCount: number;
  averageLoyalty: number;
  averageUnrest: number;
  maxRevoltProgress: number;
  riskLevel: SettlementStabilityLevel;
}

export interface SettlementRevoltWarning {
  settlement: SettlementSummary;
  previousProgress: number;
  currentProgress: number;
}

export const REVOLT_WARNING_PROGRESS_THRESHOLD = 0.35;
export const REVOLT_OUTBREAK_PROGRESS_THRESHOLD = 1;
const CAPITAL_FALL_LOYALTY_SHOCK = 0.1;
const CAPITAL_FALL_UNREST_SHOCK = 0.18;
const CAPITAL_FALL_REVOLT_SHOCK = 0.08;

export function advanceSettlementStability(input: SettlementStabilityInput): SettlementStability {
  const targetLoyalty = getTargetLoyalty(input);
  const previousLoyalty = input.previous?.loyalty;
  let loyalty =
    previousLoyalty == null
      ? targetLoyalty
      : clamp(previousLoyalty + (targetLoyalty - previousLoyalty) * 0.22, 0, 1);
  if (!input.isCapital && input.capitalRecentlyFell) {
    loyalty = clamp(loyalty - CAPITAL_FALL_LOYALTY_SHOCK, 0, 1);
  }

  const targetUnrest = input.isCapital
    ? 0
    : clamp((0.62 - loyalty) / 0.46 + (input.capitalRecentlyFell ? CAPITAL_FALL_UNREST_SHOCK : 0), 0, 1);
  const previousUnrest = input.previous?.unrest;
  const unrest =
    previousUnrest == null
      ? targetUnrest
      : clamp(previousUnrest + (targetUnrest - previousUnrest) * 0.28, 0, 1);

  if (input.isCapital) {
    return { loyalty: Math.max(loyalty, 0.8), unrest: 0, revoltProgress: 0 };
  }

  const previousProgress = input.previous?.revoltProgress ?? 0;
  const revoltProgressBase =
    loyalty < 0.34 && unrest > 0.48
      ? previousProgress + 0.008 + unrest * 0.014
      : previousProgress - 0.055;
  const revoltProgress = revoltProgressBase + (input.capitalRecentlyFell ? CAPITAL_FALL_REVOLT_SHOCK : 0);

  return {
    loyalty,
    unrest,
    revoltProgress: clamp(revoltProgress, 0, 1),
  };
}

export function summarizeFactionSettlementStability(
  settlements: readonly SettlementSummary[],
): FactionSettlementStabilitySummary {
  if (settlements.length === 0) {
    return {
      settlementCount: 0,
      averageLoyalty: 0,
      averageUnrest: 0,
      maxRevoltProgress: 0,
      riskLevel: 'calm',
    };
  }

  const averageLoyalty = average(settlements.map((settlement) => settlement.loyalty));
  const averageUnrest = average(settlements.map((settlement) => settlement.unrest));
  const maxRevoltProgress = Math.max(...settlements.map((settlement) => settlement.revoltProgress));
  return {
    settlementCount: settlements.length,
    averageLoyalty,
    averageUnrest,
    maxRevoltProgress,
    riskLevel: getStabilityLevel(averageLoyalty, averageUnrest, maxRevoltProgress),
  };
}

export function getSettlementRevoltWarnings(input: {
  previous: readonly SettlementSummary[];
  current: readonly SettlementSummary[];
  threshold?: number;
}): SettlementRevoltWarning[] {
  const threshold = input.threshold ?? REVOLT_WARNING_PROGRESS_THRESHOLD;
  const previousById = new Map(input.previous.map((settlement) => [settlement.id, settlement]));
  const warnings: SettlementRevoltWarning[] = [];

  for (const settlement of input.current) {
    if (settlement.isCapital) continue;
    const previousProgress = previousById.get(settlement.id)?.revoltProgress ?? 0;
    if (previousProgress < threshold && settlement.revoltProgress >= threshold) {
      warnings.push({
        settlement,
        previousProgress,
        currentProgress: settlement.revoltProgress,
      });
    }
  }

  return warnings;
}

export function getSettlementRevoltOutbreaks(input: {
  previous: readonly SettlementSummary[];
  current: readonly SettlementSummary[];
  threshold?: number;
}): SettlementRevoltWarning[] {
  const threshold = input.threshold ?? REVOLT_OUTBREAK_PROGRESS_THRESHOLD;
  const previousById = new Map(input.previous.map((settlement) => [settlement.id, settlement]));
  const outbreaks: SettlementRevoltWarning[] = [];

  for (const settlement of input.current) {
    if (settlement.isCapital) continue;
    const previousProgress = previousById.get(settlement.id)?.revoltProgress ?? 0;
    if (previousProgress < threshold && settlement.revoltProgress >= threshold) {
      outbreaks.push({
        settlement,
        previousProgress,
        currentProgress: settlement.revoltProgress,
      });
    }
  }

  return outbreaks;
}

function getTargetLoyalty(input: SettlementStabilityInput): number {
  const tierBase: Record<SettlementTier, number> = {
    capital: 0.96,
    city: 0.86,
    town: 0.8,
    village: 0.76,
  };
  const distancePenalty =
    input.adminDistance == null ? 0.16 : smoothstep(5, 18, input.adminDistance) * 0.28;
  const overextensionPenalty = smoothstep(48, 96, input.regionsPerSettlement) * 0.2;
  const recentConquestPenalty = input.recentlyConquered ? 0.24 : 0;
  const capitalFloor = input.isCapital ? 0.82 : 0.08;

  return clamp(
    tierBase[input.tier] - distancePenalty - overextensionPenalty - recentConquestPenalty,
    capitalFloor,
    1,
  );
}

function getStabilityLevel(
  averageLoyalty: number,
  averageUnrest: number,
  maxRevoltProgress: number,
): SettlementStabilityLevel {
  if (maxRevoltProgress >= 0.35 || averageLoyalty < 0.46 || averageUnrest >= 0.42) return 'plotting';
  if (maxRevoltProgress >= 0.12 || averageLoyalty < 0.62 || averageUnrest >= 0.2) return 'uneasy';
  return 'calm';
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
