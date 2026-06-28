import type { MapData } from '@/core/map';
import type {
  FactionId,
  FactionSummary,
  RegionId,
  SettlementSummary,
  Tick,
  WarId,
  WarSummary,
} from '@/shared/types';
import { computeRegionStrategicProfile } from './geoStrategy';
import type { SimEvent } from './types';

const ACTIVE_WAR_TARGET_WEIGHT = 8;
const NO_CONTACT_TRUCE_TICKS = 8;
const TRUCE_TICKS = 40;
const DEFAULT_BORDER_WAR_LIMIT = 2;
const BORDER_WAR_FATIGUE_START_TICKS = 24;
const BORDER_WAR_FATIGUE_FULL_TICKS = 96;
const REVOLT_WAR_FATIGUE_START_TICKS = 56;
const REVOLT_WAR_FATIGUE_FULL_TICKS = 180;
const CAPITAL_FALL_SHOCK_TICKS = 8;
const SETTLEMENT_SIEGE_PROGRESS_PER_REPEL: Record<SettlementSummary['tier'], number> = {
  village: 0.24,
  town: 0.2,
  city: 0.16,
  capital: 0.12,
};
const MIN_GEOGRAPHIC_SIEGE_PROGRESS_FACTOR = 0.55;

export interface WarTransition {
  type: 'truce' | 'ended' | 'expired';
  war: WarSummary;
  reason?: 'no_contact' | 'fatigue';
  winnerFactionId?: FactionId | null;
  loserFactionId?: FactionId | null;
}

export interface AdvanceWarStatesResult {
  wars: WarSummary[];
  updatedWars: WarSummary[];
  endedWarIds: WarId[];
  transitions: WarTransition[];
}

export interface AdvanceSettlementSiegesResult {
  wars: WarSummary[];
  updatedWars: WarSummary[];
}

export interface ApplyCapitalFallWarShocksResult {
  wars: WarSummary[];
  updatedWars: WarSummary[];
}

export interface BorderWarDeclarationCandidate {
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  contactCount: number;
}

export interface WarStatusOverlaySegment {
  warId: WarId;
  status: WarSummary['status'];
  a: { x: number; y: number };
  b: { x: number; y: number };
  leftFactionId: FactionId;
  rightFactionId: FactionId;
  fatigue: number;
  width: number;
}

export interface SettlementSiegeOverlayRegion {
  warId: WarId;
  regionId: RegionId;
  attackerFactionId: FactionId;
  defenderFactionId: FactionId;
  progress: number;
}

export function getActiveWarTargetWeight(
  wars: readonly WarSummary[] | undefined,
  attackerId: FactionId,
  defenderId: FactionId,
): number {
  return isActiveWarPair(wars, attackerId, defenderId) ? ACTIVE_WAR_TARGET_WEIGHT : 1;
}

export function isActiveWarPair(
  wars: readonly WarSummary[] | undefined,
  factionA: FactionId,
  factionB: FactionId,
): boolean {
  if (!wars || factionA === factionB) return false;
  return wars.some(
    (war) =>
      war.status === 'active' &&
      ((war.attackerFactionId === factionA && war.defenderFactionId === factionB) ||
        (war.attackerFactionId === factionB && war.defenderFactionId === factionA)),
  );
}

export function isTrucePair(
  wars: readonly WarSummary[] | undefined,
  factionA: FactionId,
  factionB: FactionId,
): boolean {
  if (!wars || factionA === factionB) return false;
  return wars.some(
    (war) =>
      war.status === 'truce' &&
      ((war.attackerFactionId === factionA && war.defenderFactionId === factionB) ||
        (war.attackerFactionId === factionB && war.defenderFactionId === factionA)),
  );
}

