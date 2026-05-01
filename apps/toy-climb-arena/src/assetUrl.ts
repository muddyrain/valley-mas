export function toRuntimeAssetUrl(rawUrl: string, moduleMetaUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
  if (rawUrl.startsWith('/')) return rawUrl;
  try {
    return new URL(rawUrl, moduleMetaUrl).href;
  } catch {
    return rawUrl;
  }
}
