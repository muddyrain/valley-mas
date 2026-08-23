import { describe, expect, it, vi } from 'vitest';

import type { GenerationJob, GenerationService } from '../generation/GenerationJob';
import type { GenerationProgress, WorldGenerationRequest } from '../generation/WorldGenerator';
import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { VisualCatalog } from '../visual/VisualCatalog';
import { createMapSessionCore, type MapSessionDependencies } from './MapSession';

describe('MapSession', () => {
  it('publishes all eight templates and opens the world only after all readiness gates pass', async () => {
    const harness = createHarness();
    const session = createMapSessionCore(harness.dependencies);
    const states = vi.fn();
    session.subscribe(states);

    expect(session.getState().status).toBe('template-selection');
    expect(session.getState().templates).toHaveLength(8);
    session.generate({ templateId: 'continent', seed: 42 });
    harness.jobs[0]?.progress({ stage: 'terrain', completed: 0.125 });
    expect(session.getState()).toMatchObject({
      status: 'loading',
      templateId: 'continent',
      seed: 42,
      stage: 'terrain',
      completed: 0.1,
    });

    harness.visual.resolve(fakeCatalog());
    harness.jobs[0]?.resolve(fakeSnapshot('continent', 42));
    await flush();
    expect(session.getState()).toMatchObject({
      status: 'loading',
      stage: 'world-view-prep',
      completed: 0.9,
    });
    harness.worldReady.resolve();
    await flush();

    expect(session.getState()).toMatchObject({
      status: 'world',
      templateId: 'continent',
      seed: 42,
    });
    harness.emitLod('close');
    expect(session.getState()).toMatchObject({ status: 'world', lod: 'close' });
    expect(states).toHaveBeenCalled();
  });

  it('ignores a replaced job and returns to template selection on cancellation', async () => {
    const harness = createHarness();
    const session = createMapSessionCore(harness.dependencies);
    session.generate({ templateId: 'continent', seed: 1 });
    session.generate({ templateId: 'ring_continent', seed: 2 });

    expect(harness.jobs[0]?.cancelled).toBe(true);
    harness.jobs[0]?.resolve(fakeSnapshot('continent', 1));
    await flush();
    expect(session.getState()).toMatchObject({ status: 'loading', templateId: 'ring_continent' });

    session.cancelGeneration();
    expect(harness.jobs[1]?.cancelled).toBe(true);
    expect(session.getState().status).toBe('template-selection');
  });

  it('makes destroyed terminal and maps internal generation errors to a stable category', async () => {
    const harness = createHarness();
    const session = createMapSessionCore(harness.dependencies);
    session.generate({ templateId: 'continent', seed: 3 });
    harness.jobs[0]?.reject(new Error('worker stack and path'));
    await flush();

    expect(session.getState()).toMatchObject({ status: 'failed', error: 'generation_failed' });
    session.destroy();
    expect(session.getState().status).toBe('destroyed');
    expect(() => session.generate({ templateId: 'continent', seed: 3 })).toThrow(/destroyed/);
  });

  it('aborts runtime preparation when loading is cancelled', async () => {
    const harness = createHarness();
    const session = createMapSessionCore(harness.dependencies);
    session.generate({ templateId: 'continent', seed: 8 });
    harness.visual.resolve(fakeCatalog());
    harness.jobs[0]?.resolve(fakeSnapshot('continent', 8));
    await flush();

    session.cancelGeneration();

    expect(harness.worldSignals[0]?.aborted).toBe(true);
    expect(session.getState().status).toBe('template-selection');
  });

  it('returns from an open world to template selection without refreshing the page', async () => {
    const harness = createHarness();
    const session = createMapSessionCore(harness.dependencies);
    session.generate({ templateId: 'continent', seed: 21 });
    harness.visual.resolve(fakeCatalog());
    harness.jobs[0]?.resolve(fakeSnapshot('continent', 21));
    await flush();
    harness.worldReady.resolve();
    await flush();

    expect(session.getState().status).toBe('world');
    session.returnToTemplateSelection();
    expect(session.getState().status).toBe('template-selection');
  });
});

function createHarness() {
  const jobs: FakeJob[] = [];
  const visual = deferred<VisualCatalog>();
  const worldReady = deferred<void>();
  const worldSignals: AbortSignal[] = [];
  let lodListener: ((lod: 'world' | 'region' | 'close') => void) | undefined;
  const generation: GenerationService = {
    start: (request) => {
      const job = new FakeJob(request);
      jobs.push(job);
      return job;
    },
    destroy: vi.fn(),
  };
  const dependencies: MapSessionDependencies = {
    generation,
    loadInitialVisualCatalog: () => visual.promise,
    prepareWorld: (_snapshot, _catalog, signal) => {
      worldSignals.push(signal);
      return worldReady.promise;
    },
    setViewport: vi.fn(),
    subscribeLod: (listener) => {
      lodListener = listener;
      listener('world');
      return () => {
        lodListener = undefined;
      };
    },
    destroyRuntime: vi.fn(),
  };
  return {
    dependencies,
    jobs,
    visual,
    worldReady,
    worldSignals,
    emitLod: (lod: 'world' | 'region' | 'close') => lodListener?.(lod),
  };
}

class FakeJob implements GenerationJob {
  readonly result: Promise<WorldSnapshot>;
  cancelled = false;
  private accept!: (snapshot: WorldSnapshot) => void;
  private decline!: (error: Error) => void;
  private readonly listeners = new Set<(progress: GenerationProgress) => void>();

  constructor(readonly request: WorldGenerationRequest) {
    this.result = new Promise((resolve, reject) => {
      this.accept = resolve;
      this.decline = reject;
    });
  }

  subscribeProgress(listener: (progress: GenerationProgress) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  cancel(): void {
    this.cancelled = true;
  }

  progress(progress: GenerationProgress): void {
    for (const listener of this.listeners) listener(progress);
  }

  resolve(snapshot: WorldSnapshot): void {
    this.accept(snapshot);
  }

  reject(error: Error): void {
    this.decline(error);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function fakeCatalog(): VisualCatalog {
  return {
    version: 'test',
    resolve: vi.fn(),
    getProjectionMetadata: vi.fn(),
    getRenderMetadata: vi.fn(),
    getPaletteColor: vi.fn(),
  };
}

function fakeSnapshot(templateId: string, seed: number): WorldSnapshot {
  return { metadata: { templateId, seed } } as WorldSnapshot;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
