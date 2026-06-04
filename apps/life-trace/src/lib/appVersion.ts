const FALLBACK_VERSION = '0.0.0';
const FALLBACK_BUILD_ID = 'local';

export function normalizeVersion(value: string | undefined) {
  const version = value?.trim().replace(/^v/i, '');
  return version || FALLBACK_VERSION;
}

export function normalizeBuildId(value: string | undefined) {
  const buildId = value?.trim();
  return buildId || FALLBACK_BUILD_ID;
}

export function formatAppVersion(version: string | undefined, buildId: string | undefined) {
  return `v${normalizeVersion(version)}+${normalizeBuildId(buildId)}`;
}

export const APP_VERSION_LABEL = formatAppVersion(
  import.meta.env.VITE_APP_VERSION,
  import.meta.env.VITE_APP_BUILD_ID,
);
