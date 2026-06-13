type CompressImageOptions = {
  maxDimension?: number;
  quality?: number;
  minSize?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
};

const defaultMaxDimension = 1600;
const defaultQuality = 0.82;
const defaultMinSize = 900 * 1024;

function getCompressedFileName(fileName: string, mimeType: string) {
  const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function decodeImage(file: File) {
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall back to HTMLImageElement below for browsers without full option support.
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

export async function compressImageFile(file: File, options: CompressImageOptions = {}) {
  const maxDimension = options.maxDimension ?? defaultMaxDimension;
  const quality = options.quality ?? defaultQuality;
  const minSize = options.minSize ?? defaultMinSize;
  const mimeType = options.mimeType ?? 'image/jpeg';

  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < minSize) {
    return file;
  }

  if (typeof document === 'undefined') {
    return file;
  }

  try {
    const image = await decodeImage(file);
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const longestSide = Math.max(sourceWidth, sourceHeight);
    const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);
    if ('close' in image && typeof image.close === 'function') {
      image.close();
    }

    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], getCompressedFileName(file.name, mimeType), {
      type: mimeType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}
