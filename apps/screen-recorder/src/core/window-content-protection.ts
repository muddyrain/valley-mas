export type WindowContentRole = 'settings' | 'capture-overlay';

export function shouldProtectWindowContent(role: WindowContentRole): boolean {
  return role === 'capture-overlay';
}
