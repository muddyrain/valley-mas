import type {
  Inspection,
  ResourceNodeSnapshot,
  TerritorySnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import type { KernelDiagnosticFrame } from '@/simulation/observation/kernelDiagnostics';
import type { NaturalContentOptions } from '@/simulation/world/worldFacts';

export const WORKER_PROTOCOL_VERSION = 1 as const;

export type TerrainEditTool = 'raise' | 'lower' | 'paint-land' | 'paint-water' | 'paint-forest';

export type WorkerProtocolCommand =
  | {
      type: 'initialize-world';
      worldId: string;
      seed: string;
      size: 128 | 256 | 384;
      preset: 'archipelago' | 'continent' | 'ocean';
      naturalContent?: NaturalContentOptions;
    }
  | { type: 'set-paused'; paused: boolean }
  | { type: 'set-playback-rate'; rate: 1 | 2 | 4 | 8 }
  | { type: 'edit-terrain'; tool: TerrainEditTool; cell: number; radius: number }
  | { type: 'inspect'; target: 'entity' | 'village' | 'building' | 'kingdom'; id: number }
  | { type: 'request-keyframe'; reason: ResyncReason }
  | { type: 'create-snapshot'; requestId: string }
  | { type: 'restore-snapshot'; requestId: string; encoded: string };

export interface WorkerCommandEnvelope {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  channel: 'command';
  clientId: string;
  commandId: string;
  sequence: number;
  command: WorkerProtocolCommand;
}

export type ResyncReason =
  | 'observation-sequence-gap'
  | 'observation-generation-mismatch'
  | 'observation-checksum-mismatch';

export type WorkerReliableEvent =
  | {
      type: 'command-result';
      commandId: string;
      commandSequence: number;
      status: 'accepted' | 'rejected';
      appliedTick: number;
      code?: string;
      expectedSequence?: number;
    }
  | {
      type: 'snapshot-result';
      requestId: string;
      status: 'created' | 'restored' | 'rejected';
      encoded?: string;
      worldId?: string;
      checksum?: string;
      code?: string;
    }
  | { type: 'inspection-result'; inspection: Inspection | null }
  | { type: 'notice'; level: 'info' | 'error'; message: string };

export interface WorkerReliableEventEnvelope {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  channel: 'reliable';
  sequence: number;
  event: WorkerReliableEvent;
}

export interface KeyframeProjection {
  seed: string;
  map: WorldMapSnapshot;
  resources: ResourceNodeSnapshot;
  territory: TerritorySnapshot;
  snapshot: WorldRenderSnapshot;
  diagnostic: KernelDiagnosticFrame;
}

export type WorkerObservationEvent =
  | { type: 'keyframe'; tick: number; checksum: string; projection?: KeyframeProjection }
  | {
      type: 'dynamic-frame';
      tick: number;
      checksum: string;
      snapshot?: WorldRenderSnapshot;
      diagnostic?: KernelDiagnosticFrame;
    }
  | { type: 'map-delta'; tick: number; checksum: string; delta?: WorldMapDelta }
  | {
      type: 'resource-delta';
      tick: number;
      checksum: string;
      resources?: ResourceNodeSnapshot;
    }
  | {
      type: 'ui-summary';
      tick: number;
      checksum: string;
      paused: boolean;
      humans: number;
    };

export interface ObservationEventEnvelope {
  protocolVersion: typeof WORKER_PROTOCOL_VERSION;
  channel: 'observation';
  sequence: number;
  previousSequence: number;
  generation: string;
  event: WorkerObservationEvent;
}

export type VersionedWorkerEvent = WorkerReliableEventEnvelope | ObservationEventEnvelope;

export function createCommandEnvelope(
  clientId: string,
  sequence: number,
  commandId: string,
  command: WorkerProtocolCommand,
): WorkerCommandEnvelope {
  return {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    channel: 'command',
    clientId,
    commandId,
    sequence,
    command,
  };
}
