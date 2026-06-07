export type PhotoItemBarcodeSource = 'native' | 'manual';

export type PhotoItemBarcodeResult = {
  value: string;
  format: string;
  source: PhotoItemBarcodeSource;
};

type BarcodeDetection = {
  rawValue?: string;
  format?: string;
};

type BarcodeDetectorLike = {
  detect: (source: unknown) => Promise<BarcodeDetection[]>;
};

type BarcodeDetectorConstructorLike = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

type ScanPhotoItemBarcodeOptions = {
  source: unknown;
  BarcodeDetector?: BarcodeDetectorConstructorLike;
};

const preferredBarcodeFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'];

export function normalizePhotoItemBarcodeFormat(format?: string) {
  const normalized = format?.trim().toLowerCase().replace(/-/g, '_') ?? '';
  return preferredBarcodeFormats.includes(normalized) ? normalized : normalized || 'unknown';
}

function normalizePhotoItemBarcodeValue(value?: string) {
  return value?.trim().replace(/\s+/g, '') ?? '';
}

export function getManualPhotoItemBarcode(
  value: string,
  format = 'unknown',
): PhotoItemBarcodeResult | null {
  const normalizedValue = normalizePhotoItemBarcodeValue(value);
  if (!normalizedValue) {
    return null;
  }
  return {
    value: normalizedValue,
    format: normalizePhotoItemBarcodeFormat(format),
    source: 'manual',
  };
}

export async function scanPhotoItemBarcodeFromImage({
  source,
  BarcodeDetector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructorLike })
    .BarcodeDetector,
}: ScanPhotoItemBarcodeOptions): Promise<PhotoItemBarcodeResult | null> {
  if (!BarcodeDetector) {
    return null;
  }

  const supportedFormats = BarcodeDetector.getSupportedFormats
    ? await BarcodeDetector.getSupportedFormats()
    : preferredBarcodeFormats;
  const formats = preferredBarcodeFormats.filter((format) => supportedFormats.includes(format));
  const detector = new BarcodeDetector({ formats: formats.length > 0 ? formats : undefined });
  const detections = await detector.detect(source);
  const detection = detections.find((item) => normalizePhotoItemBarcodeValue(item.rawValue));
  if (!detection) {
    return null;
  }

  return {
    value: normalizePhotoItemBarcodeValue(detection.rawValue),
    format: normalizePhotoItemBarcodeFormat(detection.format),
    source: 'native',
  };
}

export async function scanPhotoItemBarcodeFromFile(file: File) {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  const bitmap = await createImageBitmap(file);
  try {
    return await scanPhotoItemBarcodeFromImage({ source: bitmap });
  } finally {
    bitmap.close();
  }
}
