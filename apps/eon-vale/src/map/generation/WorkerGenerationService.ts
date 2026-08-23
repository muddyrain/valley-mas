import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { GenerationJob, GenerationService } from './GenerationJob';
import type { GenerationProgress, WorldGenerationRequest } from './WorldGenerator';
import type { WorldWorkerRequest, WorldWorkerResponse } from './WorldWorkerProtocol';

interface WorkerPort {
  postMessage(message: WorldWorkerRequest): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorldWorkerResponse>) => void,
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorldWorkerResponse>) => void,
  ): void;
  terminate(): void;
}

interface PendingJob {
  readonly job: WorkerGenerationJob;
  readonly resolve: (snapshot: WorldSnapshot) => void;
  readonly reject: (error: Error) => void;
}

export function createWorkerGenerationService(): GenerationService {
  return new WorkerGenerationService(
    new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module' }),
  );
}

export class WorkerGenerationService implements GenerationService {
  private nextJobId = 1;
  private readonly pending = new Map<number, PendingJob>();
  private destroyed = false;

  constructor(private readonly worker: WorkerPort) {
    this.worker.addEventListener('message', this.handleMessage);
  }

  start(request: WorldGenerationRequest): GenerationJob {
    if (this.destroyed) throw new Error('Generation service is destroyed');
    const jobId = this.nextJobId;
    this.nextJobId += 1;
    let resolve!: (snapshot: WorldSnapshot) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<WorldSnapshot>((accept, decline) => {
      resolve = accept;
      reject = decline;
    });
    const job = new WorkerGenerationJob(request, result, () => {
      if (!this.pending.has(jobId)) return;
      this.worker.postMessage({ type: 'cancel', jobId });
    });
    this.pending.set(jobId, { job, resolve, reject });
    this.worker.postMessage({ type: 'generate', jobId, request });
    return job;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.terminate();
    for (const pending of this.pending.values())
      pending.reject(new Error('Generation service destroyed'));
    this.pending.clear();
  }

  private readonly handleMessage = (event: MessageEvent<WorldWorkerResponse>): void => {
    const message = event.data;
    const pending = this.pending.get(message.jobId);
    if (pending === undefined) return;
    if (message.type === 'progress') {
      pending.job.publish(message.progress);
      return;
    }
    this.pending.delete(message.jobId);
    if (message.type === 'completed') pending.resolve(message.snapshot);
    else if (message.type === 'cancelled')
      pending.reject(new DOMException('World generation cancelled', 'AbortError'));
    else pending.reject(new Error(message.message));
  };
}

class WorkerGenerationJob implements GenerationJob {
  private readonly listeners = new Set<(progress: GenerationProgress) => void>();

  constructor(
    readonly request: WorldGenerationRequest,
    readonly result: Promise<WorldSnapshot>,
    private readonly cancelJob: () => void,
  ) {}

  subscribeProgress(listener: (progress: GenerationProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  cancel(): void {
    this.cancelJob();
  }

  publish(progress: GenerationProgress): void {
    for (const listener of this.listeners) listener(progress);
  }
}
