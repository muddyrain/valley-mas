import { describe, expect, it, vi } from 'vitest';

import type { WorldSnapshot } from '../model/WorldSnapshot';
import { WorkerGenerationService } from './WorkerGenerationService';
import type { WorldWorkerRequest, WorldWorkerResponse } from './WorldWorkerProtocol';
import { snapshotTransferables } from './WorldWorkerProtocol';

describe('WorkerGenerationService', () => {
  it('exposes progress and cancellation without leaking worker messages to callers', async () => {
    const worker = new FakeWorker();
    const service = new WorkerGenerationService(worker);
    const job = service.start({ templateId: 'continent', seed: 7 });
    const listener = vi.fn();
    job.subscribeProgress(listener);

    worker.emit({
      type: 'progress',
      jobId: 1,
      progress: { stage: 'terrain', completed: 0.125 },
    });
    job.cancel();
    worker.emit({ type: 'cancelled', jobId: 1 });

    expect(listener).toHaveBeenCalledWith({ stage: 'terrain', completed: 0.125 });
    expect(worker.messages).toEqual([
      { type: 'generate', jobId: 1, request: { templateId: 'continent', seed: 7 } },
      { type: 'cancel', jobId: 1 },
    ]);
    await expect(job.result).rejects.toMatchObject({ name: 'AbortError' });
    service.destroy();
    expect(worker.terminated).toBe(true);
  });

  it('transfers every authoritative column exactly once', () => {
    const snapshot = fakeSnapshot();
    const transferables = snapshotTransferables(snapshot);

    expect(transferables).toHaveLength(12);
    expect(new Set(transferables).size).toBe(12);
  });
});

class FakeWorker {
  readonly messages: WorldWorkerRequest[] = [];
  terminated = false;
  private listener: ((event: MessageEvent<WorldWorkerResponse>) => void) | undefined;

  postMessage(message: WorldWorkerRequest): void {
    this.messages.push(message);
  }

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<WorldWorkerResponse>) => void,
  ): void {
    this.listener = listener;
  }

  removeEventListener(): void {
    this.listener = undefined;
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(message: WorldWorkerResponse): void {
    this.listener?.({ data: message } as MessageEvent<WorldWorkerResponse>);
  }
}

function fakeSnapshot(): WorldSnapshot {
  return {
    metadata: {
      snapshotId: 'test',
      templateId: 'continent',
      seed: 1,
      generatorVersion: 1,
      size: 1024,
      checksum: 'test',
    },
    cells: {
      elevation: new Uint8Array(1),
      landform: new Uint8Array(1),
      hydrology: new Uint8Array(1),
      biome: new Uint8Array(1),
      groundMaterial: new Uint8Array(1),
      environmentTheme: new Uint8Array(1),
    },
    objects: {
      objectIds: new Uint32Array(1),
      anchorCells: new Uint32Array(1),
      semanticFamilyIds: new Uint16Array(1),
      formTags: new Uint16Array(1),
      variantSeeds: new Uint32Array(1),
      chunkOffsets: new Uint32Array(1),
    },
  };
}
