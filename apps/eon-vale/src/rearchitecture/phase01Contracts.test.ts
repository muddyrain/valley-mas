import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { residentHandItem } from '@/render/residentPresentation';
import { observationFactTotal } from '@/render/strategicView';
import { Profession } from '@/shared/gameTypes';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import { KERNEL_PHASES } from '@/simulation/kernel/phases';
import { createKernelDiagnosticFrame } from '@/simulation/observation/kernelDiagnostics';
import { NaturalResourceKind } from '@/simulation/resources/naturalResources';
import { ElevationBand, elevationBandAt, type SurfaceHabitat } from '@/simulation/world/worldFacts';
import {
  projectKernelMap,
  projectKernelResources,
  projectKernelSnapshot,
} from '@/worker/kernelCompatibilityProjection';

describe('phase 0 failure evidence', () => {
  it('does not infer a guard weapon when no weapon is equipped', () => {
    expect(residentHandItem(Profession.Guard, 0)).toBe('none');
    expect(residentHandItem(Profession.Guard, 1)).toBe('weapon');
  });

  it('keeps authoritative totals continuous across observation levels', () => {
    expect(observationFactTotal('resident', 97)).toBe(97);
    expect(observationFactTotal('settlement', 97)).toBe(97);
    expect(observationFactTotal('world', 97)).toBe(97);
  });
});

describe('phase 1 kernel and world facts', () => {
  it('runs every fixed tick in the accepted phase order', () => {
    const kernel = createSimulationKernel({ seed: 'phase-order', size: 128 });
    kernel.setPaused(false);
    const report = kernel.step();

    expect(report.advanced).toBe(true);
    expect(report.phases).toEqual(KERNEL_PHASES.map((phase) => phase.id));
    expect(kernel.state.tick).toBe(1);
  });

  it('orders command envelopes by sequence before the command boundary commits', () => {
    const kernel = createSimulationKernel({ seed: 'command-order', size: 128 });
    kernel.enqueue({ type: 'set-paused', sequence: 2, paused: false });
    kernel.enqueue({ type: 'set-paused', sequence: 1, paused: true });

    const report = kernel.step();

    expect(report.advanced).toBe(true);
    expect(kernel.state.commands.records.map((record) => record.sequence)).toEqual([1, 2]);
    expect(kernel.state.commands.records.every((record) => record.status === 'accepted')).toBe(
      true,
    );
  });

  it('makes playback rate orthogonal to authoritative tick results', () => {
    const normal = createSimulationKernel({ seed: 'rate-orthogonal', size: 128 });
    const accelerated = createSimulationKernel({ seed: 'rate-orthogonal', size: 128 });
    normal.setPlaybackRate(1);
    accelerated.setPlaybackRate(8);
    normal.setPaused(false);
    accelerated.setPaused(false);
    normal.runTicks(40);
    accelerated.runTicks(40);

    expect(normal.checksum()).toBe(accelerated.checksum());
    accelerated.setPaused(true);
    accelerated.runTicks(10);
    expect(accelerated.state.tick).toBe(40);
    expect(accelerated.playbackRate).toBe(8);
  });

  it.each([
    [128, 2],
    [256, 4],
    [384, 6],
  ] as const)('creates a replayable %i world with %i settleable regions', (size, minimum) => {
    const first = createSimulationKernel({ seed: `settleable-${size}`, size });
    const second = createSimulationKernel({ seed: `settleable-${size}`, size });

    expect(first.state.civilization.humans).toBe(0);
    expect(first.state.paused).toBe(true);
    expect(first.state.world.settleability.regions.length).toBeGreaterThanOrEqual(minimum);
    expect(first.checksum()).toBe(second.checksum());
  });

  it('keeps blank ocean empty even when natural content switches are enabled', () => {
    const kernel = createSimulationKernel({
      seed: 'blank-ocean',
      size: 128,
      preset: 'ocean',
      naturalContent: { vegetation: true, resources: true, animals: true },
    });

    expect(kernel.state.world.settleability.regions).toHaveLength(0);
    expect(kernel.state.resources.count).toBe(0);
    expect(Array.from(kernel.state.world.elevation).every((value) => value < 0)).toBe(true);
  });

  it('stores elevation and surface habitat independently through flooding and recovery', () => {
    const kernel = createSimulationKernel({ seed: 'terrain-causality', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell;
    expect(cell).toBeTypeOf('number');
    if (cell === undefined) return;
    const habitat = kernel.state.world.surface[cell] as SurfaceHabitat;

    kernel.enqueue({ type: 'lower-terrain', sequence: 1, cell, amount: 12 });
    kernel.flushCommands();
    expect(elevationBandAt(kernel.state.world.elevation[cell] ?? 0)).toBe(ElevationBand.DeepOcean);
    expect(kernel.state.world.surface[cell]).toBe(habitat);

    kernel.enqueue({ type: 'raise-terrain', sequence: 2, cell, amount: 12 });
    kernel.flushCommands();
    expect(elevationBandAt(kernel.state.world.elevation[cell] ?? 0)).not.toBe(
      ElevationBand.DeepOcean,
    );
    expect(kernel.state.world.surface[cell]).toBe(habitat);
  });

  it('creates independent natural facts without settlement inventory', () => {
    const kernel = createSimulationKernel({ seed: 'natural-facts', size: 128 });
    const kinds = Array.from(kernel.state.resources.kind.slice(0, kernel.state.resources.count));
    const treeCells = Array.from(
      kernel.state.resources.cell.slice(0, kernel.state.resources.count),
    ).filter((_, id) => kinds[id] === NaturalResourceKind.Tree);

    expect(new Set(kinds)).toEqual(
      new Set([
        NaturalResourceKind.Tree,
        NaturalResourceKind.WildFood,
        NaturalResourceKind.Stone,
        NaturalResourceKind.Metal,
      ]),
    );
    expect(new Set(treeCells).size).toBe(treeCells.length);
    expect(kernel.state.civilization.settlementInventories).toHaveLength(0);
  });

  it('projects the new authority into the retained Pixi shell and a diagnostic frame', () => {
    const kernel = createSimulationKernel({ seed: 'projection-shell', size: 128 });
    const map = projectKernelMap(kernel);
    const resources = projectKernelResources(kernel);
    const snapshot = projectKernelSnapshot(kernel, { tickMs: 0, averageTickMs: 0 });
    const diagnostic = createKernelDiagnosticFrame(kernel);

    expect(map.size).toBe(128);
    expect(map.terrain).toHaveLength(128 * 128);
    expect(resources.count).toBe(kernel.state.resources.count);
    expect(snapshot.stats).toMatchObject({ humans: 0, villages: 0, kingdoms: 0 });
    expect(diagnostic).toMatchObject({ humans: 0, paused: true, size: 128 });
    expect(diagnostic.invariantErrors).toEqual([]);
  });

  it('starts the product Worker from the new kernel without legacy core imports', () => {
    const clientSource = readFileSync(
      new URL('../worker/SimulationWorkerClient.ts', import.meta.url),
      'utf8',
    );
    const workerSource = readFileSync(
      new URL('../worker/kernel.worker.ts', import.meta.url),
      'utf8',
    );

    expect(clientSource).toContain("new URL('./kernel.worker.ts'");
    expect(workerSource).toContain('createSimulationKernel');
    expect(workerSource).not.toContain('worldSimulation');
    expect(workerSource).not.toContain('prototypeSimulation');
  });
});
