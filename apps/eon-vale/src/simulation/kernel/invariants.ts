import { ElevationBand, elevationBandAt } from '../world/worldFacts';
import type { KernelWorldRoot } from './worldRoot';

export function validateKernelInvariants(state: KernelWorldRoot): string[] {
  const errors: string[] = [];
  const cellCount = state.world.size * state.world.size;
  if (state.world.elevation.length !== cellCount) errors.push('world.elevation length mismatch');
  if (state.world.surface.length !== cellCount) errors.push('world.surface length mismatch');
  if (state.world.moisture.length !== cellCount) errors.push('world.moisture length mismatch');
  if (state.world.temperature.length !== cellCount)
    errors.push('world.temperature length mismatch');
  if (state.resources.cellToResource.length !== cellCount)
    errors.push('resources.cellToResource length mismatch');
  const occupied = new Set<number>();
  for (let id = 0; id < state.resources.count; id += 1) {
    if (!state.resources.active[id]) continue;
    const cell = state.resources.cell[id] ?? cellCount;
    if (cell >= cellCount) errors.push(`resource ${id} outside world`);
    if (occupied.has(cell)) errors.push(`multiple resources occupy cell ${cell}`);
    occupied.add(cell);
    const band = elevationBandAt(state.world.elevation[cell] ?? -4);
    if (band === ElevationBand.DeepOcean || band === ElevationBand.ShallowWater) {
      errors.push(`land resource ${id} is submerged`);
    }
  }
  if (state.world.preset === 'ocean' && occupied.size > 0) errors.push('blank ocean has resources');
  if (state.civilization.humans !== 0) errors.push('phase 1 world must not generate humans');
  return errors;
}
