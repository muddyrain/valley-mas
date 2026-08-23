import type { WorldSnapshot } from '../model/WorldSnapshot';
import type { GenerationProgress, WorldGenerationRequest } from './WorldGenerator';

export type WorldWorkerRequest =
  | { readonly type: 'generate'; readonly jobId: number; readonly request: WorldGenerationRequest }
  | { readonly type: 'cancel'; readonly jobId: number };

export type WorldWorkerResponse =
  | { readonly type: 'progress'; readonly jobId: number; readonly progress: GenerationProgress }
  | { readonly type: 'completed'; readonly jobId: number; readonly snapshot: WorldSnapshot }
  | { readonly type: 'cancelled'; readonly jobId: number }
  | { readonly type: 'failed'; readonly jobId: number; readonly message: string };

export function snapshotTransferables(snapshot: WorldSnapshot): ArrayBuffer[] {
  return [
    ownedBuffer(snapshot.cells.elevation),
    ownedBuffer(snapshot.cells.landform),
    ownedBuffer(snapshot.cells.hydrology),
    ownedBuffer(snapshot.cells.biome),
    ownedBuffer(snapshot.cells.groundMaterial),
    ownedBuffer(snapshot.cells.environmentTheme),
    ownedBuffer(snapshot.objects.objectIds),
    ownedBuffer(snapshot.objects.anchorCells),
    ownedBuffer(snapshot.objects.semanticFamilyIds),
    ownedBuffer(snapshot.objects.formTags),
    ownedBuffer(snapshot.objects.variantSeeds),
    ownedBuffer(snapshot.objects.chunkOffsets),
  ];
}

function ownedBuffer(view: ArrayBufferView<ArrayBufferLike>): ArrayBuffer {
  if (!(view.buffer instanceof ArrayBuffer)) {
    throw new Error('World snapshot columns must own transferable ArrayBuffers');
  }
  return view.buffer;
}
