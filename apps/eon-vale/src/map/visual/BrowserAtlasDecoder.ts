import type { AtlasDecoder, DecodedAtlasPage } from './VisualCatalog';

export const decodeAtlasInBrowser: AtlasDecoder = async (source): Promise<DecodedAtlasPage> => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Atlas request failed with status ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context === null) throw new Error('Unable to create atlas validation canvas');
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, pixels: image.data };
  } finally {
    bitmap.close();
  }
};
