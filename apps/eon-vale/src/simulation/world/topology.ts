import { createSeededRandom, stableNoise } from '@/shared/random';
import type { WorldPreset } from './worldFacts';

interface IslandSeed {
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  height: number;
}

export interface WorldFoundation {
  normalizedElevation: Float64Array;
  elevation: Float32Array;
  moisture: Uint8Array;
  temperature: Uint8Array;
  nextMapRandom: () => number;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function coherentNoise(x: number, z: number, scale: number, salt: number): number {
  const scaledX = x / scale;
  const scaledZ = z / scale;
  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const tx = smoothstep(scaledX - x0);
  const tz = smoothstep(scaledZ - z0);
  const sample = (sampleX: number, sampleZ: number) =>
    stableNoise(sampleX * 73_856_093 + sampleZ * 19_349_663 + salt);
  const top = sample(x0, z0) * (1 - tx) + sample(x0 + 1, z0) * tx;
  const bottom = sample(x0, z0 + 1) * (1 - tx) + sample(x0 + 1, z0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

function createIslandSeeds(random: () => number, size: number, preset: WorldPreset): IslandSeed[] {
  if (preset === 'ocean') return [];
  if (preset === 'continent') {
    return [
      {
        x: size * (0.48 + (random() - 0.5) * 0.08),
        z: size * (0.5 + (random() - 0.5) * 0.08),
        radiusX: size * 0.42,
        radiusZ: size * 0.38,
        height: 0.72,
      },
    ];
  }
  return Array.from({ length: 7 }, (_, index) => {
    const angle = (index / 7) * Math.PI * 2 + (random() - 0.5) * 0.65;
    const ring = index === 0 ? 0 : size * (0.16 + random() * 0.18);
    return {
      x: size / 2 + Math.cos(angle) * ring,
      z: size / 2 + Math.sin(angle) * ring,
      radiusX: size * (index === 0 ? 0.29 : 0.13 + random() * 0.1),
      radiusZ: size * (index === 0 ? 0.25 : 0.12 + random() * 0.09),
      height: index === 0 ? 0.67 : 0.48 + random() * 0.18,
    };
  });
}

function elevationAt(
  x: number,
  z: number,
  size: number,
  islands: IslandSeed[],
  preset: WorldPreset,
  salt: number,
): number {
  if (preset === 'ocean') return -0.32;
  let land = -0.36;
  for (const island of islands) {
    const distance = Math.hypot((x - island.x) / island.radiusX, (z - island.z) / island.radiusZ);
    land = Math.max(land, island.height - distance * 0.72);
  }
  const broad =
    Math.sin(x * 0.071 + z * 0.019) * 0.075 +
    Math.cos(z * 0.063 - x * 0.027) * 0.065 +
    (coherentNoise(x, z, 18, salt) - 0.5) * 0.17;
  const edgeDistance = Math.min(x, z, size - 1 - x, size - 1 - z);
  const edgeFade = Math.max(0, Math.min(1, edgeDistance / Math.max(4, size * 0.08)));
  return (land + broad) * edgeFade - (1 - edgeFade) * 0.38;
}

export function generateWorldFoundation(
  seed: string,
  size: number,
  preset: WorldPreset,
): WorldFoundation {
  const cellCount = size * size;
  const normalizedElevation = new Float64Array(cellCount);
  const elevation = new Float32Array(cellCount);
  const moisture = new Uint8Array(cellCount);
  const temperature = new Uint8Array(cellCount);
  const random = createSeededRandom(`${seed}:map:${preset}:${size}`);
  const biomeSalt = Math.floor(createSeededRandom(`${seed}:biomes`)() * 1_000_000_000);
  const islands = createIslandSeeds(random, size, preset);

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = z * size + x;
      const height = elevationAt(x, z, size, islands, preset, biomeSalt);
      const wet = Math.max(
        0,
        Math.min(
          255,
          Math.round(
            118 +
              Math.sin(x * 0.028 + z * 0.011) * 34 +
              (coherentNoise(x, z, 30, biomeSalt + 41) - 0.5) * 128 +
              (coherentNoise(x, z, 12, biomeSalt + 97) - 0.5) * 28,
          ),
        ),
      );
      const heat = Math.max(
        0,
        Math.min(255, Math.round(215 - (z / size) * 160 - Math.max(0, height) * 52)),
      );
      normalizedElevation[cell] = height;
      elevation[cell] = height * 8;
      moisture[cell] = wet;
      temperature[cell] = heat;
    }
  }

  return { normalizedElevation, elevation, moisture, temperature, nextMapRandom: random };
}
