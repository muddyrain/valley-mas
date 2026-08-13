import type {
  WorldEvent,
  WorldEventKind,
  WorldHistoryArchive,
  WorldHistoryCategory,
  WorldHistoryEntry,
  WorldHistoryFilter,
  WorldHistoryLink,
  WorldHistorySubject,
  WorldState,
} from '@/shared/gameTypes';

const MAX_ORDINARY_EVENTS = 2_048;
const MAX_RESIDENT_MILESTONES = 32;
const PERMANENT_PERSONAL_KINDS = new Set<WorldEventKind>([
  'birth',
  'death',
  'family',
  'migration',
  'promotion',
  'awakening',
]);

export interface RecordWorldEventInput {
  kind: WorldEventKind;
  category: WorldHistoryCategory;
  message: string;
  archive: boolean;
  notification: boolean;
  entityIds?: number[];
  villageIds?: number[];
  kingdomIds?: number[];
  war?: { id: string; label: string };
  locationCell?: number;
}

export interface QueryWorldHistoryOptions {
  filter: WorldHistoryFilter;
  favoriteLifeIds?: number[];
  limit?: number;
}

function uniqueSubjects(subjects: WorldHistorySubject[]): WorldHistorySubject[] {
  const keys = new Set<string>();
  return subjects.filter((subject) => {
    const key =
      subject.kind === 'entity'
        ? `entity:${subject.lifeId}`
        : subject.kind === 'war'
          ? `war:${subject.warId}`
          : subject.kind === 'location'
            ? `location:${subject.cell}`
            : `${subject.kind}:${subject.id}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function eventLifeIds(event: WorldEvent): number[] {
  return event.subjects
    .filter(
      (subject): subject is Extract<WorldHistorySubject, { kind: 'entity' }> =>
        subject.kind === 'entity',
    )
    .map((subject) => subject.lifeId);
}

function protectedLifeIds(state: WorldState): Set<number> {
  const lifeIds = new Set(state.favoriteLifeIds);
  for (const kingdom of state.kingdoms) {
    const lifeId = state.entities.lifeIds[kingdom.leaderId] ?? 0;
    if (!kingdom.extinct && lifeId > 0) lifeIds.add(lifeId);
  }
  for (const event of state.events) {
    const protectsFounder = event.kind === 'village-founded';
    const protectsFormerLeader =
      event.kind === 'promotion' &&
      (event.message.endsWith('领主') || event.message.endsWith('国王'));
    if (!protectsFounder && !protectsFormerLeader) continue;
    for (const lifeId of eventLifeIds(event)) lifeIds.add(lifeId);
  }
  return lifeIds;
}

function pruneHistory(state: WorldState): void {
  const favoriteIds = protectedLifeIds(state);
  const personalCounts = new Map<number, number>();
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index];
    if (!event || event.archive || PERMANENT_PERSONAL_KINDS.has(event.kind)) continue;
    const lifeIds = eventLifeIds(event);
    if (lifeIds.length === 0 || lifeIds.some((lifeId) => favoriteIds.has(lifeId))) continue;
    const beyondLimit = lifeIds.every((lifeId) => {
      const count = personalCounts.get(lifeId) ?? 0;
      personalCounts.set(lifeId, count + 1);
      return count >= MAX_RESIDENT_MILESTONES;
    });
    if (beyondLimit) state.events.splice(index, 1);
  }

  if (state.events.length <= MAX_ORDINARY_EVENTS) return;
  for (let index = 0; index < state.events.length && state.events.length > MAX_ORDINARY_EVENTS; ) {
    const event = state.events[index];
    const protectedEvent =
      !event ||
      event.archive ||
      PERMANENT_PERSONAL_KINDS.has(event.kind) ||
      eventLifeIds(event).some((lifeId) => favoriteIds.has(lifeId));
    if (protectedEvent) index += 1;
    else state.events.splice(index, 1);
  }
}

export function recordWorldEvent(state: WorldState, input: RecordWorldEventInput): WorldEvent {
  const subjects: WorldHistorySubject[] = [];
  for (const entityId of input.entityIds ?? []) {
    const lifeId = state.entities.lifeIds[entityId] ?? 0;
    if (lifeId > 0) {
      subjects.push({
        kind: 'entity',
        lifeId,
        label: state.entities.names[entityId] || `人物 ${lifeId}`,
      });
    }
  }
  for (const villageId of input.villageIds ?? []) {
    const village = state.villages.find((candidate) => candidate.id === villageId);
    subjects.push({ kind: 'village', id: villageId, label: village?.name ?? `聚落 ${villageId}` });
  }
  for (const kingdomId of input.kingdomIds ?? []) {
    const kingdom = state.kingdoms.find((candidate) => candidate.id === kingdomId);
    subjects.push({ kind: 'kingdom', id: kingdomId, label: kingdom?.name ?? `王国 ${kingdomId}` });
  }
  if (input.war) subjects.push({ kind: 'war', warId: input.war.id, label: input.war.label });
  if (input.locationCell !== undefined) {
    const x = input.locationCell % state.map.size;
    const z = Math.floor(input.locationCell / state.map.size);
    subjects.push({ kind: 'location', cell: input.locationCell, label: `地点 ${x}, ${z}` });
  }

  state.nextEventId += 1;
  const event: WorldEvent = {
    id: state.nextEventId,
    tick: state.tick,
    kind: input.kind,
    category: input.category,
    message: input.message,
    archive: input.archive,
    notification: input.notification,
    subjects: uniqueSubjects(subjects),
  };
  state.events.push(event);
  if (state.nextEventId % 64 === 0 || state.events.length > MAX_ORDINARY_EVENTS + 64) {
    pruneHistory(state);
  }
  return event;
}

function entitySlotForLife(state: WorldState, lifeId: number): number | undefined {
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (state.entities.active[entityId] && state.entities.lifeIds[entityId] === lifeId) {
      return entityId;
    }
  }
  return undefined;
}

function resolveLink(state: WorldState, subject: WorldHistorySubject): WorldHistoryLink {
  if (subject.kind === 'entity') {
    const id = entitySlotForLife(state, subject.lifeId);
    return {
      kind: 'entity',
      label: subject.label,
      lifeId: subject.lifeId,
      id,
      available: id !== undefined,
    };
  }
  if (subject.kind === 'village') {
    return {
      kind: 'village',
      label: subject.label,
      id: subject.id,
      available: state.villages.some((village) => village.id === subject.id),
    };
  }
  if (subject.kind === 'kingdom') {
    return {
      kind: 'kingdom',
      label: subject.label,
      id: subject.id,
      available: state.kingdoms.some((kingdom) => kingdom.id === subject.id),
    };
  }
  if (subject.kind === 'war') {
    return { kind: 'war', label: subject.label, warId: subject.warId, available: true };
  }
  return {
    kind: 'location',
    label: subject.label,
    cell: subject.cell,
    available: subject.cell >= 0 && subject.cell < state.map.terrain.length,
  };
}

function resolveEntry(state: WorldState, event: WorldEvent): WorldHistoryEntry {
  return { ...event, links: event.subjects.map((subject) => resolveLink(state, subject)) };
}

export function queryWorldHistory(
  state: WorldState,
  { filter, favoriteLifeIds = state.favoriteLifeIds, limit = 200 }: QueryWorldHistoryOptions,
): WorldHistoryArchive {
  const favoriteIds = new Set(favoriteLifeIds);
  const entries = state.events
    .filter((event) => {
      if (filter === 'favorites') {
        return eventLifeIds(event).some((lifeId) => favoriteIds.has(lifeId));
      }
      if (!event.archive) return false;
      return filter === 'all' || event.category === filter;
    })
    .slice(filter === 'favorites' ? 0 : -limit)
    .reverse()
    .map((event) => resolveEntry(state, event));
  return { revision: state.nextEventId, filter, entries };
}

export function querySubjectHistory(
  state: WorldState,
  subject: { kind: 'entity'; lifeId: number } | { kind: 'village' | 'kingdom'; id: number },
  limit = 32,
): WorldHistoryEntry[] {
  const matching = state.events.filter((event) =>
    event.subjects.some((candidate) => {
      if (subject.kind === 'entity') {
        return candidate.kind === 'entity' && candidate.lifeId === subject.lifeId;
      }
      return candidate.kind === subject.kind && candidate.id === subject.id;
    }),
  );
  if (subject.kind === 'entity' && protectedLifeIds(state).has(subject.lifeId)) {
    return matching.reverse().map((event) => resolveEntry(state, event));
  }
  const permanent = matching.filter((event) => PERMANENT_PERSONAL_KINDS.has(event.kind));
  const permanentIds = new Set(permanent.map((event) => event.id));
  const recent = matching.filter((event) => !permanentIds.has(event.id)).slice(-limit);
  return [...permanent, ...recent]
    .sort((first, second) => first.id - second.id)
    .reverse()
    .map((event) => resolveEntry(state, event));
}

export function recentWorldNotifications(state: WorldState, limit = 30): WorldEvent[] {
  return state.events.filter((event) => event.notification).slice(-limit);
}
