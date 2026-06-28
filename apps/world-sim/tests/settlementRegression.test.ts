import { beforeEach, describe, expect, it } from 'vitest';
import type { MapData, Province, TerrainKind } from '../src/core/map';
import {
  collectRevoltRegionIds,
  rebuildSettlements,
  summarizeFactionSettlementStability,
} from '../src/core/sim';
import type { FactionSummary, RegionId, SettlementSummary } from '../src/shared/types';
import { asFactionId, asRegionId, asSettlementId, asTick, asWarId } from '../src/shared/types';
import { useWorldSimStore } from '../src/state/store';

beforeEach(() => {
  const store = useWorldSimStore.getState();
  store.exitReplayMode();
  store.regenerateMap({ seed: 'settlement-regression', provinceCount: 500 });
  store.loadScenario('random');
});

describe('settlement regression', () => {
  it('creates one capital settlement for every active scenario faction', () => {
    const state = useWorldSimStore.getState();
    const activeFactions = state.factions.filter((faction) => faction.regions > 0);

    expect(state.settlements).toHaveLength(activeFactions.length);
    for (const faction of activeFactions) {
      const settlement = state.settlements.find((item) => item.factionId === faction.id);
      expect(settlement).toBeDefined();
      expect(settlement).toMatchObject({
        factionId: faction.id,
        regionId: faction.capitalRegionId,
        tier: 'capital',
        isCapital: true,
      });
      const province = state.map?.provinces[settlement?.regionId as unknown as number];
      expect(province?.ownerFactionId).toBe(faction.id);
      expect(settlement?.population).toBeGreaterThan(0);
      expect(settlement?.influenceRadius).toBeGreaterThan(0);
      expect(settlement?.loyalty).toBeGreaterThanOrEqual(0);
      expect(settlement?.unrest).toBeGreaterThanOrEqual(0);
      expect(settlement?.revoltProgress).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves the capital settlement when a faction respawns', () => {
    const before = useWorldSimStore.getState();
    const faction = before.factions.find((item) => item.regions > 0);
    expect(faction).toBeDefined();

    const target = before.map?.provinces.find(
      (province) => province.terrain !== 'ocean' && province.ownerFactionId == null,
    );
    expect(target).toBeDefined();

    before.respawnFaction(faction!.id, target!.id);
    const after = useWorldSimStore.getState();
    const settlement = after.settlements.find((item) => item.factionId === faction!.id);

    expect(settlement?.regionId).toBe(target!.id);
    expect(settlement?.isCapital).toBe(true);
    expect(after.map?.provinces[target!.id as unknown as number]?.ownerFactionId).toBe(faction!.id);
  });

  it('clears settlements when the battle is reset', () => {
    const store = useWorldSimStore.getState();
    expect(store.settlements.length).toBeGreaterThan(0);

    store.resetBattle();
    const after = useWorldSimStore.getState();

    expect(after.settlements).toEqual([]);
    expect(after.factions.every((faction) => faction.regions === 0)).toBe(true);
  });

  it('rebuilds capital settlements from replay baseline', () => {
    const store = useWorldSimStore.getState();
    expect(store.initialOwnership.length).toBeGreaterThan(0);

    store.setSettlements([]);
    expect(useWorldSimStore.getState().settlements).toEqual([]);

    store.enterReplayMode();
    const replayState = useWorldSimStore.getState();

    expect(replayState.replayMode).toBe('replaying');
    expect(replayState.settlements.length).toBeGreaterThan(0);
    expect(replayState.settlements).toHaveLength(
      replayState.factions.filter((faction) => faction.regions > 0).length,
    );
  });

  it('auto-generates non-capital settlements for large connected realms', () => {
    const factionId = asFactionId(1);
    const map = buildLineMap(90, factionId);
    const faction = buildFaction({ id: factionId, regions: 90, capitalRegionId: asRegionId(0) });

    const settlements = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(20),
    });

    expect(settlements.length).toBeGreaterThan(1);
    expect(settlements.filter((settlement) => settlement.isCapital)).toHaveLength(1);
    expect(settlements.some((settlement) => settlement.tier === 'village' || settlement.tier === 'town')).toBe(
      true,
    );
    for (const settlement of settlements) {
      const province = map.provinces[settlement.regionId as unknown as number];
      expect(province?.terrain).not.toBe('ocean');
      expect(province?.ownerFactionId).toBe(factionId);
    }
  });

  it('does not found settlements on disconnected owned enclaves', () => {
    const factionId = asFactionId(2);
    const map = buildLineMap(70, factionId, { disconnectedFrom: 40 });
    const faction = buildFaction({ id: factionId, regions: 70, capitalRegionId: asRegionId(0) });

    const settlements = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(30),
    });

    expect(settlements.length).toBeGreaterThan(1);
    expect(settlements.every((settlement) => (settlement.regionId as unknown as number) < 40)).toBe(true);
  });

  it('grows retained settlements faster in fertile habitable regions than harsh mountain regions', () => {
    const factionId = asFactionId(23);
    const map = buildLineMap(120, factionId);
    map.provinces[10] = {
      ...map.provinces[10],
      terrain: 'river',
      elevation: 0.08,
      moisture: 0.9,
    };
    map.provinces[20] = {
      ...map.provinces[20],
      terrain: 'mountain',
      elevation: 0.95,
      moisture: 0.2,
    };
    const faction = buildFaction({ id: factionId, regions: 120, capitalRegionId: asRegionId(0) });
    const riverSettlement: SettlementSummary = {
      id: asSettlementId(230),
      factionId,
      name: '河谷镇',
      regionId: asRegionId(10),
      tier: 'village',
      population: 400,
      development: 0.4,
      influenceRadius: 3,
      isCapital: false,
      foundedTick: asTick(10),
      loyalty: 1,
      unrest: 0,
      revoltProgress: 0,
    };
    const mountainSettlement: SettlementSummary = {
      ...riverSettlement,
      id: asSettlementId(231),
      name: '山隘镇',
      regionId: asRegionId(20),
    };

    const settlements = rebuildSettlements({
      map,
      factions: [faction],
      previous: [
        {
          ...riverSettlement,
          id: asSettlementId(229),
          name: '测试势力都城',
          regionId: asRegionId(0),
          tier: 'capital',
          population: 1200,
          development: 1,
          influenceRadius: 5,
          isCapital: true,
        },
        riverSettlement,
        mountainSettlement,
      ],
      tick: asTick(11),
    });

    const grownRiver = settlements.find((settlement) => settlement.id === riverSettlement.id);
    const grownMountain = settlements.find((settlement) => settlement.id === mountainSettlement.id);

    expect(grownRiver?.population).toBeGreaterThan(grownMountain?.population ?? 0);
    expect(grownRiver?.development).toBeGreaterThan(grownMountain?.development ?? 0);
  });

  it('turns far recently conquered settlements into observable unrest instead of instant rebellion', () => {
    const factionId = asFactionId(3);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(20),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();

    const pressured = rebuildSettlements({
      map,
      factions: [faction],
      previous: stable.map((settlement) =>
        settlement.id === frontier!.id
          ? { ...settlement, loyalty: 0.35, unrest: 0.7, revoltProgress: 0.2 }
          : settlement,
      ),
      tick: asTick(30),
      recentConquests: new Map([[frontier!.regionId as unknown as number, asTick(25)]]),
    });
    const pressuredFrontier = pressured.find((settlement) => settlement.id === frontier!.id);
    const summary = summarizeFactionSettlementStability(pressured);

    expect(pressuredFrontier).toBeDefined();
    expect(pressuredFrontier!.loyalty).toBeLessThan(frontier!.loyalty);
    expect(pressuredFrontier!.unrest).toBeGreaterThan(frontier!.unrest);
    expect(pressuredFrontier!.revoltProgress).toBeGreaterThan(0.2);
    expect(summary.riskLevel).not.toBe('calm');
  });

  it('turns a capital fall into a stability shock for non-capital settlements', () => {
    const factionId = asFactionId(33);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(20),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    if (!frontier) throw new Error('expected a non-capital settlement');

    const shocked = rebuildSettlements({
      map,
      factions: [faction],
      previous: stable,
      tick: asTick(21),
      capitalFallShockFactionIds: new Set([factionId]),
    });
    const shockedCapital = shocked.find((settlement) => settlement.isCapital);
    const shockedFrontier = shocked.find((settlement) => settlement.id === frontier.id);
    expect(shockedFrontier).toBeDefined();
    if (!shockedFrontier) throw new Error('expected the shocked settlement to be retained');

    expect(shockedCapital?.loyalty).toBeGreaterThanOrEqual(0.8);
    expect(shockedCapital?.unrest).toBe(0);
    expect(shockedFrontier.loyalty).toBeLessThan(frontier.loyalty);
    expect(shockedFrontier.unrest).toBeGreaterThan(frontier.unrest);
    expect(shockedFrontier.revoltProgress).toBeGreaterThan(frontier.revoltProgress);
  });

  it('logs a revolt warning when a settlement crosses the preparation threshold', () => {
    const factionId = asFactionId(4);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(20),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const previous = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.35, unrest: 0.9, revoltProgress: 0.34 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: previous,
      recentConquests: new Map([[frontier!.regionId as unknown as number, asTick(20)]]),
      logs: [],
      tick: asTick(20),
      status: 'running',
      winnerFactionId: null,
      paused: true,
    });

    useWorldSimStore.getState().advanceTick(1);
    const after = useWorldSimStore.getState();

    expect(after.logs.some((log) => log.category === 'revolt' && log.message.includes(frontier!.name))).toBe(
      true,
    );
    expect(
      after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId,
    ).toBe(factionId);
  });

  it('creates a rebel faction and replay patch when revolt progress completes', () => {
    const factionId = asFactionId(5);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(40),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const previous = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.2, unrest: 1, revoltProgress: 0.99 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: previous,
      recentConquests: new Map([[frontier!.regionId as unknown as number, asTick(35)]]),
      logs: [],
      tick: asTick(40),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().advanceTick(1);
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;
    const owner = after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId ?? null;
    const rebel = after.factions.find((item) => item.id === owner);
    const rebelRegionIds =
      after.map?.provinces
        .filter((province) => province.ownerFactionId === owner)
        .map((province) => province.id) ?? [];

    expect(owner).not.toBeNull();
    expect(owner).not.toBe(factionId);
    expect(rebel?.name).toContain('义军');
    expect(after.activeWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'revolt',
          status: 'active',
          attackerFactionId: owner,
          defenderFactionId: factionId,
          sourceSettlementId: frontier!.id,
        }),
      ]),
    );
    expect(rebelRegionIds.length).toBeGreaterThan(1);
    expect(rebelRegionIds.length).toBeLessThanOrEqual(4);
    expect(rebelRegionIds).not.toContain(faction.capitalRegionId);
    expect(after.factions.find((item) => item.id === factionId)?.regions).toBe(100 - rebelRegionIds.length);
    expect(after.logs.some((log) => log.category === 'revolt' && log.message.includes('举旗叛乱'))).toBe(
      true,
    );
    expect(after.logs.some((log) => log.category === 'diplomacy' && log.message.includes('叛乱战争'))).toBe(
      true,
    );
    expect(after.replayFrames.at(-1)?.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          regionId: frontier!.regionId as unknown as number,
          from: factionId as unknown as number,
          to: owner as unknown as number,
        }),
      ]),
    );
    expect(after.replayFrames.at(-1)?.newWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'revolt',
          attackerFactionId: owner,
          defenderFactionId: factionId,
        }),
      ]),
    );
    for (const regionId of rebelRegionIds) {
      expect(after.replayFrames.at(-1)?.patches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            regionId: regionId as unknown as number,
            from: factionId as unknown as number,
            to: owner as unknown as number,
          }),
        ]),
      );
    }

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    expect(replayed.factions.some((item) => item.id === owner && item.name.includes('义军'))).toBe(true);
    expect(replayed.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(owner);
    expect(replayed.activeWars.some((war) => war.attackerFactionId === owner && war.defenderFactionId === factionId)).toBe(
      true,
    );
  });

  it('blesses a settlement through a replayable divine intervention', () => {
    const factionId = asFactionId(51);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(70),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const pressured = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.42, unrest: 0.68, revoltProgress: 0.44 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: pressured,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(70),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().blessSettlement(frontier!.id);
    const after = useWorldSimStore.getState();
    const blessed = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(blessed?.loyalty).toBeGreaterThan(0.42);
    expect(blessed?.unrest).toBeLessThan(0.68);
    expect(blessed?.revoltProgress).toBeLessThan(0.44);
    expect(after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(factionId);
    expect(after.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'divine',
          message: expect.stringContaining(frontier!.name),
        }),
      ]),
    );
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          loyalty: blessed?.loyalty,
          unrest: blessed?.unrest,
          revoltProgress: blessed?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes(frontier!.name))).toBe(
      true,
    );
    expect(replayedSettlement).toMatchObject({
      loyalty: blessed?.loyalty,
      unrest: blessed?.unrest,
      revoltProgress: blessed?.revoltProgress,
    });
  });

  it('applies the selected divine tool to a clicked settlement region', () => {
    const factionId = asFactionId(53);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(74),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const pressured = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.41, unrest: 0.66, revoltProgress: 0.4 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: pressured,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(74),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });
    useWorldSimStore.getState().setDivineTool('bless-settlement');

    const applied = useWorldSimStore.getState().applyDivineToolAtRegion(frontier!.regionId);
    const after = useWorldSimStore.getState();
    const blessed = after.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(applied).toBe(true);
    expect(blessed?.loyalty).toBeGreaterThan(0.41);
    expect(blessed?.unrest).toBeLessThan(0.66);
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('祝福'))).toBe(
      true,
    );
    expect(useWorldSimStore.getState().applyDivineToolAtRegion(asRegionId(9999))).toBe(false);
  });

  it('curses a settlement through a replayable divine intervention', () => {
    const factionId = asFactionId(52);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(72),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const settled = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.78, unrest: 0.12, revoltProgress: 0.08 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: settled,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(72),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().curseSettlement(frontier!.id);
    const after = useWorldSimStore.getState();
    const cursed = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(cursed?.loyalty).toBeLessThan(0.78);
    expect(cursed?.unrest).toBeGreaterThan(0.12);
    expect(cursed?.revoltProgress).toBeGreaterThan(0.08);
    expect(after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(factionId);
    expect(after.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'divine',
          message: expect.stringContaining('诅咒'),
        }),
      ]),
    );
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          loyalty: cursed?.loyalty,
          unrest: cursed?.unrest,
          revoltProgress: cursed?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('诅咒'))).toBe(true);
    expect(replayedSettlement).toMatchObject({
      loyalty: cursed?.loyalty,
      unrest: cursed?.unrest,
      revoltProgress: cursed?.revoltProgress,
    });
  });

  it('incites a settlement revolt through a replayable divine intervention', () => {
    const factionId = asFactionId(54);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(76),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const unsettled = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.58, unrest: 0.36, revoltProgress: 0.32 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: unsettled,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(76),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().inciteSettlementRevolt(frontier!.id);
    const after = useWorldSimStore.getState();
    const incited = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(incited?.loyalty).toBeLessThan(0.58);
    expect(incited?.unrest).toBeGreaterThan(0.36);
    expect(incited?.revoltProgress).toBeGreaterThan(0.32);
    expect(after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(factionId);
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('煽动'))).toBe(true);
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          loyalty: incited?.loyalty,
          unrest: incited?.unrest,
          revoltProgress: incited?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('煽动'))).toBe(true);
    expect(replayedSettlement).toMatchObject({
      loyalty: incited?.loyalty,
      unrest: incited?.unrest,
      revoltProgress: incited?.revoltProgress,
    });
  });

  it('pacifies settlement unrest through a replayable divine intervention', () => {
    const factionId = asFactionId(55);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(78),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const unstable = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, loyalty: 0.44, unrest: 0.82, revoltProgress: 0.74 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: unstable,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(78),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().pacifySettlementUnrest(frontier!.id);
    const after = useWorldSimStore.getState();
    const pacified = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(pacified?.loyalty).toBeGreaterThan(0.44);
    expect(pacified?.unrest).toBeLessThan(0.82);
    expect(pacified?.revoltProgress).toBeLessThan(0.74);
    expect(after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(factionId);
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('平息'))).toBe(true);
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          loyalty: pacified?.loyalty,
          unrest: pacified?.unrest,
          revoltProgress: pacified?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('平息'))).toBe(true);
    expect(replayedSettlement).toMatchObject({
      loyalty: pacified?.loyalty,
      unrest: pacified?.unrest,
      revoltProgress: pacified?.revoltProgress,
    });
  });

  it('accelerates settlement civilization through a replayable divine intervention', () => {
    const factionId = asFactionId(56);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(80),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const young = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, population: 220, development: 0.28, loyalty: 0.55, unrest: 0.24, revoltProgress: 0.18 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: young,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(80),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().accelerateSettlementCivilization(frontier!.id);
    const after = useWorldSimStore.getState();
    const accelerated = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(accelerated?.population).toBeGreaterThan(220);
    expect(accelerated?.development).toBeGreaterThan(0.28);
    expect(accelerated?.unrest).toBeLessThan(0.24);
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('加速'))).toBe(true);
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          population: accelerated?.population,
          development: accelerated?.development,
          loyalty: accelerated?.loyalty,
          unrest: accelerated?.unrest,
          revoltProgress: accelerated?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('加速'))).toBe(true);
    expect(replayedSettlement).toMatchObject({
      population: accelerated?.population,
      development: accelerated?.development,
      loyalty: accelerated?.loyalty,
      unrest: accelerated?.unrest,
      revoltProgress: accelerated?.revoltProgress,
    });
  });

  it('strikes a settlement disaster through a replayable divine intervention', () => {
    const factionId = asFactionId(57);
    const map = buildLineMap(100, factionId);
    const faction = buildFaction({ id: factionId, regions: 100, capitalRegionId: asRegionId(0) });
    const stable = rebuildSettlements({
      map,
      factions: [faction],
      tick: asTick(82),
    });
    const frontier = stable.find((settlement) => !settlement.isCapital);
    expect(frontier).toBeDefined();
    const thriving = stable.map((settlement) =>
      settlement.id === frontier!.id
        ? { ...settlement, population: 820, development: 0.76, loyalty: 0.72, unrest: 0.18, revoltProgress: 0.12 }
        : settlement,
    );

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: thriving,
      recentConquests: new Map(),
      logs: [],
      tick: asTick(82),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) =>
        province.terrain === 'ocean' ? null : factionId,
      ),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });

    useWorldSimStore.getState().strikeSettlementDisaster(frontier!.id);
    const after = useWorldSimStore.getState();
    const damaged = after.settlements.find((settlement) => settlement.id === frontier!.id);
    const frameCount = after.replayFrames.length;

    expect(damaged?.population).toBeLessThan(820);
    expect(damaged?.development).toBeLessThan(0.76);
    expect(damaged?.unrest).toBeGreaterThan(0.18);
    expect(after.map?.provinces[frontier!.regionId as unknown as number]?.ownerFactionId).toBe(factionId);
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('灾害'))).toBe(true);
    expect(after.replayFrames.at(-1)?.settlementUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementId: frontier!.id,
          population: damaged?.population,
          development: damaged?.development,
          loyalty: damaged?.loyalty,
          unrest: damaged?.unrest,
          revoltProgress: damaged?.revoltProgress,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    const replayedSettlement = replayed.settlements.find((settlement) => settlement.id === frontier!.id);

    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('灾害'))).toBe(true);
    expect(replayedSettlement).toMatchObject({
      population: damaged?.population,
      development: damaged?.development,
      loyalty: damaged?.loyalty,
      unrest: damaged?.unrest,
      revoltProgress: damaged?.revoltProgress,
    });
  });

  it('keeps revolt spread local, landed, same-owner, and away from the old capital', () => {
    const factionId = asFactionId(6);
    const map = buildLineMap(8, factionId);
    map.provinces[5].terrain = 'ocean';
    map.provinces[5].ownerFactionId = null;
    map.provinces[7].ownerFactionId = asFactionId(99);

    const regionIds = collectRevoltRegionIds({
      map,
      rootRegionId: asRegionId(4),
      parentFactionId: factionId,
      parentCapitalRegionId: asRegionId(0),
      currentTick: asTick(60),
      recentConquests: new Map([
        [3, asTick(55)],
        [4, asTick(55)],
      ]),
      maxRegions: 4,
      maxDepth: 3,
    });

    expect(regionIds[0]).toBe(asRegionId(4));
    expect(regionIds).toContain(asRegionId(3));
    expect(regionIds).not.toContain(asRegionId(0));
    expect(regionIds).not.toContain(asRegionId(5));
    expect(regionIds).not.toContain(asRegionId(7));
    expect(regionIds.length).toBeLessThanOrEqual(4);
  });

  it('records and replays ordinary border war declarations before owned attacks', () => {
    const attackerId = asFactionId(21);
    const defenderId = asFactionId(22);
    const map = buildLineMap(20, attackerId);
    for (let index = 10; index < 20; index++) {
      map.provinces[index].ownerFactionId = defenderId;
    }
    const attacker = buildFaction({ id: attackerId, regions: 10, capitalRegionId: asRegionId(0) });
    const defender = buildFaction({ id: defenderId, regions: 10, capitalRegionId: asRegionId(19) });

    useWorldSimStore.setState({
      map,
      factions: [attacker, defender],
      settlements: [],
      recentConquests: new Map(),
      activeWars: [],
      logs: [],
      tick: asTick(80),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) => province.ownerFactionId),
      initialFactions: [
        {
          id: attacker.id,
          name: attacker.name,
          leader: attacker.leader,
          colorHex: attacker.colorHex,
          birthRegionId: attacker.birthRegionId,
          capitalRegionId: attacker.capitalRegionId,
          population: attacker.population,
        },
        {
          id: defender.id,
          name: defender.name,
          leader: defender.leader,
          colorHex: defender.colorHex,
          birthRegionId: defender.birthRegionId,
          capitalRegionId: defender.capitalRegionId,
          population: defender.population,
        },
      ],
    });

    useWorldSimStore.getState().advanceTick(1);
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;

    expect(after.activeWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'border',
          status: 'active',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
        }),
      ]),
    );
    expect(after.logs.some((log) => log.category === 'diplomacy' && log.message.includes('宣战'))).toBe(true);
    expect(after.replayFrames.at(-1)?.newWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'border',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    expect(replayed.activeWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'border',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
        }),
      ]),
    );
  });

  it('freezes an active border war at a clicked front region through replay', () => {
    const attackerId = asFactionId(58);
    const defenderId = asFactionId(59);
    const map = buildLineMap(20, attackerId);
    for (let index = 10; index < 20; index++) {
      map.provinces[index].ownerFactionId = defenderId;
    }
    const attacker = buildFaction({ id: attackerId, regions: 10, capitalRegionId: asRegionId(0) });
    const defender = buildFaction({ id: defenderId, regions: 10, capitalRegionId: asRegionId(19) });
    const war = {
      id: asWarId(5801),
      kind: 'border',
      status: 'active',
      attackerFactionId: attackerId,
      defenderFactionId: defenderId,
      startedTick: asTick(70),
      lastContactTick: asTick(88),
      fatigue: 0.35,
    } as const;

    useWorldSimStore.setState({
      map,
      factions: [attacker, defender],
      settlements: [],
      recentConquests: new Map(),
      activeWars: [war],
      logs: [],
      tick: asTick(90),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) => province.ownerFactionId),
      initialFactions: [
        {
          id: attacker.id,
          name: attacker.name,
          leader: attacker.leader,
          colorHex: attacker.colorHex,
          birthRegionId: attacker.birthRegionId,
          capitalRegionId: attacker.capitalRegionId,
          population: attacker.population,
        },
        {
          id: defender.id,
          name: defender.name,
          leader: defender.leader,
          colorHex: defender.colorHex,
          birthRegionId: defender.birthRegionId,
          capitalRegionId: defender.capitalRegionId,
          population: defender.population,
        },
      ],
    });
    useWorldSimStore.getState().setDivineTool('freeze-war');

    const applied = useWorldSimStore.getState().applyDivineToolAtRegion(asRegionId(9));
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;

    expect(applied).toBe(true);
    expect(after.activeWars[0]).toMatchObject({
      id: war.id,
      status: 'truce',
      fatigue: 0,
      truceUntilTick: expect.any(Number),
    });
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('冻结'))).toBe(true);
    expect(after.replayFrames.at(-1)?.updatedWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: war.id,
          status: 'truce',
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();

    expect(replayed.activeWars[0]).toMatchObject({
      id: war.id,
      status: 'truce',
      fatigue: 0,
    });
    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('冻结'))).toBe(true);
  });

  it('records and replays divine terrain changes without changing ownership', () => {
    const factionId = asFactionId(60);
    const map = buildLineMap(20, factionId);
    const targetRegionId = asRegionId(4);
    const targetIndex = targetRegionId as unknown as number;
    map.provinces[targetIndex].terrain = 'plain';
    const faction = buildFaction({ id: factionId, regions: 20, capitalRegionId: asRegionId(0) });

    useWorldSimStore.setState({
      map,
      factions: [faction],
      settlements: [],
      recentConquests: new Map(),
      activeWars: [],
      logs: [],
      tick: asTick(92),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) => province.ownerFactionId),
      initialFactions: [
        {
          id: faction.id,
          name: faction.name,
          leader: faction.leader,
          colorHex: faction.colorHex,
          birthRegionId: faction.birthRegionId,
          capitalRegionId: faction.capitalRegionId,
          population: faction.population,
        },
      ],
    });
    useWorldSimStore.getState().setDivineTool('terraform-region');
    useWorldSimStore.getState().setDivineTerrain('forest');

    const applied = useWorldSimStore.getState().applyDivineToolAtRegion(targetRegionId);
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;

    expect(applied).toBe(true);
    expect(after.map?.provinces[targetIndex]).toMatchObject({
      terrain: 'forest',
      ownerFactionId: factionId,
    });
    expect(after.logs.some((log) => log.category === 'divine' && log.message.includes('地形'))).toBe(true);
    expect(after.replayFrames.at(-1)?.patches).toEqual([]);
    expect(after.replayFrames.at(-1)?.terrainUpdates).toEqual([
      { regionId: targetRegionId, from: 'plain', to: 'forest' },
    ]);

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();

    expect(replayed.map?.provinces[targetIndex]).toMatchObject({
      terrain: 'forest',
      ownerFactionId: factionId,
    });
    expect(replayed.logs.some((log) => log.category === 'divine' && log.message.includes('地形'))).toBe(true);
  });

  it('records and replays capital fall and relocation logs', () => {
    const attackerId = asFactionId(41);
    const defenderId = asFactionId(42);
    const map = buildLineMap(60, attackerId);
    for (let index = 40; index < 60; index++) {
      map.provinces[index].ownerFactionId = defenderId;
    }
    const attacker = {
      ...buildFaction({ id: attackerId, regions: 40, capitalRegionId: asRegionId(0) }),
      name: '攻方',
      leader: '攻方君主',
    };
    const defender = {
      ...buildFaction({ id: defenderId, regions: 20, capitalRegionId: asRegionId(40) }),
      name: '守方',
      leader: '守方君主',
    };
    const fallbackTownRegionId = asRegionId(58);
    const defenderSettlements = [
      {
        id: asSettlementId(420),
        factionId: defenderId,
        name: '守方都城',
        regionId: asRegionId(40),
        tier: 'capital' as const,
        population: 2400,
        development: 1,
        influenceRadius: 5,
        isCapital: true,
        foundedTick: asTick(1),
        loyalty: 0.95,
        unrest: 0,
        revoltProgress: 0,
      },
      {
        id: asSettlementId(421),
        factionId: defenderId,
        name: '守方东镇',
        regionId: fallbackTownRegionId,
        tier: 'town' as const,
        population: 1800,
        development: 0.82,
        influenceRadius: 4,
        isCapital: false,
        foundedTick: asTick(30),
        loyalty: 0.72,
        unrest: 0.1,
        revoltProgress: 0,
      },
    ];

    useWorldSimStore.setState({
      seed: 'capital-fall-regression',
      map,
      factions: [attacker, defender],
      settlements: defenderSettlements,
      recentConquests: new Map(),
      activeWars: [
        {
          id: asWarId(20),
          kind: 'border',
          status: 'active',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
          startedTick: asTick(110),
          lastContactTick: asTick(120),
          fatigue: 0.15,
          attackerStartRegions: 40,
          defenderStartRegions: 20,
          siegeProgress: [
            {
              settlementId: asSettlementId(420),
              regionId: asRegionId(40),
              attackerFactionId: attackerId,
              defenderFactionId: defenderId,
              progress: 0.92,
              lastUpdatedTick: asTick(120),
            },
          ],
        },
      ],
      logs: [],
      tick: asTick(120),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) => province.ownerFactionId),
      initialFactions: [
        {
          id: attacker.id,
          name: attacker.name,
          leader: attacker.leader,
          colorHex: attacker.colorHex,
          birthRegionId: attacker.birthRegionId,
          capitalRegionId: attacker.capitalRegionId,
          population: attacker.population,
        },
        {
          id: defender.id,
          name: defender.name,
          leader: defender.leader,
          colorHex: defender.colorHex,
          birthRegionId: defender.birthRegionId,
          capitalRegionId: defender.capitalRegionId,
          population: defender.population,
        },
      ],
    });

    for (let attempt = 0; attempt < 20; attempt++) {
      useWorldSimStore.getState().advanceTick(1);
      if (useWorldSimStore.getState().map?.provinces[40].ownerFactionId === attackerId) break;
    }

    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;
    const relocatedCapital = after.factions.find((faction) => faction.id === defenderId)?.capitalRegionId;
    const capitalLog = after.logs.find((log) => log.category === 'capital');

    expect(after.map?.provinces[40].ownerFactionId).toBe(attackerId);
    expect(relocatedCapital).toBe(fallbackTownRegionId);
    expect(capitalLog?.message).toContain('守方 都城 #40 陷落');
    expect(capitalLog?.message).toContain(`迁都 #${relocatedCapital}`);
    expect(after.replayFrames.some((frame) => frame.events.some((log) => log.category === 'capital'))).toBe(
      true,
    );
    expect(after.activeWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: asWarId(20),
          capitalShocks: expect.arrayContaining([
            expect.objectContaining({
              factionId: defenderId,
            }),
          ]),
        }),
      ]),
    );
    expect(after.replayFrames.at(-1)?.updatedWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: asWarId(20),
          capitalShocks: expect.arrayContaining([
            expect.objectContaining({
              factionId: defenderId,
            }),
          ]),
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();

    expect(replayed.logs.some((log) => log.category === 'capital' && log.message.includes('都城 #40 陷落'))).toBe(
      true,
    );
    expect(replayed.factions.find((faction) => faction.id === defenderId)?.capitalRegionId).toBe(
      fallbackTownRegionId,
    );
  });

  it('records and replays a truce when a revolt war loses border contact', () => {
    const attackerId = asFactionId(7);
    const defenderId = asFactionId(8);
    const map = buildLineMap(3, attackerId);
    map.provinces[1].terrain = 'ocean';
    map.provinces[1].ownerFactionId = null;
    map.provinces[2].ownerFactionId = defenderId;
    const attacker = buildFaction({ id: attackerId, regions: 1, capitalRegionId: asRegionId(0) });
    const defender = buildFaction({ id: defenderId, regions: 1, capitalRegionId: asRegionId(2) });

    useWorldSimStore.setState({
      map,
      factions: [attacker, defender],
      settlements: [],
      recentConquests: new Map(),
      activeWars: [
        {
          id: asWarId(1),
          kind: 'revolt',
          status: 'active',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
          startedTick: asTick(1),
          lastContactTick: asTick(1),
        },
      ],
      logs: [],
      tick: asTick(20),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: [attackerId, null, defenderId],
      initialFactions: [
        {
          id: attacker.id,
          name: attacker.name,
          leader: attacker.leader,
          colorHex: attacker.colorHex,
          birthRegionId: attacker.birthRegionId,
          capitalRegionId: attacker.capitalRegionId,
          population: attacker.population,
        },
        {
          id: defender.id,
          name: defender.name,
          leader: defender.leader,
          colorHex: defender.colorHex,
          birthRegionId: defender.birthRegionId,
          capitalRegionId: defender.capitalRegionId,
          population: defender.population,
        },
      ],
    });

    useWorldSimStore.getState().advanceTick(1);
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;

    expect(after.activeWars[0]).toMatchObject({ status: 'truce' });
    expect(after.logs.some((log) => log.category === 'diplomacy' && log.message.includes('停战'))).toBe(true);
    expect(after.replayFrames.at(-1)?.updatedWars).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: asWarId(1), status: 'truce' })]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    expect(replayed.activeWars[0]).toMatchObject({ status: 'truce' });
  });

  it('records and replays a fatigue truce for a long border war', () => {
    const attackerId = asFactionId(31);
    const defenderId = asFactionId(32);
    const map = buildLineMap(4, attackerId);
    map.provinces[0].neighbors = [];
    map.provinces[1].neighbors = [asRegionId(2)];
    map.provinces[2].neighbors = [asRegionId(1)];
    map.provinces[3].neighbors = [];
    map.provinces[2].ownerFactionId = defenderId;
    map.provinces[3].ownerFactionId = defenderId;
    const attacker = buildFaction({ id: attackerId, regions: 2, capitalRegionId: asRegionId(0) });
    const defender = buildFaction({ id: defenderId, regions: 2, capitalRegionId: asRegionId(3) });

    useWorldSimStore.setState({
      map,
      factions: [attacker, defender],
      settlements: [],
      recentConquests: new Map(),
      activeWars: [
        {
          id: asWarId(9),
          kind: 'border',
          status: 'active',
          attackerFactionId: attackerId,
          defenderFactionId: defenderId,
          startedTick: asTick(1),
          lastContactTick: asTick(80),
          fatigue: 0.8,
          attackerStartRegions: 2,
          defenderStartRegions: 2,
        },
      ],
      logs: [],
      tick: asTick(120),
      status: 'running',
      winnerFactionId: null,
      paused: true,
      replayMode: 'recording',
      replayFrames: [],
      replayCursor: 0,
      initialOwnership: map.provinces.map((province) => province.ownerFactionId),
      initialFactions: [
        {
          id: attacker.id,
          name: attacker.name,
          leader: attacker.leader,
          colorHex: attacker.colorHex,
          birthRegionId: attacker.birthRegionId,
          capitalRegionId: attacker.capitalRegionId,
          population: attacker.population,
        },
        {
          id: defender.id,
          name: defender.name,
          leader: defender.leader,
          colorHex: defender.colorHex,
          birthRegionId: defender.birthRegionId,
          capitalRegionId: defender.capitalRegionId,
          population: defender.population,
        },
      ],
    });

    useWorldSimStore.getState().advanceTick(1);
    const after = useWorldSimStore.getState();
    const frameCount = after.replayFrames.length;

    expect(after.activeWars[0]).toMatchObject({
      id: asWarId(9),
      status: 'truce',
      fatigue: 1,
    });
    expect(after.logs.some((log) => log.category === 'diplomacy' && log.message.includes('战事疲惫'))).toBe(true);
    expect(after.replayFrames.at(-1)?.updatedWars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: asWarId(9),
          status: 'truce',
          fatigue: 1,
        }),
      ]),
    );

    after.enterReplayMode();
    useWorldSimStore.getState().seekReplay(frameCount);
    const replayed = useWorldSimStore.getState();
    expect(replayed.activeWars[0]).toMatchObject({
      id: asWarId(9),
      status: 'truce',
      fatigue: 1,
    });
  });
});

