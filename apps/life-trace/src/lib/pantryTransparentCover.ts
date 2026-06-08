import {
  generatePantryTransparentCover,
  type PantryTransparentCoverRequest,
  type PantryTransparentCoverResponse,
} from '@/api/pantry';
import { uploadLifeTraceImage } from '@/api/upload';
import {
  createPantryCutoutCoverFile,
  PANTRY_CUTOUT_MODEL,
  PANTRY_CUTOUT_TOOL,
  type PantryCutoutRunner,
} from '@/lib/pantryCutout';

export type PantryTransparentCoverSource = PantryTransparentCoverResponse['source'] | 'imgly-local';

export type PantryTransparentCoverResult = Omit<
  PantryTransparentCoverResponse,
  'source' | 'tool'
> & {
  source: PantryTransparentCoverSource;
  tool: PantryTransparentCoverResponse['tool'] | typeof PANTRY_CUTOUT_TOOL;
  localFallback?: boolean;
  model?: string;
};

type GeneratePantryTransparentCoverWithFallbackOptions = {
  signal?: AbortSignal;
  sourceImage?: Blob | string;
  localRunner?: PantryCutoutRunner;
};

export function getPantryTransparentCoverTechLabel(result: PantryTransparentCoverResult) {
  if (result.source === 'imgly-local') {
    return 'IMG.LY 本地';
  }
  if (result.tool === 'remove.bg') {
    return 'remove.bg';
  }
  return result.tool;
}

function isAbortError(error: unknown, signal?: AbortSignal) {
  if (signal?.aborted) {
    return true;
  }
  return error instanceof Error && error.name === 'AbortError';
}

export async function generatePantryTransparentCoverWithFallback(
  token: string,
  input: PantryTransparentCoverRequest,
  options: GeneratePantryTransparentCoverWithFallbackOptions = {},
): Promise<PantryTransparentCoverResult> {
  try {
    return await generatePantryTransparentCover(token, input, { signal: options.signal });
  } catch (cloudError) {
    if (isAbortError(cloudError, options.signal)) {
      throw cloudError;
    }

    const sourceImage = options.sourceImage ?? input.imageUrl;
    const coverFile = await createPantryCutoutCoverFile(sourceImage, {
      runner: options.localRunner,
      signal: options.signal,
    });
    const uploaded = await uploadLifeTraceImage(token, coverFile, { signal: options.signal });

    return {
      thumbnailUrl: uploaded.url,
      source: 'imgly-local',
      tool: PANTRY_CUTOUT_TOOL,
      model: PANTRY_CUTOUT_MODEL,
      format: 'png',
      localFallback: true,
    };
  }
}
