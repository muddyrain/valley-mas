import type { GenerationJob, GenerationService } from '../generation/GenerationJob';
import type { GenerationProgress } from '../generation/WorldGenerator';
import type { WorldSnapshot } from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import type { VisualBundleInput, VisualCatalog } from '../visual/VisualCatalog';

export type MapSessionError =
  | 'generation_failed'
  | 'visual_bundle_invalid'
  | 'gpu_unsupported'
  | 'memory_budget_exceeded'
  | 'render_failed';

export type MapLod = 'world' | 'region' | 'close';
export type VisualStatus = 'stable' | 'preparing' | 'fallback';

export interface MapTemplateSummary {
  readonly id: string;
}

export interface MapViewport {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
}

interface StateCommon {
  readonly templates: readonly MapTemplateSummary[];
}

export type MapSessionState = StateCommon &
  (
    | { readonly status: 'template-selection' }
    | {
        readonly status: 'loading';
        readonly templateId: string;
        readonly seed: number;
        readonly stage: GenerationProgress['stage'] | 'starting' | 'world-view-prep';
        readonly completed: number;
      }
    | {
        readonly status: 'failed';
        readonly templateId: string;
        readonly seed: number;
        readonly error: MapSessionError;
      }
    | {
        readonly status: 'world';
        readonly templateId: string;
        readonly seed: number;
        readonly lod: MapLod;
        readonly visualStatus: VisualStatus;
      }
    | { readonly status: 'destroyed' }
  );

export interface MapSession {
  getState(): MapSessionState;
  generate(request: { readonly templateId: string; readonly seed: number }): void;
  cancelGeneration(): void;
  returnToTemplateSelection(): void;
  setViewport(viewport: MapViewport): void;
  replaceVisualBundle(bundle: VisualBundleInput): Promise<void>;
  subscribe(listener: (state: MapSessionState) => void): () => void;
  destroy(): void;
}

export interface MapSessionDependencies {
  readonly generation: GenerationService;
  readonly loadInitialVisualCatalog: () => Promise<VisualCatalog>;
  readonly prepareWorld: (
    snapshot: WorldSnapshot,
    catalog: VisualCatalog,
    signal: AbortSignal,
  ) => Promise<void>;
  readonly loadVisualBundle?: (bundle: VisualBundleInput) => Promise<VisualCatalog>;
  readonly prepareVisualSwap?: (catalog: VisualCatalog, signal: AbortSignal) => Promise<void>;
  readonly setViewport: (viewport: MapViewport) => void;
  readonly subscribeLod?: (listener: (lod: MapLod) => void) => () => void;
  readonly destroyRuntime: () => void;
}

const templates = Object.freeze(
  WORLD_RULES_CATALOG.templates.map(({ id }) => Object.freeze({ id })),
);

export function createMapSessionCore(dependencies: MapSessionDependencies): MapSession {
  return new MapSessionController(dependencies);
}

class MapSessionController implements MapSession {
  private state: MapSessionState = { status: 'template-selection', templates };
  private readonly listeners = new Set<(state: MapSessionState) => void>();
  private currentJob: GenerationJob | undefined;
  private unsubscribeProgress: (() => void) | undefined;
  private generationToken = 0;
  private visualSwapToken = 0;
  private currentRunController: AbortController | undefined;
  private visualSwapController: AbortController | undefined;
  private initialCatalogPromise: Promise<VisualCatalog> | undefined;
  private destroyed = false;
  private readonly unsubscribeLod: (() => void) | undefined;

  constructor(private readonly dependencies: MapSessionDependencies) {
    this.unsubscribeLod = dependencies.subscribeLod?.((lod) => {
      if (this.state.status === 'world' && this.state.lod !== lod) {
        this.publish({ ...this.state, lod });
      }
    });
  }

  getState(): MapSessionState {
    return this.state;
  }

