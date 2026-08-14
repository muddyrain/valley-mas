import { describe, expect, it } from 'vitest';
import {
  createDefaultWorldLaws,
  WORLD_LAW_CATALOG,
  WORLD_LAW_IDS,
  WORLD_LAW_UI_IDS,
} from './worldLawCatalog';

describe('world law catalog', () => {
  it('is the exhaustive source for runtime world-law defaults', () => {
    expect(WORLD_LAW_IDS).toEqual([
      'hunger',
      'naturalOldAge',
      'humanReproduction',
      'animalReproduction',
      'animalPredation',
      'naturalAnimalReturn',
      'kingdomExpansion',
      'diplomacyAndWar',
      'naturalDisasters',
      'civilizationRestart',
    ]);
    expect(Object.keys(WORLD_LAW_CATALOG)).toEqual(WORLD_LAW_IDS);
    expect(createDefaultWorldLaws()).toEqual({
      hunger: true,
      naturalOldAge: true,
      humanReproduction: true,
      animalReproduction: true,
      animalPredation: true,
      naturalAnimalReturn: true,
      kingdomExpansion: true,
      diplomacyAndWar: true,
      naturalDisasters: true,
      civilizationRestart: false,
    });
    expect(WORLD_LAW_UI_IDS).toEqual([
      'hunger',
      'naturalOldAge',
      'humanReproduction',
      'animalReproduction',
      'animalPredation',
      'naturalAnimalReturn',
      'civilizationRestart',
    ]);
  });

  it('keeps accepted and unresolved gameplay states explicit', () => {
    expect(WORLD_LAW_CATALOG.naturalAnimalReturn.decisionStatus).toBe('accepted');
    expect(WORLD_LAW_CATALOG.civilizationRestart).toMatchObject({
      title: '文明重启',
      defaultEnabled: false,
      decisionStatus: 'accepted',
      availability: 'active',
    });
    expect(WORLD_LAW_CATALOG.hunger.availability).toBe('active');
  });

  it('returns a fresh state object for each world', () => {
    const first = createDefaultWorldLaws();
    const second = createDefaultWorldLaws();
    first.naturalAnimalReturn = false;

    expect(second.naturalAnimalReturn).toBe(true);
  });

  it('defines how every law stops without rolling back established facts', () => {
    expect(WORLD_LAW_CATALOG.humanReproduction.disablePolicy).toBe('finish-committed');
    expect(WORLD_LAW_CATALOG.animalReproduction.disablePolicy).toBe('finish-committed');
    expect(WORLD_LAW_CATALOG.kingdomExpansion.disablePolicy).toBe('finish-committed');
    expect(WORLD_LAW_CATALOG.animalPredation.disablePolicy).toBe('stop-harm');
    expect(WORLD_LAW_CATALOG.diplomacyAndWar.disablePolicy).toBe('withdraw-and-force-peace');
    expect(WORLD_LAW_CATALOG.naturalAnimalReturn.disablePolicy).toBe('block-future');
    expect(WORLD_LAW_CATALOG.civilizationRestart.disablePolicy).toBe('block-future');
  });

  it('registers explicit scopes and exceptions instead of a universal priority order', () => {
    expect(WORLD_LAW_CATALOG.animalReproduction).toMatchObject({
      scope: 'natural animal conception',
      exceptions: ['direct-animal-spawn-power'],
    });
    expect(WORLD_LAW_CATALOG.naturalOldAge).toMatchObject({
      scope: 'age-caused death',
      exceptions: [],
    });
    expect(WORLD_LAW_CATALOG.animalPredation).toMatchObject({
      scope: 'animal hunting and predation damage',
      exceptions: ['human-hunting'],
    });
    expect(WORLD_LAW_CATALOG.diplomacyAndWar).toMatchObject({
      scope: 'war declarations and combat damage',
      exceptions: ['peace-power'],
    });
  });
});
