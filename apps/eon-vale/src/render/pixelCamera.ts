export const PIXEL_ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16] as const;
export const WORLD_PIXELS_PER_CELL = 4;

export function terrainSourcePixels(zoom: number): 1 | 4 {
  return zoom < 1 ? 1 : 4;
}

export interface PixelCamera {
  mapSize: number;
  zoom: number;
  centerX: number;
  centerZ: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export function createPixelCamera(
  mapSize: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): PixelCamera {
  return clampPixelCamera({
    mapSize,
    zoom: nearestPixelZoom(zoom),
    centerX: mapSize / 2,
    centerZ: mapSize / 2,
    viewportWidth,
    viewportHeight,
  });
}

export function nearestPixelZoom(value: number): number {
  return PIXEL_ZOOM_STEPS.reduce((nearest, candidate) =>
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest,
  );
}

export function zoomStep(current: number, direction: -1 | 0 | 1): number {
  const index = PIXEL_ZOOM_STEPS.indexOf(
    nearestPixelZoom(current) as (typeof PIXEL_ZOOM_STEPS)[number],
  );
  return (
    PIXEL_ZOOM_STEPS[Math.max(0, Math.min(PIXEL_ZOOM_STEPS.length - 1, index + direction))] ?? 1
  );
}

export function screenToWorldCell(
  camera: PixelCamera,
  screenX: number,
  screenY: number,
): WorldPoint {
  const scale = WORLD_PIXELS_PER_CELL * camera.zoom;
  return {
    x: camera.centerX + (screenX - camera.viewportWidth / 2) / scale,
    z: camera.centerZ + (screenY - camera.viewportHeight / 2) / scale,
  };
}

export function worldToScreen(camera: PixelCamera, x: number, z: number): { x: number; y: number } {
  const scale = WORLD_PIXELS_PER_CELL * camera.zoom;
  return {
    x: camera.viewportWidth / 2 + (x - camera.centerX) * scale,
    y: camera.viewportHeight / 2 + (z - camera.centerZ) * scale,
  };
}

export function zoomCameraAt(
  camera: PixelCamera,
  screenX: number,
  screenY: number,
  direction: -1 | 0 | 1,
): PixelCamera {
  const anchor = screenToWorldCell(camera, screenX, screenY);
  const zoom = zoomStep(camera.zoom, direction);
  const scale = WORLD_PIXELS_PER_CELL * zoom;
  return clampPixelCamera({
    ...camera,
    zoom,
    centerX: anchor.x - (screenX - camera.viewportWidth / 2) / scale,
    centerZ: anchor.z - (screenY - camera.viewportHeight / 2) / scale,
  });
}

export function panPixelCamera(camera: PixelCamera, deltaX: number, deltaY: number): PixelCamera {
  const scale = WORLD_PIXELS_PER_CELL * camera.zoom;
  return clampPixelCamera({
    ...camera,
    centerX: camera.centerX - deltaX / scale,
    centerZ: camera.centerZ - deltaY / scale,
  });
}

export function resizePixelCamera(
  camera: PixelCamera,
  viewportWidth: number,
  viewportHeight: number,
): PixelCamera {
  return clampPixelCamera({ ...camera, viewportWidth, viewportHeight });
}

export function clampPixelCamera(camera: PixelCamera): PixelCamera {
  const clampAxis = (value: number) => Math.max(0, Math.min(camera.mapSize, value));
  return {
    ...camera,
    centerX: clampAxis(camera.centerX),
    centerZ: clampAxis(camera.centerZ),
  };
}
