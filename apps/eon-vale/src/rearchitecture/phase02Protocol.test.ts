import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import { projectKernelResourceDelta } from '@/worker/kernelCompatibilityProjection';
import { createObservationInbox } from '@/worker/observationInbox';
import {
  createCommandEnvelope,
  type ObservationEventEnvelope,
  WORKER_PROTOCOL_VERSION,
  type WorkerReliableEventEnvelope,
} from '@/worker/protocol';
import { createWorkerCommandGate } from '@/worker/workerCommandGate';

describe('phase 2 versioned worker protocol', () => {
  it('accepts only the next command sequence and reports the recovery boundary', () => {
    const gate = createWorkerCommandGate();
    const first = createCommandEnvelope('browser-a', 1, 'pause-1', {
      type: 'set-paused',
      paused: true,
    });
    const gap = createCommandEnvelope('browser-a', 3, 'pause-3', {
      type: 'set-paused',
      paused: false,
    });
    const second = createCommandEnvelope('browser-a', 2, 'pause-2', {
      type: 'set-paused',
      paused: false,
    });

    expect(first.protocolVersion).toBe(WORKER_PROTOCOL_VERSION);
    expect(gate.accept(first)).toEqual({ status: 'accepted', expectedSequence: 2 });
    expect(gate.accept(first)).toEqual({
      status: 'rejected',
      code: 'stale-command-sequence',
      expectedSequence: 2,
    });
    expect(gate.accept(gap)).toEqual({
      status: 'rejected',
      code: 'command-sequence-gap',
      expectedSequence: 2,
    });
    expect(gate.accept(second)).toEqual({ status: 'accepted', expectedSequence: 3 });
  });

  it('coalesces superseded visual frames without dropping reliable results', () => {
    const inbox = createObservationInbox();
    const firstResult: WorkerReliableEventEnvelope = {
      protocolVersion: WORKER_PROTOCOL_VERSION,
      channel: 'reliable',
      sequence: 1,
      event: {
        type: 'command-result',
        commandId: 'pause-1',
        commandSequence: 1,
        status: 'accepted',
        appliedTick: 0,
      },
    };
    const saveResult: WorkerReliableEventEnvelope = {
      protocolVersion: WORKER_PROTOCOL_VERSION,
      channel: 'reliable',
      sequence: 2,
      event: {
        type: 'snapshot-result',
        requestId: 'manual-1',
        status: 'created',
        encoded: 'snapshot-v1',
      },
    };
    const keyframe = observation(1, 0, 'generation-a', {
      type: 'keyframe',
      tick: 0,
      checksum: 'aaaa1111',
    });
    const firstVisual = observation(2, 1, 'generation-a', {
      type: 'ui-summary',
      tick: 1,
      checksum: 'bbbb2222',
      paused: false,
      humans: 0,
    });
    const latestVisual = observation(3, 2, 'generation-a', {
      type: 'ui-summary',
      tick: 2,
      checksum: 'cccc3333',
      paused: false,
      humans: 0,
    });

    inbox.push(firstResult);
    inbox.push(keyframe);
    inbox.push(firstVisual);
    inbox.push(saveResult);
    inbox.push(latestVisual);
    const drained = inbox.drain();

    expect(drained.reliable.map((message) => message.event.type)).toEqual([
      'command-result',
      'snapshot-result',
    ]);
    expect(drained.observations.map((message) => message.event.type)).toEqual([
      'keyframe',
      'ui-summary',
    ]);
    expect(drained.observations.at(-1)?.sequence).toBe(3);
    expect(drained.resyncRequest).toBeNull();
  });

  it('requests one keyframe when an observation sequence or generation breaks', () => {
    const inbox = createObservationInbox();
    inbox.push(
      observation(10, 0, 'generation-a', {
        type: 'keyframe',
        tick: 4,
        checksum: 'aaaa1111',
      }),
    );
    inbox.push(
      observation(12, 11, 'generation-a', {
        type: 'ui-summary',
        tick: 6,
        checksum: 'cccc3333',
        paused: false,
        humans: 0,
      }),
    );
    inbox.push(
      observation(13, 12, 'generation-b', {
        type: 'ui-summary',
        tick: 7,
        checksum: 'dddd4444',
        paused: false,
        humans: 0,
      }),
    );

    const drained = inbox.drain();
    expect(drained.observations.map((message) => message.event.type)).toEqual(['keyframe']);
    expect(drained.resyncRequest).toEqual({
      reason: 'observation-sequence-gap',
      expectedSequence: 11,
      receivedSequence: 12,
    });
  });

  it('keeps the product entrypoint off legacy protocol, stress, and V6 save paths', () => {
    const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    const clientSource = readFileSync(
      new URL('../worker/SimulationWorkerClient.ts', import.meta.url),
      'utf8',
    );
    const protocolSource = readFileSync(new URL('../worker/protocol.ts', import.meta.url), 'utf8');

    expect(appSource).not.toContain('saveSlots');
    expect(appSource).not.toContain('initializeStress');
    expect(clientSource).not.toContain('initializeStress');
    expect(protocolSource).not.toContain('initialize-stress');
    expect(protocolSource).not.toContain("type: 'request-save'");
    expect(protocolSource).not.toContain("type: 'load-save'");
    expect(existsSync(new URL('../worker/simulation.worker.ts', import.meta.url))).toBe(false);
  });

  it('projects only dirty resource ids after terrain causality removes a node', () => {
    const kernel = createSimulationKernel({ seed: 'resource-delta', size: 128 });
    const resourceId = Array.from(kernel.state.resources.active).findIndex(Boolean);
    expect(resourceId).toBeGreaterThanOrEqual(0);
    const cell = kernel.state.resources.cell[resourceId] ?? 0;
    kernel.enqueue({ type: 'lower-terrain', sequence: 1, cell, amount: 12 });
    kernel.flushCommands();

    const dirtyIds = [...new Set(kernel.state.resources.dirtyResourceIds)];
    const delta = projectKernelResourceDelta(kernel, dirtyIds);

    expect(delta.full).toBe(false);
    expect(Array.from(delta.nodeIds)).toEqual(dirtyIds);
    expect(delta.active).toHaveLength(dirtyIds.length);
    expect(delta.count).toBe(kernel.state.resources.count);
  });
});

function observation(
  sequence: number,
  previousSequence: number,
  generation: string,
  event: ObservationEventEnvelope['event'],
): ObservationEventEnvelope {
  return {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    channel: 'observation',
    sequence,
    previousSequence,
    generation,
    event,
  };
}
