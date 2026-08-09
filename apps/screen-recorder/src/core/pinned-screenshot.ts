import type { Rectangle } from './geometry';

export function getPinnedScreenshotBounds(
  image: { width: number; height: number },
  workArea: Rectangle,
): Rectangle {
  if (image.width < 1 || image.height < 1 || workArea.width < 1 || workArea.height < 1) {
    throw new Error('固定图片尺寸无效');
  }
  const scale = Math.min(
    1,
    (workArea.width * 0.575) / image.width,
    (workArea.height * 0.75) / image.height,
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
}

export function getPinnedScreenshotWindowBounds(
  image: { width: number; height: number },
  workArea: Rectangle,
  inset: number,
): { image: Rectangle; window: Rectangle } {
  if (!Number.isFinite(inset) || inset < 0) throw new Error('固定图片边距无效');
  const imageBounds = getPinnedScreenshotBounds(image, workArea);
  return {
    image: imageBounds,
    window: {
      x: imageBounds.x - inset,
      y: imageBounds.y - inset,
      width: imageBounds.width + inset * 2,
      height: imageBounds.height + inset * 2,
    },
  };
}
