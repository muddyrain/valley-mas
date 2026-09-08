let cached: { url: string; image: Promise<HTMLImageElement> } | undefined;

// The selection and editor live in one renderer. Retain only its current frame.
export function loadScreenshotImage(url: string): Promise<HTMLImageElement> {
  if (cached?.url === url) return cached.image;
  const pending = (async () => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.alt = '';
    image.draggable = false;
    image.className = 'screenshot-frozen-frame';
    image.src = url;
    await image.decode();
    return image;
  })().catch((error: unknown) => {
    if (cached?.url === url) cached = undefined;
    throw error;
  });
  cached = { url, image: pending };
  return pending;
}