export function selectBorderWarDeclarations(input: {
  map: MapData;
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
  limit?: number;
  minContactCount?: number;
}): BorderWarDeclarationCandidate[] {
  const limit = input.limit ?? DEFAULT_BORDER_WAR_LIMIT;
  if (limit <= 0) return [];

  const liveFactions = new Map<FactionId, FactionSummary>();
  for (const faction of input.factions) {
    if ((faction.regions ?? 0) > 0) liveFactions.set(faction.id, faction);
  }

  const contactByPair = new Map<
    string,
    { a: FactionId; b: FactionId; contactCount: number }
  >();

  for (const province of input.map.provinces) {
    if (province.terrain === 'ocean' || province.ownerFactionId == null) continue;
    const owner = province.ownerFactionId;
    if (!liveFactions.has(owner)) continue;

    for (const neighborId of province.neighbors) {
      const neighbor = input.map.provinces[neighborId as unknown as number];
      const neighborOwner = neighbor?.ownerFactionId;
      if (!neighbor || neighbor.terrain === 'ocean' || neighborOwner == null || neighborOwner === owner) {
        continue;
      }
      if (!liveFactions.has(neighborOwner)) continue;

      const pair = normalizePair(owner, neighborOwner);
      if (
        isActiveWarPair(input.wars, pair.a, pair.b) ||
        isTrucePair(input.wars, pair.a, pair.b)
      ) {
        continue;
      }
      const key = getPairKey(pair.a, pair.b);
      const existing = contactByPair.get(key);
      if (existing) {
        existing.contactCount += 1;
      } else {
        contactByPair.set(key, { ...pair, contactCount: 1 });
      }
    }
  }

  const minContactCount = input.minContactCount ?? 1;
  return Array.from(contactByPair.values())
    .map(({ a, b, contactCount }) => {
      const factionA = liveFactions.get(a);
      const factionB = liveFactions.get(b);
      const regionsA = factionA?.regions ?? 0;
      const regionsB = factionB?.regions ?? 0;
      const attackerFactionId =
        regionsA > regionsB ? a : regionsB > regionsA ? b : compareFactionId(a, b) <= 0 ? a : b;
      const defenderFactionId = attackerFactionId === a ? b : a;
      return { attackerFactionId, defenderFactionId, contactCount };
    })
    .filter((candidate) => candidate.contactCount >= minContactCount)
    .sort((left, right) => {
      const contactDelta = right.contactCount - left.contactCount;
      if (contactDelta !== 0) return contactDelta;
      const attackerDelta = compareFactionId(left.attackerFactionId, right.attackerFactionId);
      if (attackerDelta !== 0) return attackerDelta;
      return compareFactionId(left.defenderFactionId, right.defenderFactionId);
    })
    .slice(0, limit);
}

export function getWarStatusOverlaySegments(input: {
  map: MapData;
  wars: readonly WarSummary[];
}): WarStatusOverlaySegment[] {
  const warByPair = new Map<string, WarSummary>();
  for (const war of input.wars) {
    const key = getPairKey(war.attackerFactionId, war.defenderFactionId);
    const existing = warByPair.get(key);
    if (!existing || (existing.status === 'truce' && war.status === 'active')) {
      warByPair.set(key, war);
    }
  }

  const segments: WarStatusOverlaySegment[] = [];
  for (const edge of input.map.borders) {
    if (edge.right == null) continue;
    const leftProvince = input.map.provinces[edge.left as unknown as number];
    const rightProvince = input.map.provinces[edge.right as unknown as number];
    if (!leftProvince || !rightProvince) continue;
    if (leftProvince.terrain === 'ocean' || rightProvince.terrain === 'ocean') continue;
    const leftOwner = leftProvince.ownerFactionId ?? null;
    const rightOwner = rightProvince.ownerFactionId ?? null;
    if (leftOwner == null || rightOwner == null || leftOwner === rightOwner) continue;

    const war = warByPair.get(getPairKey(leftOwner, rightOwner));
    if (!war) continue;
    const fatigue = clamp(war.fatigue ?? 0, 0, 1);
    segments.push({
      warId: war.id,
      status: war.status,
      a: edge.a,
      b: edge.b,
      leftFactionId: leftOwner,
      rightFactionId: rightOwner,
      fatigue,
      width: war.status === 'active' ? 2.4 + fatigue * 1.4 : 1.4,
    });
  }
  return segments;
}

