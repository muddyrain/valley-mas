import {
  createNaturalResourceStore,
  generateNaturalResourceFacts,
  type NaturalResourceStore,
} from '../resources/naturalResources';
import { ensureSettleability } from './settleability';
import { generateWorldFoundation } from './topology';
import {
  DEFAULT_NATURAL_CONTENT,
  type NaturalContentOptions,
  requiredSettleableRegions,
  SurfaceHabitat,
  type WorldFacts,
  type WorldPreset,
  type WorldSize,
} from './worldFacts';

export interface GenerateWorldOptions {
  seed: string;
  size: WorldSize;
  preset: WorldPreset;
  naturalContent: NaturalContentOptions;
}

export interface GeneratedWorld {
  world: WorldFacts;
  resources: NaturalResourceStore;
}

function surfaceForCell(
  normalizedElevation: number,
  moisture: number,
  temperature: number,
): number {
  if (normalizedElevation < 0.065) return SurfaceHabitat.Sand;
  if (temperature < 65) return SurfaceHabitat.Snow;
  if (moisture < 65) return SurfaceHabitat.Desert;
  if (moisture > 140 && normalizedElevation > 0.1) return SurfaceHabitat.WoodlandSoil;
  return SurfaceHabitat.Grassland;
}

export function generateWorld(
  options: Partial<GenerateWorldOptions> & { seed: string },
): GeneratedWorld {
  const size = options.size ?? 256;
  const preset = options.preset ?? 'archipelago';
  const naturalContent = { ...DEFAULT_NATURAL_CONTENT, ...options.naturalContent };
  const foundation = generateWorldFoundation(options.seed, size, preset);
  const surface = new Uint8Array(size * size);
  for (let cell = 0; cell < surface.length; cell += 1) {
    surface[cell] = surfaceForCell(
      foundation.normalizedElevation[cell] ?? -0.32,
      foundation.moisture[cell] ?? 0,
      foundation.temperature[cell] ?? 0,
    );
  }
  const world: WorldFacts = {
    size,
    preset,
    elevation: foundation.elevation,
    surface,
    moisture: foundation.moisture,
    temperature: foundation.temperature,
    naturalContent,
    revision: 0,
    dirtyCells: [],
    settleability: { requiredRegions: 0, regions: [], repairs: [] },
  };
  const facts = generateNaturalResourceFacts(world, options.seed, naturalContent);
  const required =
    preset !== 'ocean' && naturalContent.vegetation && naturalContent.resources
      ? requiredSettleableRegions(size)
      : 0;
  world.settleability = ensureSettleability(world, facts, options.seed, required);
  const resources = createNaturalResourceStore(facts, size * size);
  return { world, resources };
}
