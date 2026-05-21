export type CameraWorldSize = {
  width: number;
  height: number;
};

export type CameraViewportSize = {
  width: number;
  height: number;
};

export type CameraCenterState = {
  centerX: number;
  centerY: number;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
};

export type CameraViewSizeState = Omit<CameraCenterState, 'centerX' | 'centerY'>;

export type CameraMotionState = {
  velocityX: number;
  velocityY: number;
};

export type CameraMotionInput = {
  directionX: number;
  directionY: number;
  speed: number;
  deltaSeconds: number;
  acceleration: number;
  deceleration: number;
};

export type CameraZoomAnchorInput = {
  centerX: number;
  centerY: number;
  screenX: number;
  screenY: number;
  viewportWidth: number;
  viewportHeight: number;
  currentZoom: number;
  nextZoom: number;
};

export type CameraViewportFromCenterInput = {
  centerX: number;
  centerY: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type CameraViewportPanSpeedInput = {
  viewportWidth: number;
  viewportHeight: number;
  viewportFractionPerSecond: number;
};

export type CameraDetailLevel = 'overview' | 'regional' | 'local';

export function getCoverZoom(
  viewport: CameraViewportSize,
  world: CameraWorldSize,
  maxZoom: number,
) {
  const zoomToCoverWidth = viewport.width / world.width;
  const zoomToCoverHeight = viewport.height / world.height;

  return Math.min(maxZoom, Math.max(zoomToCoverWidth, zoomToCoverHeight));
}

export function getContainZoom(
  viewport: CameraViewportSize,
  world: CameraWorldSize,
  maxZoom: number,
) {
  const zoomToFitWidth = viewport.width / world.width;
  const zoomToFitHeight = viewport.height / world.height;

  return Math.min(maxZoom, Math.min(zoomToFitWidth, zoomToFitHeight));
}

export function centerCameraView(state: CameraViewSizeState) {
  return {
    centerX: state.worldWidth / 2,
    centerY: state.worldHeight / 2,
  };
}

export function clampCameraCenter(state: CameraCenterState) {
  return {
    centerX: clampCenterAxis(state.centerX, state.viewportWidth, state.worldWidth),
    centerY: clampCenterAxis(state.centerY, state.viewportHeight, state.worldHeight),
  };
}

export function getAnchoredZoomCenter(input: CameraZoomAnchorInput) {
  const screenOffsetX = input.screenX - input.viewportWidth / 2;
  const screenOffsetY = input.screenY - input.viewportHeight / 2;
  const anchoredWorldX = input.centerX + screenOffsetX / input.currentZoom;
  const anchoredWorldY = input.centerY + screenOffsetY / input.currentZoom;

  return {
    centerX: anchoredWorldX - screenOffsetX / input.nextZoom,
    centerY: anchoredWorldY - screenOffsetY / input.nextZoom,
  };
}

export function getCameraViewportFromCenter(input: CameraViewportFromCenterInput) {
  return {
    x: input.centerX - input.viewportWidth / 2,
    y: input.centerY - input.viewportHeight / 2,
    width: input.viewportWidth,
    height: input.viewportHeight,
  };
}

export function getViewportRelativePanSpeed(input: CameraViewportPanSpeedInput) {
  return Math.max(input.viewportWidth, input.viewportHeight) * input.viewportFractionPerSecond;
}

export function getCameraDetailLevel(zoom: number): CameraDetailLevel {
  if (zoom < 0.85) {
    return 'overview';
  }

  if (zoom < 1.35) {
    return 'regional';
  }

  return 'local';
}

export function stepCameraMotion(state: CameraMotionState, input: CameraMotionInput) {
  const length = Math.hypot(input.directionX, input.directionY);
  const hasInput = length > 0;
  const targetVelocityX = hasInput ? (input.directionX / length) * input.speed : 0;
  const targetVelocityY = hasInput ? (input.directionY / length) * input.speed : 0;
  const rate = hasInput ? input.acceleration : input.deceleration;
  const mix = 1 - Math.exp(-rate * input.deltaSeconds);
  const velocityX = lerp(state.velocityX, targetVelocityX, mix);
  const velocityY = lerp(state.velocityY, targetVelocityY, mix);

  return {
    velocityX: Math.abs(velocityX) < 0.01 ? 0 : velocityX,
    velocityY: Math.abs(velocityY) < 0.01 ? 0 : velocityY,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampCenterAxis(center: number, viewportSize: number, worldSize: number) {
  if (viewportSize >= worldSize) {
    return worldSize / 2;
  }

  return clamp(center, viewportSize / 2, worldSize - viewportSize / 2);
}

function lerp(from: number, to: number, mix: number) {
  return from + (to - from) * clamp(mix, 0, 1);
}