  generate(request: { readonly templateId: string; readonly seed: number }): void {
    this.assertLive();
    if (!templates.some(({ id }) => id === request.templateId)) {
      throw new Error(`Unknown world template: ${request.templateId}`);
    }
    if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffff_ffff) {
      throw new Error('World seed must be an unsigned 32-bit integer');
    }
    this.cancelActiveJob();
    const token = ++this.generationToken;
    const runController = new AbortController();
    this.currentRunController = runController;
    const job = this.dependencies.generation.start(request);
    this.currentJob = job;
    this.unsubscribeProgress = job.subscribeProgress((progress) => {
      if (token !== this.generationToken || this.state.status !== 'loading') return;
      this.publish({
        status: 'loading',
        templates,
        templateId: request.templateId,
        seed: request.seed,
        stage: progress.stage,
        completed: progress.completed * 0.8,
      });
    });
    this.publish({
      status: 'loading',
      templates,
      templateId: request.templateId,
      seed: request.seed,
      stage: 'starting',
      completed: 0,
    });
    this.initialCatalogPromise ??= this.dependencies.loadInitialVisualCatalog();
    void this.finishGeneration(token, request, job, this.initialCatalogPromise, runController);
  }

  cancelGeneration(): void {
    this.assertLive();
    if (this.state.status === 'failed') {
      this.publish({ status: 'template-selection', templates });
      return;
    }
    if (this.state.status !== 'loading') return;
    this.generationToken += 1;
    this.cancelActiveJob();
    this.publish({ status: 'template-selection', templates });
  }

  returnToTemplateSelection(): void {
    this.assertLive();
    if (this.state.status === 'destroyed' || this.state.status === 'template-selection') return;
    this.generationToken += 1;
    this.cancelActiveJob();
    this.publish({ status: 'template-selection', templates });
  }

  setViewport(viewport: MapViewport): void {
    this.assertLive();
    this.dependencies.setViewport(viewport);
    if (this.state.status !== 'world') return;
    const lod: MapLod = viewport.zoom < 0.75 ? 'world' : viewport.zoom < 2.5 ? 'region' : 'close';
    if (lod !== this.state.lod) this.publish({ ...this.state, lod });
  }

  async replaceVisualBundle(bundle: VisualBundleInput): Promise<void> {
    this.assertLive();
    if (this.state.status !== 'world')
      throw new Error('Visual bundles can only be replaced in a world');
    if (
      this.dependencies.loadVisualBundle === undefined ||
      this.dependencies.prepareVisualSwap === undefined
    ) {
      throw new Error('Visual replacement runtime is not available');
    }
    const token = ++this.visualSwapToken;
    this.visualSwapController?.abort();
    const swapController = new AbortController();
    this.visualSwapController = swapController;
    const previousState = this.state;
    this.publish({ ...previousState, visualStatus: 'preparing' });
    try {
      const catalog = await this.dependencies.loadVisualBundle(bundle);
      await this.dependencies.prepareVisualSwap(catalog, swapController.signal);
      if (token !== this.visualSwapToken || this.destroyed) return;
      this.visualSwapController = undefined;
      if (this.state.status === 'world') this.publish({ ...this.state, visualStatus: 'stable' });
    } catch {
      if (token === this.visualSwapToken) this.visualSwapController = undefined;
      if (token === this.visualSwapToken && !this.destroyed && this.state.status === 'world') {
        this.publish({ ...this.state, visualStatus: previousState.visualStatus });
      }
    }
  }

  subscribe(listener: (state: MapSessionState) => void): () => void {
    this.assertLive();
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.generationToken += 1;
    this.visualSwapToken += 1;
    this.visualSwapController?.abort();
    this.visualSwapController = undefined;
    this.cancelActiveJob();
    this.unsubscribeLod?.();
    this.dependencies.generation.destroy();
    this.dependencies.destroyRuntime();
    this.publish({ status: 'destroyed', templates });
    this.listeners.clear();
  }

  private async finishGeneration(
    token: number,
    request: { readonly templateId: string; readonly seed: number },
    job: GenerationJob,
    catalogPromise: Promise<VisualCatalog>,
    runController: AbortController,
  ): Promise<void> {
    try {
      const [snapshot, catalog] = await Promise.all([
        job.result.catch(() => Promise.reject(new SessionFailure('generation_failed'))),
        catalogPromise.catch(() => Promise.reject(new SessionFailure('visual_bundle_invalid'))),
      ]);
      if (token !== this.generationToken || this.destroyed) return;
      this.publish({
        status: 'loading',
        templates,
        templateId: request.templateId,
        seed: request.seed,
        stage: 'world-view-prep',
        completed: 0.9,
      });
      await this.dependencies
        .prepareWorld(snapshot, catalog, runController.signal)
        .catch(() => Promise.reject(new SessionFailure('render_failed')));
      if (token !== this.generationToken || this.destroyed) return;
      this.currentJob = undefined;
      this.currentRunController = undefined;
      this.unsubscribeProgress?.();
      this.unsubscribeProgress = undefined;
      this.publish({
        status: 'world',
        templates,
        templateId: request.templateId,
        seed: request.seed,
        lod: 'world',
        visualStatus: 'fallback',
      });
    } catch (error) {
      if (token !== this.generationToken || this.destroyed) return;
      this.currentJob = undefined;
      this.currentRunController = undefined;
      this.unsubscribeProgress?.();
      this.unsubscribeProgress = undefined;
      this.publish({
        status: 'failed',
        templates,
        templateId: request.templateId,
        seed: request.seed,
        error: error instanceof SessionFailure ? error.category : 'render_failed',
      });
    }
  }

  private cancelActiveJob(): void {
    this.currentRunController?.abort();
    this.currentRunController = undefined;
    this.unsubscribeProgress?.();
    this.unsubscribeProgress = undefined;
    this.currentJob?.cancel();
    this.currentJob = undefined;
  }

  private publish(state: MapSessionState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private assertLive(): void {
    if (this.destroyed) throw new Error('MapSession is destroyed');
  }
}

class SessionFailure extends Error {
  constructor(readonly category: MapSessionError) {
    super(category);
  }
}
