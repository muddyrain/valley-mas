import { DiplomacyState } from '@/shared/gameTypes';

export interface KingdomBorderSegment {
  orientation: 'horizontal' | 'vertical';
  line: number;
  start: number;
  end: number;
  firstVillageId: number;
  secondVillageId: number;
  firstKingdomId: number;
  secondKingdomId: number;
}

export interface KingdomAdjacency {
  firstKingdomId: number;
  secondKingdomId: number;
  sharedEdges: number;
  diagonalOnly: boolean;
  atWar: boolean;
}

export interface KingdomObservation {
  kingdomBorders: KingdomBorderSegment[];
  villageBorders: KingdomBorderSegment[];
  warFronts: KingdomBorderSegment[];
  adjacencies: KingdomAdjacency[];
}

interface ObservationVillage {
  id: number;
  kingdomId: number;
}

interface ObservationKingdom {
  id: number;
  extinct: boolean;
  relations: Record<number, DiplomacyState>;
}

interface ObservationInput {
  size: number;
  villageIds: Uint16Array;
  villages: ObservationVillage[];
  kingdoms: ObservationKingdom[];
}

function pairKey(firstId: number, secondId: number): string {
  return firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;
}

function kingdomPair(
  firstId: number,
  secondId: number,
): { firstKingdomId: number; secondKingdomId: number } {
  return firstId < secondId
    ? { firstKingdomId: firstId, secondKingdomId: secondId }
    : { firstKingdomId: secondId, secondKingdomId: firstId };
}

function appendSegment(segments: KingdomBorderSegment[], segment: KingdomBorderSegment): void {
  const previous = segments[segments.length - 1];
  if (
    previous &&
    previous.orientation === segment.orientation &&
    previous.line === segment.line &&
    previous.end === segment.start &&
    previous.firstVillageId === segment.firstVillageId &&
    previous.secondVillageId === segment.secondVillageId &&
    previous.firstKingdomId === segment.firstKingdomId &&
    previous.secondKingdomId === segment.secondKingdomId
  ) {
    previous.end = segment.end;
    return;
  }
  segments.push(segment);
}

export function deriveKingdomObservation(input: ObservationInput): KingdomObservation {
  const villageKingdoms = new Map(input.villages.map((village) => [village.id, village.kingdomId]));
  const kingdoms = new Map(
    input.kingdoms.filter((kingdom) => !kingdom.extinct).map((kingdom) => [kingdom.id, kingdom]),
  );
  const kingdomBorders: KingdomBorderSegment[] = [];
  const villageBorders: KingdomBorderSegment[] = [];

  const addBoundary = (
    orientation: KingdomBorderSegment['orientation'],
    line: number,
    start: number,
    firstVillageId: number,
    secondVillageId: number,
  ): void => {
    if (firstVillageId === secondVillageId) return;
    const firstKingdomId = villageKingdoms.get(firstVillageId) ?? 0;
    const secondKingdomId = villageKingdoms.get(secondVillageId) ?? 0;
    const segment = {
      orientation,
      line,
      start,
      end: start + 1,
      firstVillageId,
      secondVillageId,
      firstKingdomId,
      secondKingdomId,
    } satisfies KingdomBorderSegment;
    if (firstKingdomId !== secondKingdomId && (firstKingdomId > 0 || secondKingdomId > 0)) {
      appendSegment(kingdomBorders, segment);
    } else if (firstVillageId > 0 && secondVillageId > 0) {
      appendSegment(villageBorders, segment);
    }
  };

  for (let x = 0; x <= input.size; x += 1) {
    for (let z = 0; z < input.size; z += 1) {
      const firstVillageId = x > 0 ? (input.villageIds[z * input.size + x - 1] ?? 0) : 0;
      const secondVillageId = x < input.size ? (input.villageIds[z * input.size + x] ?? 0) : 0;
      addBoundary('vertical', x, z, firstVillageId, secondVillageId);
    }
  }
  for (let z = 0; z <= input.size; z += 1) {
    for (let x = 0; x < input.size; x += 1) {
      const firstVillageId = z > 0 ? (input.villageIds[(z - 1) * input.size + x] ?? 0) : 0;
      const secondVillageId = z < input.size ? (input.villageIds[z * input.size + x] ?? 0) : 0;
      addBoundary('horizontal', z, x, firstVillageId, secondVillageId);
    }
  }

  const adjacencyByPair = new Map<
    string,
    { firstKingdomId: number; secondKingdomId: number; sharedEdges: number; diagonal: boolean }
  >();
  const addAdjacency = (firstKingdomId: number, secondKingdomId: number, shared: boolean): void => {
    if (firstKingdomId <= 0 || secondKingdomId <= 0 || firstKingdomId === secondKingdomId) return;
    const pair = kingdomPair(firstKingdomId, secondKingdomId);
    const key = pairKey(firstKingdomId, secondKingdomId);
    const adjacency = adjacencyByPair.get(key) ?? { ...pair, sharedEdges: 0, diagonal: false };
    if (shared) adjacency.sharedEdges += 1;
    else adjacency.diagonal = true;
    adjacencyByPair.set(key, adjacency);
  };
  const kingdomAt = (x: number, z: number): number => {
    const villageId = input.villageIds[z * input.size + x] ?? 0;
    return villageKingdoms.get(villageId) ?? 0;
  };
  for (let z = 0; z < input.size; z += 1) {
    for (let x = 0; x < input.size; x += 1) {
      const ownKingdomId = kingdomAt(x, z);
      if (x + 1 < input.size) addAdjacency(ownKingdomId, kingdomAt(x + 1, z), true);
      if (z + 1 < input.size) addAdjacency(ownKingdomId, kingdomAt(x, z + 1), true);
      if (z + 1 < input.size && x + 1 < input.size)
        addAdjacency(ownKingdomId, kingdomAt(x + 1, z + 1), false);
      if (z + 1 < input.size && x > 0) addAdjacency(ownKingdomId, kingdomAt(x - 1, z + 1), false);
    }
  }
  const isWar = (firstKingdomId: number, secondKingdomId: number): boolean =>
    kingdoms.get(firstKingdomId)?.relations[secondKingdomId] === DiplomacyState.War ||
    kingdoms.get(secondKingdomId)?.relations[firstKingdomId] === DiplomacyState.War;
  const adjacencies = [...adjacencyByPair.values()]
    .map(({ firstKingdomId, secondKingdomId, sharedEdges }) => ({
      firstKingdomId,
      secondKingdomId,
      sharedEdges,
      diagonalOnly: sharedEdges === 0,
      atWar: isWar(firstKingdomId, secondKingdomId),
    }))
    .sort(
      (first, second) =>
        first.firstKingdomId - second.firstKingdomId ||
        first.secondKingdomId - second.secondKingdomId,
    );
  const warFronts = kingdomBorders.filter(
    (segment) =>
      segment.firstKingdomId > 0 &&
      segment.secondKingdomId > 0 &&
      isWar(segment.firstKingdomId, segment.secondKingdomId),
  );
  return { kingdomBorders, villageBorders, warFronts, adjacencies };
}
