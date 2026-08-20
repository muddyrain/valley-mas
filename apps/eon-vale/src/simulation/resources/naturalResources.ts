import { stableNoise } from '@/shared/random';
import {
  ElevationBand,
  elevationBandAt,
  type NaturalContentOptions,
  SurfaceHabitat,
  type WorldFacts,
} from '../world/worldFacts';

export enum NaturalResourceKind {
  Tree = 0,
  WildFood = 1,
  Stone = 2,
  Metal = 3,
}

export enum NaturalResourceStage {
  Sapling = 1,
  Mature = 3,
  Available = 4,
}

export enum NaturalResourceSource {
  Generated = 0,
  SettleabilityRepair = 1,
  Player = 2,
}

export interface NaturalResourceFact {
  kind: NaturalResourceKind;
  cell: number;
  amount: number;
  stage: NaturalResourceStage;
  source: NaturalResourceSource;
}

export interface NaturalResourceStore {
  count: number;
  active: Uint8Array;
  kind: Uint8Array;
  cell: Uint32Array;
  amount: Uint16Array;
  stage: Uint8Array;
  source: Uint8Array;
  cellToResource: Int32Array;
  revision: number;
  dirtyResourceIds: number[];
}

function resourceNoise(seed: string, cell: number, salt: number): number {
  let hash = 2_166_136_261;
  const text = `${seed}:${salt}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return stableNoise(hash ^ Math.imul(cell + 1, 0x45d9f3b));
}

export function generateNaturalResourceFacts(
  world: WorldFacts,
  seed: string,
  options: NaturalContentOptions,
): NaturalResourceFact[] {
  if (world.preset === 'ocean') return [];
  const facts: NaturalResourceFact[] = [];
  for (let cell = 0; cell < world.elevation.length; cell += 1) {
    if (elevationBandAt(world.elevation[cell] ?? -4) !== ElevationBand.Land) continue;
    const habitat = world.surface[cell] as SurfaceHabitat;
    const height = world.elevation[cell] ?? 0;
    if (
      options.vegetation &&
      habitat === SurfaceHabitat.WoodlandSoil &&
      resourceNoise(seed, cell, 11) > 0.64
    ) {
      facts.push({
        kind: NaturalResourceKind.Tree,
        cell,
        amount: 5,
        stage: NaturalResourceStage.Mature,
        source: NaturalResourceSource.Generated,
      });
      continue;
    }
    if (
      options.vegetation &&
      habitat !== SurfaceHabitat.Desert &&
      habitat !== SurfaceHabitat.Snow &&
      resourceNoise(seed, cell, 23) > 0.965
    ) {
      facts.push({
        kind: NaturalResourceKind.WildFood,
        cell,
        amount: 8,
        stage: NaturalResourceStage.Available,
        source: NaturalResourceSource.Generated,
      });
      continue;
    }
    if (options.resources && height > 0.35 && resourceNoise(seed, cell, 37) > 0.978) {
      facts.push({
        kind: NaturalResourceKind.Stone,
        cell,
        amount: 18,
        stage: NaturalResourceStage.Available,
        source: NaturalResourceSource.Generated,
      });
      continue;
    }
    if (options.resources && height > 0.6 && resourceNoise(seed, cell, 53) > 0.992) {
      facts.push({
        kind: NaturalResourceKind.Metal,
        cell,
        amount: 12,
        stage: NaturalResourceStage.Available,
        source: NaturalResourceSource.Generated,
      });
    }
  }
  return facts;
}

export function createNaturalResourceStore(
  facts: readonly NaturalResourceFact[],
  cellCount: number,
): NaturalResourceStore {
  const count = facts.length;
  const active = new Uint8Array(count);
  const kind = new Uint8Array(count);
  const cell = new Uint32Array(count);
  const amount = new Uint16Array(count);
  const stage = new Uint8Array(count);
  const source = new Uint8Array(count);
  const cellToResource = new Int32Array(cellCount);
  cellToResource.fill(-1);
  for (let id = 0; id < count; id += 1) {
    const fact = facts[id];
    if (!fact) continue;
    active[id] = 1;
    kind[id] = fact.kind;
    cell[id] = fact.cell;
    amount[id] = fact.amount;
    stage[id] = fact.stage;
    source[id] = fact.source;
    cellToResource[fact.cell] = id;
  }
  return {
    count,
    active,
    kind,
    cell,
    amount,
    stage,
    source,
    cellToResource,
    revision: 0,
    dirtyResourceIds: [],
  };
}

export function removeResourcesAtCell(store: NaturalResourceStore, cell: number): number[] {
  const id = store.cellToResource[cell] ?? -1;
  if (id < 0 || !store.active[id]) return [];
  store.active[id] = 0;
  store.cellToResource[cell] = -1;
  store.revision += 1;
  store.dirtyResourceIds.push(id);
  return [id];
}
