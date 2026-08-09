export type BrowserImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type ImageResizeFit = 'contain' | 'cover' | 'fill';
export type ImageWatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

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

export interface ImageCropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageWatermarkOptions {
  text: string;
  position?: ImageWatermarkPosition;
  margin?: number;
  opacity?: number;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  rotateDegrees?: number;
  maxWidthRatio?: number;
}

export interface ImageTransformOptions {
  crop?: ImageCropOptions;
  width?: number;
  height?: number;
  maxDimension?: number;
  fit?: ImageResizeFit;
  allowUpscale?: boolean;
  rotateDegrees?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  cornerRadius?: number;
  backgroundColor?: string;
  watermark?: ImageWatermarkOptions;
  mimeType?: BrowserImageMimeType;
  quality?: number;
  fileName?: string;
  lastModified?: number;
}

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  minSize?: number;
  mimeType?: BrowserImageMimeType;
}

export interface ExportImageOptions
  extends Pick<
    ImageTransformOptions,
    | 'width'
    | 'height'
    | 'maxDimension'
    | 'fit'
    | 'allowUpscale'
    | 'rotateDegrees'
    | 'flipHorizontal'
    | 'flipVertical'
    | 'crop'
    | 'cornerRadius'
    | 'backgroundColor'
    | 'watermark'
    | 'mimeType'
    | 'quality'
    | 'fileName'
    | 'lastModified'
  > {}

export interface ImageDataUrlResult {
  url: string;
  width: number;
  height: number;
}

export interface ImageSourceDimensions {
  width: number;
  height: number;
}

