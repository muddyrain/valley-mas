import type { WorldMapDelta } from '@/render/renderTypes';
import type { WorldMap } from '@/shared/gameTypes';

export function drainWorldMapDelta(map: WorldMap): WorldMapDelta | null {
  if (map.dirtyMapCells.length === 0) return null;
  const dirtyCells = [...new Set(map.dirtyMapCells)].sort((left, right) => left - right);
  map.dirtyMapCells.length = 0;
  const cells = Uint32Array.from(dirtyCells);
  const terrain = new Uint8Array(cells.length);
  const height = new Float32Array(cells.length);
  const moisture = new Uint8Array(cells.length);
  const temperature = new Uint8Array(cells.length);
  const resourceFood = new Uint16Array(cells.length);
  const fire = new Uint8Array(cells.length);
  const rain = new Uint8Array(cells.length);
  const plague = new Uint8Array(cells.length);
  const crops = new Uint8Array(cells.length);
  const craters = new Uint8Array(cells.length);
  const roads = new Uint8Array(cells.length);
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index] ?? 0;
    terrain[index] = map.terrain[cell] ?? 0;
    height[index] = map.height[cell] ?? 0;
    moisture[index] = map.moisture[cell] ?? 0;
    temperature[index] = map.temperature[cell] ?? 0;
    resourceFood[index] = map.resourceFood[cell] ?? 0;
    fire[index] = map.fire[cell] ?? 0;
    rain[index] = map.rain[cell] ?? 0;
    plague[index] = map.plague[cell] ?? 0;
    crops[index] = map.crops[cell] ?? 0;
    craters[index] = map.craters[cell] ?? 0;
    roads[index] = map.roads[cell] ?? 0;
  }
  return {
    cells,
    terrain,
    height,
    moisture,
    temperature,
    resourceFood,
    fire,
    rain,
    plague,
    crops,
    craters,
    roads,
  };
}
