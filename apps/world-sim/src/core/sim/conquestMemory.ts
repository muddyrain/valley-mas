import type { Tick } from '@/shared/types';
import type { SimPatch } from './types';

export const RECENT_CONQUEST_TICK_WINDOW = 50;

export type RecentConquestMemory = ReadonlyMap<number, Tick>;

export function applyRecentConquestPatches(input: {
  previous: RecentConquestMemory;
  patches: readonly SimPatch[];
  currentTick: Tick;
  window?: number;
}): Map<number, Tick> {
  const next = new Map(input.previous);
  for (const patch of input.patches) {
    const id = patch.regionId as unknown as number;
    if (patch.toOwnerId == null) {
      next.delete(id);
    } else {
      next.set(id, patch.tick ?? input.currentTick);
    }
  }
  return pruneRecentConquests(next, input.currentTick, input.window);
}

export function pruneRecentConquests(
  memory: RecentConquestMemory,
  currentTick: Tick,
  window = RECENT_CONQUEST_TICK_WINDOW,
): Map<number, Tick> {
  const now = currentTick as unknown as number;
  const next = new Map<number, Tick>();
  for (const [regionId, tick] of memory) {
    if (isRecentConquestTick(tick, currentTick, window)) {
      next.set(regionId, tick);
    } else if ((tick as unknown as number) > now) {
      next.set(regionId, tick);
    }
  }
  return next;
}

export function isRecentConquestTick(
  conqueredTick: Tick | null | undefined,
  currentTick: Tick,
  window = RECENT_CONQUEST_TICK_WINDOW,
): boolean {
  if (conqueredTick == null) return false;
  const age = (currentTick as unknown as number) - (conqueredTick as unknown as number);
  return age >= 0 && age <= window;
}
