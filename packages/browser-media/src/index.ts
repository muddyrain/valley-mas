export type BrowserImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface FileLimitResult<T> {
  accepted: T[];
  remainingSlots: number;
  rejectedCount: number;
  exceededLimit: boolean;
  alreadyAtLimit: boolean;
}

export interface UploadKeyOptions {
  randomUUID?: () => string;
  now?: () => number;
  random?: () => number;
}

export interface FileLike {
  type: string;
  size: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  size: number;
  type: string;
  name: string;
  aspectRatio: number;
}

export interface ImageResizeOptions {
  sourceWidth: number;
  sourceHeight: number;
  maxDimension?: number;
  targetWidth?: number;
  targetHeight?: number;
  allowUpscale?: boolean;
}

export interface ImageResizeDimensions {
  width: number;
  height: number;
  scale: number;
}

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  minSize?: number;
  mimeType?: BrowserImageMimeType;
}

export interface ExportImageOptions {
  width?: number;
  height?: number;
  maxDimension?: number;
  mimeType?: BrowserImageMimeType;
  quality?: number;
  fileName?: string;
  lastModified?: number;
}

export interface ImageDataUrlResult {
  url: string;
  width: number;
  height: number;
}

type DecodedImage = HTMLImageElement | ImageBitmap;
type BrowserImageSource = CanvasImageSource & {
  naturalWidth?: number;
  naturalHeight?: number;
  width?: number;
  height?: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MIN_SIZE = 900 * 1024;

export function limitFiles<T>(
  files: T[],
  currentCount: number,
  maxCount: number,
): FileLimitResult<T> {
  const remainingSlots = Math.max(maxCount - currentCount, 0);
  const accepted = files.slice(0, remainingSlots);
  const rejectedCount = Math.max(files.length - accepted.length, 0);

  return {
    accepted,
    remainingSlots,
    rejectedCount,
    exceededLimit: rejectedCount > 0,
    alreadyAtLimit: remainingSlots === 0 && files.length > 0,
  };
}

export function createUploadKey(options: UploadKeyOptions = {}): string {
  const randomUUID =
    options.randomUUID ??
    (options.now || options.random
      ? undefined
      : globalThis.crypto?.randomUUID?.bind(globalThis.crypto));
  if (randomUUID) return randomUUID();

  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  return `upload-${now()}-${Math.floor(random() * 0x100000000)
    .toString(16)
    .padStart(8, '0')}`;
}

export function shouldCompressImageFile(
  file: FileLike,
  options: Pick<CompressImageOptions, 'minSize'> = {},
): boolean {
  const minSize = options.minSize ?? DEFAULT_MIN_SIZE;
  return file.type.startsWith('image/') && file.type !== 'image/gif' && file.size >= minSize;
}

export function calculateImageResizeDimensions(options: ImageResizeOptions): ImageResizeDimensions {
  const {
    sourceWidth,
    sourceHeight,
    maxDimension,
    targetWidth,
    targetHeight,
    allowUpscale = false,
  } = options;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 1, height: 1, scale: 1 };
  }

  let scale = 1;
  if (targetWidth && targetWidth > 0) {
    scale = targetWidth / sourceWidth;
  } else if (targetHeight && targetHeight > 0) {
    scale = targetHeight / sourceHeight;
  } else if (maxDimension && maxDimension > 0) {
    const longestSide = Math.max(sourceWidth, sourceHeight);
    scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  }

  if (!allowUpscale) scale = Math.min(scale, 1);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return { width, height, scale };
}

export function getOutputFileName(fileName: string, mimeType: BrowserImageMimeType): string {
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.${extension}`;
}

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
  const image = await decodeImage(file);
  const { width, height } = getSourceSize(image);
  closeDecodedImage(image);
  return {
    width,
    height,
    size: file.size,
    type: file.type,
    name: file.name,
    aspectRatio: width / height,
  };
}

export async function resizeImageFile(file: File, options: ExportImageOptions = {}): Promise<File> {
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    typeof document === 'undefined'
  ) {
    return file;
  }

  try {
    const image = await decodeImage(file);
    const blob = await exportImageBlob(image, {
      ...options,
      mimeType: options.mimeType ?? (file.type as BrowserImageMimeType) ?? 'image/jpeg',
    });
    closeDecodedImage(image);

    if (!blob) return file;
    const mimeType = options.mimeType ?? (blob.type as BrowserImageMimeType);
    return new File([blob], getOutputFileName(options.fileName ?? file.name, mimeType), {
      type: mimeType,
      lastModified: options.lastModified ?? file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!shouldCompressImageFile(file, options) || typeof document === 'undefined') {
    return file;
  }

  try {
    const image = await decodeImage(file);
    const blob = await exportImageBlob(image, {
      maxDimension: options.maxDimension ?? DEFAULT_MAX_DIMENSION,
      quality: options.quality ?? DEFAULT_QUALITY,
      mimeType: options.mimeType ?? 'image/jpeg',
    });
    closeDecodedImage(image);

    if (!blob || blob.size >= file.size) return file;
    const mimeType = options.mimeType ?? 'image/jpeg';
    return new File([blob], getOutputFileName(file.name, mimeType), {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function exportImageBlob(
  source: BrowserImageSource,
  options: ExportImageOptions = {},
): Promise<Blob | null> {
  const canvas = drawImageToCanvas(source, options);
  return canvasToBlob(canvas, options.mimeType ?? 'image/jpeg', options.quality ?? DEFAULT_QUALITY);
}

export function exportImageToDataUrl(
  source: BrowserImageSource,
  options: ExportImageOptions = {},
): ImageDataUrlResult {
  const canvas = drawImageToCanvas(source, options);
  const mimeType = options.mimeType ?? 'image/jpeg';
  return {
    url: canvas.toDataURL(mimeType, options.quality ?? DEFAULT_QUALITY),
    width: canvas.width,
    height: canvas.height,
  };
}

function drawImageToCanvas(source: BrowserImageSource, options: ExportImageOptions) {
  if (typeof document === 'undefined') {
    throw new Error('Canvas is unavailable in this environment.');
  }

  const { width: sourceWidth, height: sourceHeight } = getSourceSize(source);
  const dimensions = calculateImageResizeDimensions({
    sourceWidth,
    sourceHeight,
    maxDimension: options.maxDimension,
    targetWidth: options.width,
    targetHeight: options.height,
  });
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
  return canvas;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall back to HTMLImageElement for browsers without full option support.
    }
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image decode failed'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function getSourceSize(source: BrowserImageSource) {
  const width = source.naturalWidth || source.width || 1;
  const height = source.naturalHeight || source.height || 1;
  return { width, height };
}

function closeDecodedImage(image: DecodedImage) {
  if ('close' in image && typeof image.close === 'function') {
    image.close();
  }
}