export interface ImageTransformPlan {
  source: ImageCropOptions;
  drawWidth: number;
  drawHeight: number;
  outputWidth: number;
  outputHeight: number;
  rotateDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface BrowserImageToolManifest {
  name: 'image.transform';
  description: string;
  runtime: 'browser';
  operations: Array<
    'convert' | 'compress' | 'crop' | 'resize' | 'rotate' | 'flip' | 'round-corners' | 'watermark'
  >;
  inputSchema: {
    type: 'object';
    required: string[];
    properties: Record<string, unknown>;
  };
}

export type BrowserImageToolResult = { ok: true; file: File } | { ok: false; error: string };

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

export function createImageTransformPlan(
  sourceDimensions: ImageSourceDimensions,
  options: ImageTransformOptions = {},
): ImageTransformPlan {
  assertPositiveDimension(sourceDimensions.width, 'source width');
  assertPositiveDimension(sourceDimensions.height, 'source height');

  let source = normalizeCrop(sourceDimensions, options.crop);
  const fit = options.fit ?? 'contain';
  const requestedWidth = positiveNumber(options.width);
  const requestedHeight = positiveNumber(options.height);

  if (fit === 'cover' && requestedWidth && requestedHeight) {
    source = cropToAspectRatio(source, requestedWidth / requestedHeight);
  }

  const { width: drawWidth, height: drawHeight } = calculateDrawDimensions(source, {
    requestedWidth,
    requestedHeight,
    maxDimension: positiveNumber(options.maxDimension),
    fit,
    allowUpscale: options.allowUpscale ?? false,
  });
  const rotateDegrees = normalizeDegrees(options.rotateDegrees ?? 0);
  const radians = (rotateDegrees * Math.PI) / 180;
  const outputWidth = Math.max(
    1,
    Math.round(Math.abs(drawWidth * Math.cos(radians)) + Math.abs(drawHeight * Math.sin(radians))),
  );
  const outputHeight = Math.max(
    1,
    Math.round(Math.abs(drawWidth * Math.sin(radians)) + Math.abs(drawHeight * Math.cos(radians))),
  );

  return {
    source,
    drawWidth,
    drawHeight,
    outputWidth,
    outputHeight,
    rotateDegrees,
    flipHorizontal: options.flipHorizontal ?? false,
    flipVertical: options.flipVertical ?? false,
  };
}

export function getOutputFileName(fileName: string, mimeType: BrowserImageMimeType): string {
  const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.${extension}`;
}

export function getBrowserImageToolManifest(): BrowserImageToolManifest {
  return {
    name: 'image.transform',
    description:
      'Transform one browser image with format conversion, compression, crop, resize, rotation, flip, rounded corners, and a text watermark.',
    runtime: 'browser',
    operations: [
      'convert',
      'compress',
      'crop',
      'resize',
      'rotate',
      'flip',
      'round-corners',
      'watermark',
    ],
    inputSchema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', contentEncoding: 'binary' },
        options: {
          type: 'object',
          additionalProperties: false,
          properties: {
            crop: {
              type: 'object',
              properties: {
                x: { type: 'number', minimum: 0 },
                y: { type: 'number', minimum: 0 },
                width: { type: 'number', exclusiveMinimum: 0 },
                height: { type: 'number', exclusiveMinimum: 0 },
              },
            },
            width: { type: 'number', exclusiveMinimum: 0 },
            height: { type: 'number', exclusiveMinimum: 0 },
            maxDimension: { type: 'number', exclusiveMinimum: 0 },
            fit: { type: 'string', enum: ['contain', 'cover', 'fill'] },
            allowUpscale: { type: 'boolean' },
            rotateDegrees: { type: 'number' },
            flipHorizontal: { type: 'boolean' },
            flipVertical: { type: 'boolean' },
            cornerRadius: { type: 'number', minimum: 0 },
            backgroundColor: { type: 'string' },
            watermark: {
              type: 'object',
              required: ['text'],
              properties: {
                text: { type: 'string' },
                position: { type: 'string' },
                opacity: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
            mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
            quality: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
  };
}

export async function readImageMetadata(file: File): Promise<ImageMetadata> {
  const image = await decodeImage(file);
  try {
    const { width, height } = getSourceSize(image);
    return {
      width,
      height,
      size: file.size,
      type: file.type,
      name: file.name,
      aspectRatio: width / height,
    };
  } finally {
    closeDecodedImage(image);
  }
}

export async function transformImageFile(
  file: File,
  options: ImageTransformOptions = {},
): Promise<File> {
  assertTransformableFile(file);
  const image = await decodeImage(file);
  try {
    const mimeType = options.mimeType ?? inferOutputMimeType(file.type);
    const blob = await exportImageBlob(image, { ...options, mimeType });
    if (!blob) throw new Error(`浏览器无法导出 ${mimeType} 图片。`);
    return new File([blob], getOutputFileName(options.fileName ?? file.name, mimeType), {
      type: mimeType,
      lastModified: options.lastModified ?? file.lastModified,
    });
  } finally {
    closeDecodedImage(image);
  }
}

export async function runBrowserImageTool(params: {
  file: File;
  options?: ImageTransformOptions;
}): Promise<BrowserImageToolResult> {
  try {
    return { ok: true, file: await transformImageFile(params.file, params.options) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : '图片处理失败。',
    };
  }
}

export async function resizeImageFile(file: File, options: ExportImageOptions = {}): Promise<File> {
  if (!isTransformableFile(file)) return file;
  try {
    return await transformImageFile(file, options);
  } catch {
    return file;
  }
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!shouldCompressImageFile(file, options) || typeof document === 'undefined') return file;

  try {
    const output = await transformImageFile(file, {
      maxDimension: options.maxDimension ?? DEFAULT_MAX_DIMENSION,
      quality: options.quality ?? DEFAULT_QUALITY,
      mimeType: options.mimeType ?? 'image/jpeg',
    });
    return output.size < file.size ? output : file;
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

function calculateDrawDimensions(
  source: ImageCropOptions,
  options: {
    requestedWidth?: number;
    requestedHeight?: number;
    maxDimension?: number;
    fit: ImageResizeFit;
    allowUpscale: boolean;
  },
): { width: number; height: number } {
  const { requestedWidth, requestedHeight, maxDimension, fit, allowUpscale } = options;
  if (requestedWidth && requestedHeight && fit === 'fill') {
    return {
      width: Math.max(
        1,
        Math.round(allowUpscale ? requestedWidth : Math.min(requestedWidth, source.width)),
      ),
      height: Math.max(
        1,
        Math.round(allowUpscale ? requestedHeight : Math.min(requestedHeight, source.height)),
      ),
    };
  }

  let scale = 1;
  if (requestedWidth && requestedHeight) {
    scale =
      fit === 'cover'
        ? requestedWidth / source.width
        : Math.min(requestedWidth / source.width, requestedHeight / source.height);
  } else if (requestedWidth) {
    scale = requestedWidth / source.width;
  } else if (requestedHeight) {
    scale = requestedHeight / source.height;
  } else if (maxDimension) {
    scale = maxDimension / Math.max(source.width, source.height);
  }

  if (!allowUpscale) scale = Math.min(scale, 1);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}

function normalizeCrop(source: ImageSourceDimensions, crop?: ImageCropOptions): ImageCropOptions {
  if (!crop) return { x: 0, y: 0, width: source.width, height: source.height };

  const x = clamp(finiteNumber(crop.x, 0), 0, Math.max(source.width - 1, 0));
  const y = clamp(finiteNumber(crop.y, 0), 0, Math.max(source.height - 1, 0));
  const width = clamp(finiteNumber(crop.width, source.width - x), 1, source.width - x);
  const height = clamp(finiteNumber(crop.height, source.height - y), 1, source.height - y);
  return { x, y, width, height };
}

function cropToAspectRatio(source: ImageCropOptions, targetAspectRatio: number): ImageCropOptions {
  const sourceAspectRatio = source.width / source.height;
  if (Math.abs(sourceAspectRatio - targetAspectRatio) < Number.EPSILON) return source;

  if (sourceAspectRatio > targetAspectRatio) {
    const width = source.height * targetAspectRatio;
    return { ...source, x: source.x + (source.width - width) / 2, width };
  }

  const height = source.width / targetAspectRatio;
  return { ...source, y: source.y + (source.height - height) / 2, height };
}

function drawImageToCanvas(source: BrowserImageSource, options: ExportImageOptions) {
  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持浏览器 Canvas。');
  }

  const plan = createImageTransformPlan(getSourceSize(source), options);
  const canvas = document.createElement('canvas');
  canvas.width = plan.outputWidth;
  canvas.height = plan.outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前环境不支持 Canvas 2D 上下文。');

  context.save();
  applyOutputClip(context, canvas, options.cornerRadius);
  const backgroundColor =
    options.backgroundColor ?? (options.mimeType === 'image/jpeg' ? '#ffffff' : undefined);
  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((plan.rotateDegrees * Math.PI) / 180);
  context.scale(plan.flipHorizontal ? -1 : 1, plan.flipVertical ? -1 : 1);
  context.drawImage(
    source,
    plan.source.x,
    plan.source.y,
    plan.source.width,
    plan.source.height,
    -plan.drawWidth / 2,
    -plan.drawHeight / 2,
    plan.drawWidth,
    plan.drawHeight,
  );
  context.restore();

  if (options.watermark?.text.trim()) {
    context.save();
    applyOutputClip(context, canvas, options.cornerRadius);
    drawTextWatermark(context, canvas, options.watermark);
    context.restore();
  }
  return canvas;
}

function applyOutputClip(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  radiusValue?: number,
) {
  const radius = clamp(finiteNumber(radiusValue, 0), 0, Math.min(canvas.width, canvas.height) / 2);
  if (radius <= 0) return;

  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.clip();
}

function drawTextWatermark(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  watermark: ImageWatermarkOptions,
) {
  const position = watermark.position ?? 'bottom-right';
  const margin = Math.max(
    0,
    finiteNumber(watermark.margin, Math.round(Math.min(canvas.width, canvas.height) * 0.04)),
  );
  const fontSize = Math.max(
    1,
    finiteNumber(watermark.fontSize, Math.round(Math.min(canvas.width, canvas.height) * 0.05)),
  );
  const [vertical, horizontal] = position.split('-') as [string, string | undefined];
  const horizontalPosition = horizontal ?? vertical;
  const verticalPosition = horizontal ? vertical : 'center';
  const x =
    horizontalPosition === 'left'
      ? margin
      : horizontalPosition === 'right'
        ? canvas.width - margin
        : canvas.width / 2;
  const y =
    verticalPosition === 'top'
      ? margin
      : verticalPosition === 'bottom'
        ? canvas.height - margin
        : canvas.height / 2;

  context.translate(x, y);
  context.rotate((finiteNumber(watermark.rotateDegrees, 0) * Math.PI) / 180);
  context.globalAlpha = clamp(finiteNumber(watermark.opacity, 0.72), 0, 1);
  context.fillStyle = watermark.color ?? '#ffffff';
  context.font = `${watermark.fontWeight ?? 600} ${fontSize}px ${watermark.fontFamily ?? 'sans-serif'}`;
  context.textAlign =
    horizontalPosition === 'left' ? 'left' : horizontalPosition === 'right' ? 'right' : 'center';
  context.textBaseline =
    verticalPosition === 'top' ? 'top' : verticalPosition === 'bottom' ? 'bottom' : 'middle';
  const maxWidthRatio = clamp(finiteNumber(watermark.maxWidthRatio, 0.8), 0.05, 1);
  context.fillText(watermark.text, 0, 0, canvas.width * maxWidthRatio);
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall back for browsers without full createImageBitmap option support.
    }
  }

  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    throw new Error('当前环境无法解码浏览器图片。');
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
      reject(new Error('图片解码失败。'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, clamp(quality, 0, 1));
  });
}

function getSourceSize(source: BrowserImageSource): ImageSourceDimensions {
  const width = source.naturalWidth || source.width || 1;
  const height = source.naturalHeight || source.height || 1;
  return { width, height };
}

function closeDecodedImage(image: DecodedImage) {
  if ('close' in image && typeof image.close === 'function') image.close();
}

function inferOutputMimeType(inputType: string): BrowserImageMimeType {
  if (inputType === 'image/jpeg' || inputType === 'image/png' || inputType === 'image/webp') {
    return inputType;
  }
  return 'image/png';
}

function assertTransformableFile(file: File) {
  if (!isTransformableFile(file)) {
    if (typeof document === 'undefined') throw new Error('当前环境不支持浏览器 Canvas。');
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。');
    throw new Error('GIF 动图需要保留帧信息，不能使用当前静态图片处理器。');
  }
}

function isTransformableFile(file: File) {
  return (
    file.type.startsWith('image/') && file.type !== 'image/gif' && typeof document !== 'undefined'
  );
}

function positiveNumber(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteNumber(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeDegrees(value: number) {
  const normalized = ((finiteNumber(value, 0) % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function assertPositiveDimension(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero.`);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
