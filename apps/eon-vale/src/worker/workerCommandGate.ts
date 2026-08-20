import { WORKER_PROTOCOL_VERSION, type WorkerCommandEnvelope } from './protocol';

export type CommandGateResult =
  | { status: 'accepted'; expectedSequence: number }
  | {
      status: 'rejected';
      code: 'unsupported-protocol-version' | 'stale-command-sequence' | 'command-sequence-gap';
      expectedSequence: number;
    };

export interface WorkerCommandGate {
  accept(envelope: WorkerCommandEnvelope): CommandGateResult;
  readonly expectedSequence: number;
}

export function createWorkerCommandGate(): WorkerCommandGate {
  let expectedSequence = 1;
  return {
    get expectedSequence() {
      return expectedSequence;
    },
    accept(envelope) {
      if (envelope.protocolVersion !== WORKER_PROTOCOL_VERSION) {
        return {
          status: 'rejected',
          code: 'unsupported-protocol-version',
          expectedSequence,
        };
      }
      if (envelope.sequence < expectedSequence) {
        return { status: 'rejected', code: 'stale-command-sequence', expectedSequence };
      }
      if (envelope.sequence > expectedSequence) {
        return { status: 'rejected', code: 'command-sequence-gap', expectedSequence };
      }
      expectedSequence += 1;
      return { status: 'accepted', expectedSequence };
    },
  };
}
