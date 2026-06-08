import type { Config, ImageSource } from '@imgly/background-removal';

export type PantryCutoutRunner = (
  input: ImageSource,
  options?: { signal?: AbortSignal },
) => Promise<Blob>;

export type PantryCutoutSupportSnapshot = {
  blob?: boolean;
  file?: boolean;
};

export const PANTRY_CUTOUT_TOOL = '@imgly/background-removal';
export const PANTRY_CUTOUT_MODEL = 'isnet_quint8';

const MIN_VISIBLE_PIXEL_RATIO = 0.01;
const MIN_TRANSPARENT_PIXEL_RATIO = 0.01;
const MIN_VISIBLE_RGB_AVERAGE = 4;

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

function getCanvasContext(width: number, height: number) {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d');
}

async function readBlobImageData(blob: Blob) {
  if (typeof createImageBitmap === 'undefined') {
    return null;
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const context = getCanvasContext(bitmap.width, bitmap.height);
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export function assertPantryCutoutImageUsable(image: ImageData) {
  const pixelCount = Math.max(0, image.width * image.height);
  if (!pixelCount) {
    throw new Error('透明封面生成失败：模型没有返回可用透明图。');
  }

  let visiblePixels = 0;
  let transparentPixels = 0;
  let visibleRgbTotal = 0;

  for (let offset = 0; offset < image.data.length; offset += 4) {
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

export async function assertPantryCutoutBlobUsable(blob: Blob) {
  if (blob.size <= 0) {
    throw new Error('透明封面生成失败：模型返回空图片。');
  }
  if (blob.type && blob.type.toLowerCase() !== 'image/png') {
    throw new Error('透明封面生成失败，请保留当前封面后再试。');
  }

  const imageData = await readBlobImageData(blob);
  if (imageData) {
    assertPantryCutoutImageUsable(imageData);
  }
}

export async function runImglyPantryCutout(
  input: ImageSource,
  options: { signal?: AbortSignal } = {},
) {
  throwIfAborted(options.signal);
  const { removeBackground } = await import('@imgly/background-removal');
  throwIfAborted(options.signal);

  const config: Config = {
    model: PANTRY_CUTOUT_MODEL,
    output: {
      format: 'image/png',
    },
    fetchArgs: options.signal ? { signal: options.signal } : undefined,
  };
  const output = await removeBackground(input, config);
  throwIfAborted(options.signal);
  await assertPantryCutoutBlobUsable(output);
  return output;
}

export async function createPantryCutoutCoverFile(
  input: ImageSource,
  options: { runner?: PantryCutoutRunner; signal?: AbortSignal } = {},
) {
  const supportReason = getPantryCutoutSupportReason();
  if (supportReason) {
    throw new Error(supportReason);
  }

  const runner = options.runner ?? runImglyPantryCutout;
  const output = await runner(input, { signal: options.signal });
  await assertPantryCutoutBlobUsable(output);
  return new File([output], `pantry-transparent-cover-${Date.now()}.png`, { type: 'image/png' });
}
