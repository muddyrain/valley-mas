import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { GenerationProgress, WorldGenerationRequest } from './WorldGenerator';

export interface GenerationJob {
  readonly request: WorldGenerationRequest;
  readonly result: Promise<WorldSnapshot>;
  subscribeProgress(listener: (progress: GenerationProgress) => void): () => void;
  cancel(): void;
}

export interface GenerationService {
  start(request: WorldGenerationRequest): GenerationJob;
  destroy(): void;
}
