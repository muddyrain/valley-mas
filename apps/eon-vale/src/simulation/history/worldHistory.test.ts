import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { querySubjectHistory, queryWorldHistory, recordWorldEvent } from './worldHistory';

describe('structured world history', () => {
  it('separates the public archive from personal milestones and resolves factual links', () => {
    const simulation = createWorldSimulation({ seed: 'history-facts', initialHumans: 2 });
    const village = simulation.ensureVillageAt(64, 64, 2);
    const residentId = 0;
    simulation.state.entities.villageIds[residentId] = village.id;

    recordWorldEvent(simulation.state, {
      kind: 'birth',
      category: 'population',
      message: '黎安出生于苔溪',
      archive: false,
      notification: false,
      entityIds: [residentId],
      villageIds: [village.id],
      locationCell: 64 * simulation.state.map.size + 64,
    });
    recordWorldEvent(simulation.state, {
      kind: 'village-upgrade',
      category: 'village',
      message: '苔溪发展为村落',
      archive: true,
      notification: true,
      villageIds: [village.id],
    });

    const archive = queryWorldHistory(simulation.state, { filter: 'all' });
    expect(archive.entries.map((event) => event.kind)).toEqual([
      'village-upgrade',
      'village-founded',
    ]);
    expect(archive.entries[0]?.links).toContainEqual(
      expect.objectContaining({ kind: 'village', id: village.id, label: village.name }),
    );

    const favoriteLifeId = simulation.state.entities.lifeIds[residentId] ?? 0;
    const favorites = queryWorldHistory(simulation.state, {
      filter: 'favorites',
      favoriteLifeIds: [favoriteLifeId],
    });
    expect(favorites.entries.map((event) => event.kind)).toEqual(['birth']);
    expect(favorites.entries[0]?.links).toContainEqual(
      expect.objectContaining({ kind: 'entity', lifeId: favoriteLifeId, id: residentId }),
    );
  });

  it('assigns a stable life id to every spawned creature', () => {
    const simulation = createWorldSimulation({ seed: 'stable-lives', initialHumans: 0 });
    const [first] = simulation.spawn(EntityKind.Human, 32, 32);
    const [second] = simulation.spawn(EntityKind.Human, 33, 32);

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(simulation.state.entities.lifeIds[first ?? 0]).toBeGreaterThan(0);
    expect(simulation.state.entities.lifeIds[second ?? 0]).not.toBe(
      simulation.state.entities.lifeIds[first ?? 0],
    );
  });

  it('keeps permanent personal facts while limiting ordinary milestones', () => {
    const simulation = createWorldSimulation({ seed: 'bounded-lives', initialHumans: 1 });
    const lifeId = simulation.state.entities.lifeIds[0] ?? 0;
    recordWorldEvent(simulation.state, {
      kind: 'birth',
      category: 'population',
      message: '一名居民出生',
      archive: false,
      notification: false,
      entityIds: [0],
    });
    for (let index = 0; index < 48; index += 1) {
      recordWorldEvent(simulation.state, {
        kind: 'equipment',
        category: 'population',
        message: `装备里程碑 ${index}`,
        archive: false,
        notification: false,
        entityIds: [0],
      });
    }
    simulation.state.entities.active[0] = 0;
    simulation.state.favoriteLifeIds = [];

    const history = querySubjectHistory(simulation.state, {
      kind: 'entity',
      lifeId,
    });
    expect(history.some((event) => event.kind === 'birth')).toBe(true);
    expect(history).toHaveLength(33);
  });
});
