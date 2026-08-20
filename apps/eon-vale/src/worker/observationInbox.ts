import type {
  ObservationEventEnvelope,
  ResyncReason,
  VersionedWorkerEvent,
  WorkerReliableEventEnvelope,
} from './protocol';

export interface ObservationResyncRequest {
  reason: ResyncReason;
  expectedSequence: number;
  receivedSequence: number;
}

export interface ObservationInboxDrain {
  reliable: WorkerReliableEventEnvelope[];
  observations: ObservationEventEnvelope[];
  resyncRequest: ObservationResyncRequest | null;
}

export interface ObservationInbox {
  push(message: VersionedWorkerEvent): void;
  drain(): ObservationInboxDrain;
}

function coalescible(message: ObservationEventEnvelope): boolean {
  return message.event.type === 'dynamic-frame' || message.event.type === 'ui-summary';
}

export function createObservationInbox(): ObservationInbox {
  let generation: string | null = null;
  let expectedObservationSequence = 1;
  let waitingForKeyframe = false;
  let resyncRequest: ObservationResyncRequest | null = null;
  let reliable: WorkerReliableEventEnvelope[] = [];
  let observations: ObservationEventEnvelope[] = [];
  const latestVisual = new Map<
    ObservationEventEnvelope['event']['type'],
    ObservationEventEnvelope
  >();

  return {
    push(message) {
      if (message.channel === 'reliable') {
        reliable.push(message);
        return;
      }
      if (message.event.type === 'keyframe') {
        generation = message.generation;
        expectedObservationSequence = message.sequence + 1;
        waitingForKeyframe = false;
        resyncRequest = null;
        observations = [message];
        latestVisual.clear();
        return;
      }
      if (waitingForKeyframe) return;
      if (generation !== message.generation) {
        waitingForKeyframe = true;
        resyncRequest = {
          reason: 'observation-generation-mismatch',
          expectedSequence: expectedObservationSequence,
          receivedSequence: message.sequence,
        };
        return;
      }
      if (
        message.sequence !== expectedObservationSequence ||
        message.previousSequence !== expectedObservationSequence - 1
      ) {
        waitingForKeyframe = true;
        resyncRequest = {
          reason: 'observation-sequence-gap',
          expectedSequence: expectedObservationSequence,
          receivedSequence: message.sequence,
        };
        return;
      }
      expectedObservationSequence += 1;
      if (coalescible(message)) latestVisual.set(message.event.type, message);
      else observations.push(message);
    },
    drain() {
      const drained = {
        reliable,
        observations: [...observations, ...latestVisual.values()].sort(
          (left, right) => left.sequence - right.sequence,
        ),
        resyncRequest,
      };
      reliable = [];
      observations = [];
      latestVisual.clear();
      resyncRequest = null;
      return drained;
    },
  };
}
