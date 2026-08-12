export type TownJournalEntryKind =
  | 'control'
  | 'vehicle'
  | 'conversation'
  | 'event-stage'
  | 'event-choice'
  | 'event-chain';

export interface TownJournalEntryInput {
  kind: TownJournalEntryKind;
  title: string;
  detail: string;
  time: string;
}

export interface TownJournalEntry extends TownJournalEntryInput {
  id: string;
}

export interface TownJournalState {
  entries: readonly TownJournalEntry[];
  nextId: number;
}

export function createTownJournalState(): TownJournalState {
  return { entries: [], nextId: 1 };
}

export function appendTownJournalEntry(
  state: Readonly<TownJournalState>,
  input: Readonly<TownJournalEntryInput>,
  limit = 8,
): TownJournalState {
  const entry: TownJournalEntry = {
    ...input,
    id: `journal-${state.nextId}`,
  };
  return {
    entries: [entry, ...state.entries].slice(0, Math.max(1, limit)),
    nextId: state.nextId + 1,
  };
}
