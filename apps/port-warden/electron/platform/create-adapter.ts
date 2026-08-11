import type { PlatformPortAdapter } from './adapter';
import { MacOsPortAdapter } from './macos/adapter';
import { WindowsPortAdapter } from './windows/adapter';

export function createPlatformAdapter(
  platform = process.platform,
): PlatformPortAdapter | undefined {
  if (platform === 'darwin') return new MacOsPortAdapter();
  if (platform === 'win32') return new WindowsPortAdapter();
  return undefined;
}
