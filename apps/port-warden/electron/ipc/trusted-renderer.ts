import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function isTrustedRendererUrl(
  rawUrl: string,
  isDevelopment: boolean,
  productionEntry: string,
) {
  try {
    const url = new URL(rawUrl);
    if (isDevelopment) return url.origin === 'http://127.0.0.1:5182';
    if (url.protocol !== 'file:') return false;
    return path.resolve(fileURLToPath(url)) === path.resolve(productionEntry);
  } catch {
    return false;
  }
}
