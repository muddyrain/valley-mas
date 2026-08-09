export interface ImageSize {
  width: number;
  height: number;
}

export interface CropRect extends ImageSize {
  x: number;
  y: number;
}

export type CropHandle =
  | 'move'
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

const DEFAULT_INSET_SCALE = 0.8;
const DEFAULT_MIN_CROP_SIZE = 16;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundRect(rect: CropRect): CropRect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

export function createInsetCrop(bounds: ImageSize, aspectRatio?: number): CropRect {
  const maximumWidth = Math.max(1, bounds.width * DEFAULT_INSET_SCALE);
  const maximumHeight = Math.max(1, bounds.height * DEFAULT_INSET_SCALE);
  let width = maximumWidth;
  let height = maximumHeight;

  if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    if (width / height > aspectRatio) {
      width = height * aspectRatio;
    } else {
      height = width / aspectRatio;
    }
  }

  const roundedWidth = Math.max(1, Math.round(width));
  const roundedHeight = Math.max(1, Math.round(height));
  return {
    x: Math.round((bounds.width - roundedWidth) / 2),
    y: Math.round((bounds.height - roundedHeight) / 2),
    width: roundedWidth,
    height: roundedHeight,
  };
}

export function moveCropRect(
  crop: CropRect,
  deltaX: number,
  deltaY: number,
  bounds: ImageSize,
): CropRect {
  return roundRect({
    ...crop,
    x: clamp(crop.x + deltaX, 0, Math.max(0, bounds.width - crop.width)),
    y: clamp(crop.y + deltaY, 0, Math.max(0, bounds.height - crop.height)),
  });
}

export function resizeCropRect(
  crop: CropRect,
  handle: Exclude<CropHandle, 'move'>,
  deltaX: number,
  deltaY: number,
  bounds: ImageSize,
  minimumSize = DEFAULT_MIN_CROP_SIZE,
): CropRect {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;
  const changesNorth = handle.includes('north');
  const changesSouth = handle.includes('south');
  const changesWest = handle.includes('west');
  const changesEast = handle.includes('east');

  if (changesWest) left = clamp(left + deltaX, 0, right - minimumSize);
  if (changesEast) right = clamp(right + deltaX, left + minimumSize, bounds.width);
  if (changesNorth) top = clamp(top + deltaY, 0, bottom - minimumSize);
  if (changesSouth) bottom = clamp(bottom + deltaY, top + minimumSize, bounds.height);

  return roundRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}