function buildFaction(input: {
  id: ReturnType<typeof asFactionId>;
  regions: number;
  capitalRegionId: RegionId;
}): FactionSummary {
  return {
    id: input.id,
    name: '测试势力',
    leader: '测试君主',
    colorHex: '#55aa66',
    birthRegionId: input.capitalRegionId,
    capitalRegionId: input.capitalRegionId,
    centroidRegionId: input.capitalRegionId,
    regions: input.regions,
    population: input.regions * 1000,
  };
}

function buildLineMap(
  provinceCount: number,
  ownerFactionId: ReturnType<typeof asFactionId>,
  options: { disconnectedFrom?: number } = {},
): MapData {
  const provinces: Province[] = [];
  for (let index = 0; index < provinceCount; index++) {
    const terrain: TerrainKind = index % 11 === 0 ? 'river' : index % 7 === 0 ? 'forest' : 'plain';
    const neighbors: RegionId[] = [];
    if (index > 0 && index !== options.disconnectedFrom) neighbors.push(asRegionId(index - 1));
    if (index < provinceCount - 1 && index + 1 !== options.disconnectedFrom) neighbors.push(asRegionId(index + 1));
    provinces.push({
      id: asRegionId(index),
      site: { x: index * 10, y: 0 },
      polygon: [
        { x: index * 10, y: 0 },
        { x: index * 10 + 8, y: 0 },
        { x: index * 10 + 8, y: 8 },
        { x: index * 10, y: 8 },
      ],
      neighbors,
      borderEdgeIds: [],
      centroid: { x: index * 10 + 4, y: 4 },
      terrain,
      elevation: terrain === 'river' ? 0.2 : 0.35,
      moisture: terrain === 'forest' || terrain === 'river' ? 0.75 : 0.55,
      ownerFactionId,
    });
  }

  return {
    meta: {
      seed: 'settlement-line-map',
      provinceCount,
      relaxIterations: 0,
      bounds: { width: provinceCount * 10, height: 20 },
    },
    provinces,
    borders: [],
  };
}