export function getSettlementSiegeOverlayRegions(input: {
  map: MapData;
  wars: readonly WarSummary[];
  selectedFactionId?: FactionId | null;
}): SettlementSiegeOverlayRegion[] {
  const regions: SettlementSiegeOverlayRegion[] = [];

  for (const war of input.wars) {
    if (war.status !== 'active') continue;
    for (const progress of war.siegeProgress ?? []) {
      if (progress.progress <= 0) continue;
      if (
        input.selectedFactionId != null &&
        input.selectedFactionId !== progress.attackerFactionId &&
        input.selectedFactionId !== progress.defenderFactionId
      ) {
        continue;
      }

      const province = input.map.provinces[progress.regionId as unknown as number];
      if (!province || province.terrain === 'ocean' || province.ownerFactionId !== progress.defenderFactionId) {
        continue;
      }

      regions.push({
        warId: war.id,
        regionId: progress.regionId,
        attackerFactionId: progress.attackerFactionId,
        defenderFactionId: progress.defenderFactionId,
        progress: round2(clamp(progress.progress, 0, 1)),
      });
    }
  }

  return regions;
}

export function advanceSettlementSieges(input: {
  wars: readonly WarSummary[];
  settlements: readonly SettlementSummary[];
  events: readonly SimEvent[];
  tick: Tick;
  map?: MapData;
}): AdvanceSettlementSiegesResult {
  const settlementByRegion = new Map<number, SettlementSummary>(
    input.settlements.map((settlement) => [settlement.regionId as unknown as number, settlement]),
  );
  const wars: WarSummary[] = [];
  const updatedWars: WarSummary[] = [];

  for (const war of input.wars) {
    if (war.status !== 'active') {
      wars.push(war);
      continue;
    }

    let nextWar = war;
    let changed = false;
    for (const event of input.events) {
      if ((event.type !== 'repel' && event.type !== 'capture') || event.regionId == null) continue;
      if (event.attackerId == null || event.defenderId == null) continue;
      if (!isWarEventPair(war, event.attackerId, event.defenderId)) continue;

      const settlement = settlementByRegion.get(event.regionId as unknown as number);
      if (!settlement || settlement.factionId !== event.defenderId) continue;

      const progress = [...(nextWar.siegeProgress ?? [])];
      const existingIndex = progress.findIndex(
        (entry) =>
          entry.settlementId === settlement.id &&
          entry.attackerFactionId === event.attackerId &&
          entry.defenderFactionId === event.defenderId,
      );

      if (event.type === 'capture') {
        if (existingIndex >= 0) {
          progress.splice(existingIndex, 1);
          nextWar = { ...nextWar, siegeProgress: progress.length === 0 ? undefined : progress };
          changed = true;
        }
        continue;
      }

      const previous = existingIndex >= 0 ? progress[existingIndex].progress : 0;
      const targetProvince = input.map?.provinces[settlement.regionId as unknown as number];
      const progressDelta = getSettlementSiegeProgressDelta(settlement, targetProvince);
      const nextProgress = round2(
        clamp(previous + progressDelta, 0, 0.95),
      );
      const nextEntry = {
        settlementId: settlement.id,
        regionId: settlement.regionId,
        attackerFactionId: event.attackerId,
        defenderFactionId: event.defenderId,
        progress: nextProgress,
        lastUpdatedTick: input.tick,
      };
      if (existingIndex >= 0) {
        progress[existingIndex] = nextEntry;
      } else {
        progress.push(nextEntry);
      }
      nextWar = { ...nextWar, siegeProgress: progress };
      changed = true;
    }

    wars.push(nextWar);
    if (changed) updatedWars.push(nextWar);
  }

  return { wars, updatedWars };
}

function getSettlementSiegeProgressDelta(
  settlement: SettlementSummary,
  province: MapData['provinces'][number] | undefined,
): number {
  const base = SETTLEMENT_SIEGE_PROGRESS_PER_REPEL[settlement.tier];
  if (!province || province.terrain === 'ocean') return base;

  const profile = computeRegionStrategicProfile(province);
  const defensePressure = Math.max(0, profile.defensiveness - 0.35) * 0.28;
  const travelPressure = Math.max(0, profile.travelCost - 1) * 0.12;
  const factor = clamp(1 - defensePressure - travelPressure, MIN_GEOGRAPHIC_SIEGE_PROGRESS_FACTOR, 1);
  return base * factor;
}

