export type PhotoFilter = 'natural' | 'warm' | 'cool' | 'cinematic';

export interface PhotoModeState {
  enabled: boolean;
  grid: boolean;
  depthOfField: boolean;
  filter: PhotoFilter;
}

export const DEFAULT_PHOTO_MODE_STATE: Readonly<PhotoModeState> = Object.freeze({
  enabled: false,
  grid: false,
  depthOfField: false,
  filter: 'natural',
});

export function setPhotoModeEnabled(
  state: Readonly<PhotoModeState>,
  enabled: boolean,
): PhotoModeState {
  return { ...state, enabled };
}

export function updatePhotoModeSettings(
  state: Readonly<PhotoModeState>,
  changes: Partial<Omit<PhotoModeState, 'enabled'>>,
): PhotoModeState {
  return { ...state, ...changes };
}

export function getPhotoFilterStyle(filter: PhotoFilter): string {
  if (filter === 'warm') return 'sepia(0.2) saturate(1.14) contrast(1.04)';
  if (filter === 'cool') return 'hue-rotate(8deg) saturate(0.92) contrast(1.06)';
  if (filter === 'cinematic') return 'contrast(1.16) saturate(0.78) brightness(0.94)';
  return 'none';
}
