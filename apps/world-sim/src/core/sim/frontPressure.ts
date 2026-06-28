import type { MapData } from '@/core/map';
import type { FactionId, RegionId } from '@/shared/types';

const BASE_WAR_POTENTIAL_PER_REGION = 100;
const MIN_FRONT_WEIGHT = 0.2;
const ENEMY_WEAKNESS_WEIGHT = 80;
const CONTACT_EDGE_WEIGHT = 0.05;
const MAX_MULTI_FRONT_PENALTY = 0.08;
const SUPPLY_DISTANCE_LIMIT = 600;
const FRONT_POWER_BIAS_SCALE = 0.35;
const LOCAL_SURROUND_BIAS_SCALE = 0.08;
const PRESSURE_TARGET_WEIGHT_SCALE = 0.25;
const PRESSURE_TARGET_WEIGHT_MAX = 2;

export type FrontPressureFaction = {
  id: FactionId;
  regions: number;
  centroidRegionId: RegionId | null;
};

export type Front = {
  key: string;
  a: FactionId;
  b: FactionId;
  borderA: Set<number>;
  borderB: Set<number>;
  contactEdges: number;
};

export type FrontAllocation = {
  frontKey: string;
  factionId: FactionId;
  troops: number;
  supply: number;
  hostileFrontCount: number;
  multiFrontPenalty: number;
};

export type FrontPressureState = {
  fronts: Map<string, Front>;
  allocations: Map<string, FrontAllocation>;
  hostileFrontCountByFaction: Map<FactionId, number>;
};

export type FrontBattlePressure = {
  attackerPower: number;
  defenderPower: number;
  frontBias: number;
  localSurroundBias: number;
  attackerSupply: number;
  multiFrontPenalty: number;
  attackerFrontCount: number;
  defenderFrontCount: number;
};

export type FrontPressureLevel = 'none' | 'low' | 'medium' | 'high';

export type FrontPressureSummaryItem = {
  frontKey: string;
  enemyId: FactionId;
  contactEdges: number;
  myPower: number;
  enemyPower: number;
  supply: number;
  multiFrontPenalty: number;
  riskScore: number;
};

export type FactionFrontPressureSummary = {
  factionId: FactionId;
  frontCount: number;
  pressureLevel: FrontPressureLevel;
  totalWarPotential: number;
  averageSupply: number;
  multiFrontPenalty: number;
  fronts: FrontPressureSummaryItem[];
  highestRiskFront?: FrontPressureSummaryItem;
};

export type FrontPressureOverlaySegment = {
  frontKey: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  leftFactionId: FactionId;
  rightFactionId: FactionId;
  intensity: number;
  width: number;
};

export function buildFrontPressureState(input: {
  map: MapData;
  factions: FrontPressureFaction[];
  ownedTargetPreference: number;
}): FrontPressureState {
  const factionById = new Map(input.factions.map((faction) => [faction.id, faction]));
  const fronts = buildFronts(input.map);
  const frontsByFaction = groupFrontsByFaction(fronts);
  const hostileFrontCountByFaction = new Map<FactionId, number>();
  const allocations = new Map<string, FrontAllocation>();

  for (const [factionId, factionFronts] of frontsByFaction.entries()) {
    const faction = factionById.get(factionId);
    if (!faction) continue;

    const hostileFrontCount = factionFronts.length;
    hostileFrontCountByFaction.set(factionId, hostileFrontCount);

    const totalPotential = computeWarPotential(faction.regions);
    const multiFrontPenalty = smoothstep(1, 4, hostileFrontCount) * MAX_MULTI_FRONT_PENALTY;
    const weightedFronts = factionFronts.map((front) => {
      const enemyId = front.a === factionId ? front.b : front.a;
      const enemy = factionById.get(enemyId);
      const enemyRegions = Math.max(1, enemy?.regions ?? 1);
      return {
        front,
        weight:
          MIN_FRONT_WEIGHT +
          (1 / enemyRegions) * ENEMY_WEAKNESS_WEIGHT +
          front.contactEdges * CONTACT_EDGE_WEIGHT +
          input.ownedTargetPreference,
      };
    });
    const totalWeight = weightedFronts.reduce((sum, item) => sum + item.weight, 0) || 1;

    for (const { front, weight } of weightedFronts) {
      const border = front.a === factionId ? front.borderA : front.borderB;
      allocations.set(allocationKey(front.key, factionId), {
        frontKey: front.key,
        factionId,
        troops: totalPotential * (weight / totalWeight),
        supply: computeSupply(input.map, faction, border),
        hostileFrontCount,
        multiFrontPenalty,
      });
    }
  }

  return { fronts, allocations, hostileFrontCountByFaction };
}