export function advanceWarStates(input: {
  map: MapData;
  factions: readonly FactionSummary[];
  wars: readonly WarSummary[];
  tick: Tick;
}): AdvanceWarStatesResult {
  const regionsByFaction = new Map<FactionId, number>(
    input.factions.map((faction) => [faction.id, faction.regions ?? 0]),
  );
  const wars: WarSummary[] = [];
  const updatedWars: WarSummary[] = [];
  const endedWarIds: WarId[] = [];
  const transitions: WarTransition[] = [];

  for (const war of input.wars) {
    const attackerRegions = regionsByFaction.get(war.attackerFactionId) ?? 0;
    const defenderRegions = regionsByFaction.get(war.defenderFactionId) ?? 0;
    if (attackerRegions <= 0 || defenderRegions <= 0) {
      const winnerFactionId =
        attackerRegions > 0 ? war.attackerFactionId : defenderRegions > 0 ? war.defenderFactionId : null;
      const loserFactionId =
        attackerRegions <= 0 ? war.attackerFactionId : defenderRegions <= 0 ? war.defenderFactionId : null;
      endedWarIds.push(war.id);
      transitions.push({ type: 'ended', war, winnerFactionId, loserFactionId });
      continue;
    }

    if (war.status === 'truce') {
      const truceUntil = war.truceUntilTick ?? input.tick;
      if ((input.tick as unknown as number) >= (truceUntil as unknown as number)) {
        endedWarIds.push(war.id);
        transitions.push({ type: 'expired', war });
      } else {
        wars.push(war);
      }
      continue;
    }

    const contactCount = countFactionContactEdges(input.map, war.attackerFactionId, war.defenderFactionId);
    if (contactCount > 0) {
      const fatigue = computeWarFatigue({
        war,
        tick: input.tick,
        contactCount,
        attackerRegions,
        defenderRegions,
      });
      if (fatigue >= 1) {
        const truceWar: WarSummary = {
          ...war,
          status: 'truce',
          fatigue: 1,
          lastContactTick: input.tick,
          truceUntilTick: ((input.tick as unknown as number) + getTruceTicks(war)) as Tick,
        };
        wars.push(truceWar);
        updatedWars.push(truceWar);
        transitions.push({ type: 'truce', reason: 'fatigue', war: truceWar });
        continue;
      }

      const contactedWar =
        war.lastContactTick === input.tick && war.fatigue === fatigue
          ? war
          : { ...war, fatigue, lastContactTick: input.tick };
      wars.push(contactedWar);
      if (contactedWar !== war) updatedWars.push(contactedWar);
      continue;
    }

    const lastContact = war.lastContactTick ?? war.startedTick;
    const noContactTicks = (input.tick as unknown as number) - (lastContact as unknown as number);
    if (noContactTicks >= NO_CONTACT_TRUCE_TICKS) {
      const truceWar: WarSummary = {
        ...war,
        status: 'truce',
        truceUntilTick: ((input.tick as unknown as number) + getTruceTicks(war)) as Tick,
      };
      wars.push(truceWar);
      updatedWars.push(truceWar);
      transitions.push({ type: 'truce', reason: 'no_contact', war: truceWar });
    } else {
      wars.push(war);
    }
  }

  return { wars, updatedWars, endedWarIds, transitions };
}

