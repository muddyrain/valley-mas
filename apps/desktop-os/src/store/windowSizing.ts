import { DESKTOP_APPS, type DesktopAppId } from '../apps/desktopApps';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowViewport {
  width: number;
  height: number;
}

export interface WindowSizingOptions {
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface WindowProfile {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  widthRatio: number;
  heightRatio: number;
}

export const MIN_WINDOW_WIDTH = 320;
export const MIN_WINDOW_HEIGHT = 200;
export const TOP_BAR_HEIGHT = 28;
export const DOCK_RESERVED_HEIGHT = 96;

const SAFE_MARGIN = 24;
const CASCADE_STEP = 28;

const LARGE_PROFILE: WindowProfile = {
  minWidth: 980,
  minHeight: 640,
  maxWidth: 1240,
  maxHeight: 820,
  widthRatio: 0.74,
  heightRatio: 0.76,
};

const MEDIUM_PROFILE: WindowProfile = {
  minWidth: 680,
  minHeight: 500,
  maxWidth: 920,
  maxHeight: 720,
  widthRatio: 0.58,
  heightRatio: 0.66,
};

const COMPACT_PROFILE: WindowProfile = {
  minWidth: 360,
  minHeight: 360,
  maxWidth: 560,
  maxHeight: 540,
  widthRatio: 0.38,
  heightRatio: 0.48,
};

const SQUARE_GAME_PROFILE: WindowProfile = {
  minWidth: 620,
  minHeight: 560,
  maxWidth: 760,
  maxHeight: 720,
  widthRatio: 0.5,
  heightRatio: 0.66,
};

const APP_WINDOW_PROFILES: Partial<Record<DesktopAppId, WindowProfile>> = {
  finder: LARGE_PROFILE,
  safari: LARGE_PROFILE,
  calendar: LARGE_PROFILE,
  music: LARGE_PROFILE,
  weather: LARGE_PROFILE,
  settings: MEDIUM_PROFILE,
  downloads: MEDIUM_PROFILE,
  notes: MEDIUM_PROFILE,
  deskTidy: SQUARE_GAME_PROFILE,
  plushMatch: SQUARE_GAME_PROFILE,
  about: COMPACT_PROFILE,
  account: COMPACT_PROFILE,
  calculator: COMPACT_PROFILE,
  clipboard: COMPACT_PROFILE,
  converter: COMPACT_PROFILE,
  focus: COMPACT_PROFILE,
  palette: COMPACT_PROFILE,
  randomizer: COMPACT_PROFILE,
  stopwatch: COMPACT_PROFILE,
  textLab: COMPACT_PROFILE,
  beadSort: SQUARE_GAME_PROFILE,
  plushGarden: COMPACT_PROFILE,
  cloudBounce: SQUARE_GAME_PROFILE,
};

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function getAvailableSize(viewport: WindowViewport) {
  return {
    width: Math.max(MIN_WINDOW_WIDTH, viewport.width - SAFE_MARGIN * 2),
    height: Math.max(
      MIN_WINDOW_HEIGHT,
      viewport.height - TOP_BAR_HEIGHT - DOCK_RESERVED_HEIGHT - SAFE_MARGIN,
    ),
  };
}

function isDefaultAppSize(appId: DesktopAppId, options: WindowSizingOptions) {
  const app = DESKTOP_APPS[appId];
  const widthIsDefault = options.width == null || options.width === app.width;
  const heightIsDefault = options.height == null || options.height === app.height;
  return widthIsDefault && heightIsDefault;
}

function resolveSize(
  appId: DesktopAppId,
  options: WindowSizingOptions,
  viewport: WindowViewport,
  rememberedRect?: WindowRect,
) {
  const app = DESKTOP_APPS[appId];
  const profile = APP_WINDOW_PROFILES[appId] ?? MEDIUM_PROFILE;
  const available = getAvailableSize(viewport);
  const useResponsiveProfile = isDefaultAppSize(appId, options);

  const profiledWidth = clamp(
    Math.round(viewport.width * profile.widthRatio),
    profile.minWidth,
    profile.maxWidth,
  );
  const profiledHeight = clamp(
    Math.round(viewport.height * profile.heightRatio),
    profile.minHeight,
    profile.maxHeight,
  );

  const width = useResponsiveProfile
    ? (rememberedRect?.width ?? profiledWidth)
    : (options.width ?? app.width);
  const height = useResponsiveProfile
    ? (rememberedRect?.height ?? profiledHeight)
    : (options.height ?? app.height);

  return {
    width: clamp(width, MIN_WINDOW_WIDTH, available.width),
    height: clamp(height, MIN_WINDOW_HEIGHT, available.height),
  };
}

export function clampWindowRect(rect: WindowRect, viewport: WindowViewport): WindowRect {
  const available = getAvailableSize(viewport);
  const width = clamp(rect.width, MIN_WINDOW_WIDTH, available.width);
  const height = clamp(rect.height, MIN_WINDOW_HEIGHT, available.height);
  const minX = SAFE_MARGIN;
  const maxX = Math.max(minX, viewport.width - width - SAFE_MARGIN);
  const minY = TOP_BAR_HEIGHT + SAFE_MARGIN;
  const maxY = Math.max(minY, viewport.height - DOCK_RESERVED_HEIGHT - height);

  return {
    x: clamp(rect.x, minX, maxX),
    y: clamp(rect.y, minY, maxY),
    width,
    height,
  };
}

export function resolveOpenWindowRect(
  appId: DesktopAppId,
  options: WindowSizingOptions,
  viewport: WindowViewport,
  sameAppWindowCount: number,
  rememberedRect?: WindowRect,
) {
  const { width, height } = resolveSize(appId, options, viewport, rememberedRect);
  const cascadeOffset = sameAppWindowCount * CASCADE_STEP;
  const rememberedX = rememberedRect ? rememberedRect.x + cascadeOffset : undefined;
  const rememberedY = rememberedRect ? rememberedRect.y + cascadeOffset : undefined;
  const centeredX = (viewport.width - width) / 2 + cascadeOffset;
  const centeredY =
    TOP_BAR_HEIGHT + (viewport.height - TOP_BAR_HEIGHT - DOCK_RESERVED_HEIGHT - height) / 2;

  return clampWindowRect(
    {
      x: options.x ?? rememberedX ?? centeredX,
      y: options.y ?? rememberedY ?? centeredY + cascadeOffset,
      width,
      height,
    },
    viewport,
  );
}
