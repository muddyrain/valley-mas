export type DisplayOverlayWindowOptions = {
  acceptFirstMouse?: boolean;
  enableLargerThanScreen?: boolean;
  roundedCorners?: boolean;
};

export type AlwaysOnTopRole = 'capture-overlay' | 'pinned-screenshot';

export function getAlwaysOnTopRelativeLevel(role: AlwaysOnTopRole): number {
  return role === 'capture-overlay' ? 2 : 0;
}

export function getDisplayOverlayWindowOptions(platform: string): DisplayOverlayWindowOptions {
  return platform === 'darwin'
    ? {
        acceptFirstMouse: true,
        enableLargerThanScreen: true,
        roundedCorners: false,
      }
    : {};
}