export function applyCapitalFallWarShocks(input: {
  wars: readonly WarSummary[];
  fallenFactionIds: ReadonlySet<FactionId>;
  tick: Tick;
  durationTicks?: number;
}): ApplyCapitalFallWarShocksResult {
  if (input.fallenFactionIds.size === 0) {
    return { wars: [...input.wars], updatedWars: [] };
  }

  const durationTicks = input.durationTicks ?? CAPITAL_FALL_SHOCK_TICKS;
  const untilTick = ((input.tick as unknown as number) + durationTicks) as Tick;
  const wars: WarSummary[] = [];
  const updatedWars: WarSummary[] = [];

  for (const war of input.wars) {
    if (
      war.status !== 'active' ||
      (!input.fallenFactionIds.has(war.attackerFactionId) &&
        !input.fallenFactionIds.has(war.defenderFactionId))
    ) {
      wars.push(war);
      continue;
    }

    const shocks = [...(war.capitalShocks ?? [])];
    for (const factionId of input.fallenFactionIds) {
      if (factionId !== war.attackerFactionId && factionId !== war.defenderFactionId) continue;
      const existingIndex = shocks.findIndex((shock) => shock.factionId === factionId);
      const nextShock = {
        factionId,
        startedTick: input.tick,
        untilTick,
      };
      if (existingIndex >= 0) {
        shocks[existingIndex] = nextShock;
      } else {
        shocks.push(nextShock);
      }
    }

    const nextWar = { ...war, capitalShocks: shocks };
    wars.push(nextWar);
    updatedWars.push(nextWar);
  }

  return { wars, updatedWars };
}

function isWarEventPair(war: WarSummary, attackerId: FactionId, defenderId: FactionId): boolean {
  return (
    (war.attackerFactionId === attackerId && war.defenderFactionId === defenderId) ||
    (war.attackerFactionId === defenderId && war.defenderFactionId === attackerId)
  );
}

function normalizePair(a: FactionId, b: FactionId): { a: FactionId; b: FactionId } {
  return compareFactionId(a, b) <= 0 ? { a, b } : { a: b, b: a };
}

function getPairKey(a: FactionId, b: FactionId): string {
  const pair = normalizePair(a, b);
  return `${pair.a as unknown as number}:${pair.b as unknown as number}`;
}

function compareFactionId(a: FactionId, b: FactionId): number {
  return (a as unknown as number) - (b as unknown as number);
}

function computeWarFatigue(input: {
  war: WarSummary;
  tick: Tick;
  contactCount: number;
  attackerRegions: number;
  defenderRegions: number;
}): number {
  const elapsed = (input.tick as unknown as number) - (input.war.startedTick as unknown as number);
  const fatigueStart =
    input.war.kind === 'revolt' ? REVOLT_WAR_FATIGUE_START_TICKS : BORDER_WAR_FATIGUE_START_TICKS;
  const fatigueFull =
    input.war.kind === 'revolt' ? REVOLT_WAR_FATIGUE_FULL_TICKS : BORDER_WAR_FATIGUE_FULL_TICKS;
  const durationPressure = smoothstep(fatigueStart, fatigueFull, elapsed);
  const contactPressure = clamp(input.contactCount / 24, 0, 0.28);
  const territorialSwing = getTerritorialSwingPressure(input);
  return round2(clamp(durationPressure + contactPressure + territorialSwing, 0, 1));
}

function getTerritorialSwingPressure(input: {
  war: WarSummary;
  attackerRegions: number;
  defenderRegions: number;
}): number {
  const attackerStart = input.war.attackerStartRegions ?? input.attackerRegions;
  const defenderStart = input.war.defenderStartRegions ?? input.defenderRegions;
  const attackerSwing = Math.abs(input.attackerRegions - attackerStart) / Math.max(1, attackerStart);
  const defenderSwing = Math.abs(input.defenderRegions - defenderStart) / Math.max(1, defenderStart);
  return clamp(Math.max(attackerSwing, defenderSwing) * 0.35, 0, 0.22);
}

function getTruceTicks(war: WarSummary): number {
  return war.kind === 'revolt' ? Math.round(TRUCE_TICKS * 0.75) : TRUCE_TICKS;
}

function countFactionContactEdges(map: MapData, factionA: FactionId, factionB: FactionId): number {
  let count = 0;
  for (const province of map.provinces) {
    if (province.terrain === 'ocean' || province.ownerFactionId !== factionA) continue;
    for (const neighborId of province.neighbors) {
      const neighbor = map.provinces[neighborId as unknown as number];
      if (neighbor?.terrain !== 'ocean' && neighbor?.ownerFactionId === factionB) {
        count += 1;
      }
    }
  }
  return count;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
