export type DisplayOverlayWindowOptions = {
  acceptFirstMouse?: boolean;
  enableLargerThanScreen?: boolean;
  roundedCorners?: boolean;
};

export function getDisplayOverlayWindowOptions(platform: string): DisplayOverlayWindowOptions {
  return platform === 'darwin'
    ? {
        acceptFirstMouse: true,
        enableLargerThanScreen: true,
        roundedCorners: false,
      }
    : {};
}
