import { createWorkerGenerationService } from './generation/WorkerGenerationService';
import { P0MapRenderer, type P0RendererDebugState } from './render/P0MapRenderer';
import { createMapSessionCore, type MapSession } from './session/MapSession';
import { loadBuiltInVisualCatalog } from './visual/BuiltInVisualCatalog';

export type {
  MapLod,
  MapSession,
  MapSessionError,
  MapSessionState,
  MapTemplateSummary,
  MapViewport,
  VisualStatus,
} from './session/MapSession';

export interface MapRuntimeDiagnostics {
  getDebugState(): P0RendererDebugState;
  advanceTime(milliseconds: number): void;
}

declare global {
  interface Window {
    __eonMapRuntime?: MapRuntimeDiagnostics;
  }
}

export function createMapSession(canvas: HTMLCanvasElement): MapSession {
  const renderer = new P0MapRenderer();
  const runtime: MapRuntimeDiagnostics = {
    getDebugState: () => renderer.getDebugState(),
    advanceTime: () => renderer.advanceTime(),
  };
  window.__eonMapRuntime = runtime;

  return createMapSessionCore({
    generation: createWorkerGenerationService(),
    loadInitialVisualCatalog: loadBuiltInVisualCatalog,
    prepareWorld: async (snapshot, catalog, signal) => {
      try {
        await renderer.prepareWorld(canvas, snapshot, catalog, signal);
      } catch (error) {
        console.error('Map renderer preparation failed', error);
        throw error;
      }
    },
    setViewport: (viewport) => renderer.setViewport(viewport),
    subscribeLod: (listener) => renderer.subscribeLod(listener),
    destroyRuntime: () => {
      if (window.__eonMapRuntime === runtime) delete window.__eonMapRuntime;
      renderer.destroy();
    },
  });
}
