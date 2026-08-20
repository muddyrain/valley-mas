import type { FamilyFact } from '../life/families';
import type { HumanLifeFact } from '../life/lifeFacts';
import type { NaturalResourceStore } from '../resources/naturalResources';
import type {
  LooseResourceFact,
  SettlementBuildingFact,
  SettlementFact,
  SettlementInventoryFact,
  SettlementTaskOpportunityFact,
} from '../settlements/settlementFacts';
import { createReservationLedger, type ReservationLedger } from '../tasks/reservations';
import { generateWorld } from '../world/generateWorld';
import type {
  NaturalContentOptions,
  WorldFacts,
  WorldPreset,
  WorldSize,
} from '../world/worldFacts';
import type { KernelCommand, KernelCommandRecord } from './commands';
import type { KernelPhaseId } from './phases';

export interface CivilizationFacts {
  humans: number;
  nextLifeId: number;
  nextTaskId: number;
  life: HumanLifeFact[];
  reservations: ReservationLedger;
  nextSettlementId: number;
  nextBuildingId: number;
  nextLooseResourceId: number;
  settlements: SettlementFact[];
  buildings: SettlementBuildingFact[];
  settlementInventories: SettlementInventoryFact[];
  looseResources: LooseResourceFact[];
  nextOpportunityId: number;
  opportunities: SettlementTaskOpportunityFact[];
  nextFamilyId: number;
  families: FamilyFact[];
}

export interface KernelCommandState {
  pending: KernelCommand[];
  records: KernelCommandRecord[];
  lastSequence: number;
}

export interface KernelDiagnostics {
  invariantErrors: string[];
  lastPhaseTrace: KernelPhaseId[];
}

export interface KernelWorldRoot {
  schemaVersion: 1;
  seed: string;
  tick: number;
  paused: boolean;
  world: WorldFacts;
  resources: NaturalResourceStore;
  civilization: CivilizationFacts;
  commands: KernelCommandState;
  diagnostics: KernelDiagnostics;
}

export interface CreateKernelWorldOptions {
  seed: string;
  size?: WorldSize;
  preset?: WorldPreset;
  naturalContent?: NaturalContentOptions;
}

export function createEmptyCivilizationFacts(): CivilizationFacts {
  return {
    humans: 0,
    nextLifeId: 0,
    nextTaskId: 0,
    life: [],
    reservations: createReservationLedger(),
    nextSettlementId: 0,
    nextBuildingId: 0,
    nextLooseResourceId: 0,
    settlements: [],
    buildings: [],
    settlementInventories: [],
    looseResources: [],
    nextOpportunityId: 0,
    opportunities: [],
    nextFamilyId: 0,
    families: [],
  };
}

export function createKernelWorldRoot(options: CreateKernelWorldOptions): KernelWorldRoot {
  const generated = generateWorld({
    seed: options.seed,
    size: options.size,
    preset: options.preset,
    naturalContent: options.naturalContent,
  });
  return {
    schemaVersion: 1,
    seed: options.seed,
    tick: 0,
    paused: true,
    world: generated.world,
    resources: generated.resources,
    civilization: createEmptyCivilizationFacts(),
    commands: { pending: [], records: [], lastSequence: 0 },
    diagnostics: { invariantErrors: [], lastPhaseTrace: [] },
  };
}
