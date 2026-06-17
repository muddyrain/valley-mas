export function formatCountdown(targetISO: string, nowMs = Date.now()): string {
  const target = new Date(targetISO).getTime();
  if (!Number.isFinite(target) || target <= 0) return '已成熟';
  const diff = target - nowMs;
  if (diff <= 0) return '马上发生';
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
