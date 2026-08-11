export type WindowContentRole = 'settings' | 'capture-overlay' | 'pinned-screenshot';

export function shouldProtectWindowContent(role: WindowContentRole): boolean {
  return role === 'capture-overlay';
}
