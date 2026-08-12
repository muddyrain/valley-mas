import { describe, expect, it } from 'vitest';
import { createWorldSimulation } from '../core/worldSimulation';
import { loadWorldSave, serializeWorld } from './save';

describe('world persistence', () => {
  it('round-trips the current world without tick history', () => {
    const simulation = createWorldSimulation({ seed: 'archive', initialHumans: 48 });
    for (let tick = 0; tick < 300; tick += 1) simulation.step();
    const encoded = serializeWorld(simulation.state);
    const restored = loadWorldSave(encoded);

    expect(JSON.parse(encoded).version).toBe(6);
    expect(restored.seed).toBe(simulation.state.seed);
    expect(restored.tick).toBe(simulation.state.tick);
    expect(restored.entities.count).toBe(simulation.state.entities.count);
    expect(restored.entities.sex).toEqual(simulation.state.entities.sex);
    expect(restored.entities.familyIds).toEqual(simulation.state.entities.familyIds);
    expect(restored.population).toEqual(simulation.state.population);
    expect(restored.worldLaws).toEqual(simulation.state.worldLaws);
    expect(restored.ecology).toEqual(simulation.state.ecology);
    expect(restored.wars).toEqual(simulation.state.wars);
    expect(restored.truces).toEqual(simulation.state.truces);
    expect(restored.map.terrain).toEqual(simulation.state.map.terrain);
    expect(restored.resourceNodes.count).toBe(simulation.state.resourceNodes.count);
    expect(restored.resourceNodes.kind.slice(0, restored.resourceNodes.count)).toEqual(
      simulation.state.resourceNodes.kind.slice(0, simulation.state.resourceNodes.count),
    );
    expect(restored.resourceNodes.chunkHeads.some((nodeId) => nodeId >= 0)).toBe(true);
    expect(restored.entities.carriedResourceKinds).toEqual(
      simulation.state.entities.carriedResourceKinds,
    );
    expect(encoded).not.toContain('tickHistory');
  });

  it('fails safely for damaged and unsupported saves', () => {
    expect(() => loadWorldSave('{broken')).toThrow(/存档损坏/);
    expect(() => loadWorldSave(JSON.stringify({ version: 1 }))).toThrow(/存档版本/);
    expect(() => loadWorldSave(JSON.stringify({ version: 999 }))).toThrow(/存档版本/);
  });

  it('strictly validates the persisted world-law state', () => {
    const simulation = createWorldSimulation({ seed: 'world-laws-save', initialHumans: 24 });
    const missingLaw = JSON.parse(serializeWorld(simulation.state));
    delete missingLaw.worldLaws.naturalAnimalReturn;

    expect(() => loadWorldSave(JSON.stringify(missingLaw))).toThrow(/数据校验失败/);

    const invalidLaw = JSON.parse(serializeWorld(simulation.state));
    invalidLaw.worldLaws.civilizationRestart = 'enabled';

    expect(() => loadWorldSave(JSON.stringify(invalidLaw))).toThrow(/数据校验失败/);
  });
});
