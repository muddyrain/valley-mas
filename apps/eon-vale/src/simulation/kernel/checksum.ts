import type { KernelWorldRoot } from './worldRoot';

function hashNumber(hash: number, value: number): number {
  hash ^= value;
  return Math.imul(hash, 16_777_619);
}

function hashText(hash: number, value: string): number {
  let result = hash;
  for (let index = 0; index < value.length; index += 1) {
    result = hashNumber(result, value.charCodeAt(index));
  }
  return result;
}

export function kernelChecksum(state: KernelWorldRoot): string {
  let hash = hashText(2_166_136_261, state.seed);
  hash = hashNumber(hash, state.tick);
  hash = hashNumber(hash, state.paused ? 1 : 0);
  hash = hashNumber(hash, state.world.size);
  hash = hashText(hash, state.world.preset);
  for (let cell = 0; cell < state.world.elevation.length; cell += 1) {
    hash = hashNumber(hash, Math.round((state.world.elevation[cell] ?? 0) * 1_000));
    hash = hashNumber(hash, state.world.surface[cell] ?? 0);
  }
  for (let id = 0; id < state.resources.count; id += 1) {
    hash = hashNumber(hash, state.resources.active[id] ?? 0);
    hash = hashNumber(hash, state.resources.kind[id] ?? 0);
    hash = hashNumber(hash, state.resources.cell[id] ?? 0);
    hash = hashNumber(hash, state.resources.amount[id] ?? 0);
    hash = hashNumber(hash, state.resources.stage[id] ?? 0);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
