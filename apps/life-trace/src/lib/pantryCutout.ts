export type PantryCutoutRunner = (input: Blob, options?: { signal?: AbortSignal }) => Promise<Blob>;

export type PantryCutoutSupportSnapshot = {
  blob?: boolean;
  file?: boolean;
};

type BackgroundRemovalPipeline = (input: Blob) => Promise<{
  data: ArrayLike<number>;
  width: number;
  height: number;
  channels: number;
  toBlob: (type?: string, quality?: number) => Promise<Blob>;
}>;

const PANTRY_CUTOUT_MODEL_ID = 'Xenova/modnet';
const MIN_VISIBLE_PIXEL_RATIO = 0.01;
const MIN_TRANSPARENT_PIXEL_RATIO = 0.01;
const MIN_VISIBLE_RGB_AVERAGE = 6;

let backgroundRemovalPipelinePromise: Promise<BackgroundRemovalPipeline> | null = null;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('本地透明封面生成已取消。', 'AbortError');
  }
}

function readPantryCutoutSupport(): Required<PantryCutoutSupportSnapshot> {
  return {
    blob: typeof Blob !== 'undefined',
    file: typeof File !== 'undefined',
  };
}

export function getPantryCutoutSupportReason(
  snapshot: PantryCutoutSupportSnapshot = readPantryCutoutSupport(),
) {
  if (!snapshot.blob) {
    return '当前浏览器不支持本地抠图。';
  }
  if (!snapshot.file) {
    return '当前浏览器不支持保存透明封面。';
  }
  return '';
}

export type PantryCutoutImageLike = {
  data: ArrayLike<number>;
  width: number;
  height: number;
  channels: number;
};

export function assertPantryCutoutImageUsable(image: PantryCutoutImageLike) {
  const pixelCount = Math.max(0, image.width * image.height);
  if (!pixelCount || image.channels !== 4) {
    throw new Error('透明封面生成失败：模型没有返回可用透明图。');
  }

  let visiblePixels = 0;
  let transparentPixels = 0;
  let visibleRgbTotal = 0;

  for (let offset = 0; offset < image.data.length; offset += image.channels) {
    const alpha = image.data[offset + 3] ?? 0;
    if (alpha > 16) {
      visiblePixels += 1;
      visibleRgbTotal +=
        (image.data[offset] ?? 0) + (image.data[offset + 1] ?? 0) + (image.data[offset + 2] ?? 0);
    } else {
      transparentPixels += 1;
    }
  }

  const visibleRatio = visiblePixels / pixelCount;
  if (visibleRatio < MIN_VISIBLE_PIXEL_RATIO) {
    throw new Error('透明封面生成失败：没有识别到可用主体。');
  }

  if (transparentPixels / pixelCount < MIN_TRANSPARENT_PIXEL_RATIO) {
    throw new Error('透明封面生成失败：模型没有分离背景。');
  }

  if (visibleRgbTotal / (visiblePixels * 3) < MIN_VISIBLE_RGB_AVERAGE) {
    throw new Error('透明封面生成失败：抠图结果异常，请保留当前封面。');
  }
}

async function getBackgroundRemovalPipeline() {
  if (!backgroundRemovalPipelinePromise) {
    backgroundRemovalPipelinePromise = import('@huggingface/transformers').then(
      async ({ pipeline }) => {
        const remover = await pipeline('background-removal', PANTRY_CUTOUT_MODEL_ID);
        return remover as BackgroundRemovalPipeline;
      },
    );
  }
  return backgroundRemovalPipelinePromise;
}

export async function runTransformersPantryCutout(
  input: Blob,
  options: { signal?: AbortSignal } = {},
) {
  throwIfAborted(options.signal);
  const remover = await getBackgroundRemovalPipeline();
  throwIfAborted(options.signal);
  const image = await remover(input);
  throwIfAborted(options.signal);
  assertPantryCutoutImageUsable(image);
  return image.toBlob('image/png');
}

export async function createPantryCutoutCoverFile(
  input: Blob,
  options: { runner?: PantryCutoutRunner; signal?: AbortSignal } = {},
) {
  const supportReason = getPantryCutoutSupportReason();
  if (supportReason) {
    throw new Error(supportReason);
  }

  const runner = options.runner ?? runTransformersPantryCutout;
  const output = await runner(input, { signal: options.signal });
  if (output.type.toLowerCase() !== 'image/png') {
    throw new Error('透明封面生成失败，请保留当前封面后再试。');
  }

  return new File([output], `pantry-transparent-cover-${Date.now()}.png`, { type: 'image/png' });
}
