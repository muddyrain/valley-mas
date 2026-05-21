export type CameraWorldSize = {
  width: number;
  height: number;
};

export type CameraViewportSize = {
  width: number;
  height: number;
};

export type CameraViewState = {
  scrollX: number;
  scrollY: number;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
};

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

export function centerCameraScroll(state: CameraViewState) {
  const offsetX = getScrollToWorldViewOffset(state.screenWidth, state.viewportWidth);
  const offsetY = getScrollToWorldViewOffset(state.screenHeight, state.viewportHeight);

  return {
    scrollX: (state.worldWidth - state.viewportWidth) / 2 + offsetX,
    scrollY: (state.worldHeight - state.viewportHeight) / 2 + offsetY,
  };
}

export function clampCameraScroll(state: CameraViewState) {
  const minViewX =
    state.viewportWidth > state.worldWidth ? (state.worldWidth - state.viewportWidth) / 2 : 0;
  const minViewY =
    state.viewportHeight > state.worldHeight ? (state.worldHeight - state.viewportHeight) / 2 : 0;
  const maxViewX =
    state.viewportWidth > state.worldWidth ? minViewX : state.worldWidth - state.viewportWidth;
  const maxViewY =
    state.viewportHeight > state.worldHeight ? minViewY : state.worldHeight - state.viewportHeight;
  const offsetX = getScrollToWorldViewOffset(state.screenWidth, state.viewportWidth);
  const offsetY = getScrollToWorldViewOffset(state.screenHeight, state.viewportHeight);
  const worldViewX = getWorldViewPosition(state.scrollX, state.screenWidth, state.viewportWidth);
  const worldViewY = getWorldViewPosition(state.scrollY, state.screenHeight, state.viewportHeight);

  return {
    scrollX: clamp(worldViewX, minViewX, maxViewX) + offsetX,
    scrollY: clamp(worldViewY, minViewY, maxViewY) + offsetY,
  };
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

function getWorldViewPosition(scroll: number, screenSize: number, viewportSize: number) {
  return scroll + screenSize / 2 - viewportSize / 2;
}

function getScrollToWorldViewOffset(screenSize: number, viewportSize: number) {
  return viewportSize / 2 - screenSize / 2;
}

function lerp(from: number, to: number, mix: number) {
  return from + (to - from) * clamp(mix, 0, 1);
}