export function summarizeFactionFrontPressure(input: {
  state: FrontPressureState;
  faction: FrontPressureFaction;
}): FactionFrontPressureSummary {
  const { state, faction } = input;
  const relatedFronts = Array.from(state.fronts.values()).filter(
    (front) => front.a === faction.id || front.b === faction.id,
  );
  const totalWarPotential = computeWarPotential(faction.regions);
  const fronts = relatedFronts
    .map((front): FrontPressureSummaryItem => {
      const enemyId = front.a === faction.id ? front.b : front.a;
      const myAllocation = state.allocations.get(allocationKey(front.key, faction.id));
      const enemyAllocation = state.allocations.get(allocationKey(front.key, enemyId));
      const myPower = (myAllocation?.troops ?? 0) * (myAllocation?.supply ?? 1);
      const enemyPower = (enemyAllocation?.troops ?? 0) * (enemyAllocation?.supply ?? 1);
      const supply = myAllocation?.supply ?? 1;
      const multiFrontPenalty = myAllocation?.multiFrontPenalty ?? 0;
      const riskScore = enemyPower / Math.max(1, myPower) + (1 - supply) + multiFrontPenalty;

      return {
        frontKey: front.key,
        enemyId,
        contactEdges: front.contactEdges,
        myPower,
        enemyPower,
        supply,
        multiFrontPenalty,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);

  const frontCount = fronts.length;
  const averageSupply =
    frontCount === 0 ? 1 : fronts.reduce((sum, front) => sum + front.supply, 0) / frontCount;
  const multiFrontPenalty = fronts[0]?.multiFrontPenalty ?? 0;

  return {
    factionId: faction.id,
    frontCount,
    pressureLevel: getPressureLevel(frontCount),
    totalWarPotential,
    averageSupply,
    multiFrontPenalty,
    fronts,
    highestRiskFront: fronts[0],
  };
}

export function getFrontPressureOverlaySegments(input: {
  map: MapData;
  state: FrontPressureState;
}): FrontPressureOverlaySegment[] {
  const segments: FrontPressureOverlaySegment[] = [];

  for (const edge of input.map.borders) {
    if (edge.right == null) continue;
    const leftProvince = input.map.provinces[edge.left as unknown as number];
    const rightProvince = input.map.provinces[edge.right as unknown as number];
    if (!leftProvince || !rightProvince) continue;
    if (leftProvince.terrain === 'ocean' || rightProvince.terrain === 'ocean') continue;
    const leftOwner = leftProvince.ownerFactionId ?? null;
    const rightOwner = rightProvince.ownerFactionId ?? null;
    if (leftOwner == null || rightOwner == null || leftOwner === rightOwner) continue;

    const key = frontKey(leftOwner, rightOwner);
    if (!input.state.fronts.has(key)) continue;

    const intensity = getFrontOverlayIntensity(input.state, key, leftOwner, rightOwner);
    segments.push({
      frontKey: key,
      a: edge.a,
      b: edge.b,
      leftFactionId: leftOwner,
      rightFactionId: rightOwner,
      intensity,
      width: 1.2 + intensity * 2.2,
    });
  }

  return segments;
}

export function getDefenderPressureTargetWeight(
  state: FrontPressureState,
  defenderId: FactionId,
): number {
  const hostileFrontCount = state.hostileFrontCountByFaction.get(defenderId) ?? 1;
  return Math.min(
    PRESSURE_TARGET_WEIGHT_MAX,
    1 + Math.max(0, hostileFrontCount - 1) * PRESSURE_TARGET_WEIGHT_SCALE,
  );
}

export function resolveFrontBattlePressure(input: {
  state: FrontPressureState;
  map: MapData;
  attackerId: FactionId;
  defenderId: FactionId;
  targetRegion: RegionId;
  ownerOf: (id: RegionId) => FactionId | null;
}): FrontBattlePressure {
  const key = frontKey(input.attackerId, input.defenderId);
  const attackerAllocation = input.state.allocations.get(allocationKey(key, input.attackerId));
  const defenderAllocation = input.state.allocations.get(allocationKey(key, input.defenderId));

  const attackerPower = (attackerAllocation?.troops ?? 0) * (attackerAllocation?.supply ?? 1);
  const defenderPower = (defenderAllocation?.troops ?? 0) * (defenderAllocation?.supply ?? 1);

  return {
    attackerPower,
    defenderPower,
    frontBias: frontPowerBias(attackerPower, defenderPower),
    localSurroundBias: getLocalSurroundBias(input),
    attackerSupply: attackerAllocation?.supply ?? 1,
    multiFrontPenalty: attackerAllocation?.multiFrontPenalty ?? 0,
    attackerFrontCount: attackerAllocation?.hostileFrontCount ?? 1,
    defenderFrontCount: defenderAllocation?.hostileFrontCount ?? 1,
  };
}

function buildFronts(map: MapData): Map<string, Front> {
  const fronts = new Map<string, Front>();

  for (const province of map.provinces) {
    if (province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null) continue;

    for (const neighborId of province.neighbors) {
      const provinceNum = province.id as unknown as number;
      const neighborNum = neighborId as unknown as number;
      if (provinceNum > neighborNum) continue;

      const neighbor = map.provinces[neighborId as unknown as number];
      if (!neighbor || neighbor.terrain === 'ocean') continue;
      const neighborOwner = neighbor?.ownerFactionId ?? null;
      if (neighborOwner == null || neighborOwner === owner) continue;

      const key = frontKey(owner, neighborOwner);
      let front = fronts.get(key);
      if (!front) {
        const [a, b] = sortFactionPair(owner, neighborOwner);
        front = {
          key,
          a,
          b,
          borderA: new Set<number>(),
          borderB: new Set<number>(),
          contactEdges: 0,
        };
        fronts.set(key, front);
      }

      if (owner === front.a) {
        front.borderA.add(province.id as unknown as number);
        front.borderB.add(neighbor.id as unknown as number);
      } else {
        front.borderB.add(province.id as unknown as number);
        front.borderA.add(neighbor.id as unknown as number);
      }
      front.contactEdges += 1;
    }
  }

  return fronts;
}

function groupFrontsByFaction(fronts: Map<string, Front>): Map<FactionId, Front[]> {
  const frontsByFaction = new Map<FactionId, Front[]>();
  for (const front of fronts.values()) {
    pushFront(frontsByFaction, front.a, front);
    pushFront(frontsByFaction, front.b, front);
  }
  return frontsByFaction;
}

function pushFront(frontsByFaction: Map<FactionId, Front[]>, factionId: FactionId, front: Front) {
  const fronts = frontsByFaction.get(factionId);
  if (fronts) fronts.push(front);
  else frontsByFaction.set(factionId, [front]);
}

function computeWarPotential(regions: number): number {
  return Math.max(1, regions) * BASE_WAR_POTENTIAL_PER_REGION;
}

function getFrontOverlayIntensity(
  state: FrontPressureState,
  frontKeyValue: string,
  leftOwner: FactionId,
  rightOwner: FactionId,
): number {
  const leftAllocation = state.allocations.get(allocationKey(frontKeyValue, leftOwner));
  const rightAllocation = state.allocations.get(allocationKey(frontKeyValue, rightOwner));
  const leftPower = (leftAllocation?.troops ?? 0) * (leftAllocation?.supply ?? 1);
  const rightPower = (rightAllocation?.troops ?? 0) * (rightAllocation?.supply ?? 1);
  const leftRisk =
    rightPower / Math.max(1, leftPower) +
    (1 - (leftAllocation?.supply ?? 1)) +
    (leftAllocation?.multiFrontPenalty ?? 0);
  const rightRisk =
    leftPower / Math.max(1, rightPower) +
    (1 - (rightAllocation?.supply ?? 1)) +
    (rightAllocation?.multiFrontPenalty ?? 0);

  return clamp((Math.max(leftRisk, rightRisk) - 0.8) / 1.4, 0.25, 1);
}

function getPressureLevel(frontCount: number): FrontPressureLevel {
  if (frontCount <= 0) return 'none';
  if (frontCount === 1) return 'low';
  if (frontCount === 2) return 'medium';
  return 'high';
}

function computeSupply(
  map: MapData,
  faction: FrontPressureFaction,
  frontRegions: Set<number>,
): number {
  if (frontRegions.size === 0 || faction.centroidRegionId == null) return 1;
  const centroid = map.provinces[faction.centroidRegionId as unknown as number]?.centroid;
  if (!centroid) return 1;

  let totalDistance = 0;
  let count = 0;
  for (const regionNum of frontRegions) {
    const province = map.provinces[regionNum];
    if (!province) continue;
    totalDistance += distance(province.centroid, centroid);
    count += 1;
  }
  if (count === 0) return 1;

  return clamp(1 - totalDistance / count / SUPPLY_DISTANCE_LIMIT, 0.65, 1);
}

function frontPowerBias(attackerPower: number, defenderPower: number): number {
  const total = attackerPower + defenderPower;
  if (total <= 0) return 0;
  return (attackerPower / total - 0.5) * FRONT_POWER_BIAS_SCALE;
}

function getLocalSurroundBias(input: {
  map: MapData;
  attackerId: FactionId;
  defenderId: FactionId;
  targetRegion: RegionId;
  ownerOf: (id: RegionId) => FactionId | null;
}): number {
  const target = input.map.provinces[input.targetRegion as unknown as number];
  if (!target) return 0;

  let attackerNeighbors = 0;
  let defenderNeighbors = 0;
  for (const neighborId of target.neighbors) {
    const neighbor = input.map.provinces[neighborId as unknown as number];
    if (!neighbor || neighbor.terrain === 'ocean') continue;
    const owner = input.ownerOf(neighborId);
    if (owner === input.attackerId) attackerNeighbors += 1;
    else if (owner === input.defenderId) defenderNeighbors += 1;
  }
  const contestedNeighbors = attackerNeighbors + defenderNeighbors;
  if (contestedNeighbors === 0) return 0;

  return ((attackerNeighbors - defenderNeighbors) / contestedNeighbors) * LOCAL_SURROUND_BIAS_SCALE;
}

function frontKey(a: FactionId, b: FactionId): string {
  const [left, right] = sortFactionPair(a, b);
  return `${left as unknown as number}:${right as unknown as number}`;
}

function allocationKey(key: string, factionId: FactionId): string {
  return `${key}:${factionId as unknown as number}`;
}

function sortFactionPair(a: FactionId, b: FactionId): [FactionId, FactionId] {
  return (a as unknown as number) < (b as unknown as number) ? [a, b] : [b, a];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
