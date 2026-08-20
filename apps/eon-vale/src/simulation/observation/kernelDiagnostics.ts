import type { SimulationKernel } from '../kernel/kernel';
import type { KernelPhaseId } from '../kernel/phases';

export interface KernelDiagnosticFrame {
  tick: number;
  checksum: string;
  paused: boolean;
  size: number;
  preset: string;
  humans: number;
  activeResources: number;
  settleableRegions: number;
  repairs: number;
  phases: KernelPhaseId[];
  invariantErrors: string[];
}

export function createKernelDiagnosticFrame(kernel: SimulationKernel): KernelDiagnosticFrame {
  let activeResources = 0;
  for (let id = 0; id < kernel.state.resources.count; id += 1) {
    if (kernel.state.resources.active[id]) activeResources += 1;
  }
  return {
    tick: kernel.state.tick,
    checksum: kernel.checksum(),
    paused: kernel.state.paused,
    size: kernel.state.world.size,
    preset: kernel.state.world.preset,
    humans: kernel.state.civilization.humans,
    activeResources,
    settleableRegions: kernel.state.world.settleability.regions.length,
    repairs: kernel.state.world.settleability.repairs.length,
    phases: [...kernel.state.diagnostics.lastPhaseTrace],
    invariantErrors: [...kernel.state.diagnostics.invariantErrors],
  };
}
