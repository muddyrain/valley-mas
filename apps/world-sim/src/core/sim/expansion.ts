import type { MapData } from '@/core/map';
import type { RandomSource } from '@/shared/math';
import type { FactionId, FactionSummary, RegionId, SettlementSummary, Tick, WarSummary } from '@/shared/types';
import { type AdminDistanceState, buildAdminDistanceState, getAdminSupport } from './adminDistance';
import { getActiveWarTargetWeight, isActiveWarPair } from './conflicts';
import {
  buildFrontPressureState,
  type FrontBattlePressure,
  getDefenderPressureTargetWeight,
  resolveFrontBattlePressure,
} from './frontPressure';
import {
  computeRegionStrategicProfile,
  getGeographicCombatPenalty,
  getStrategicWarTargetWeight,
} from './geoStrategy';
import { getSmallRealmCollapseBias, getTempoConfig } from './tempo';
import { TERRAIN_ATTACK_PROB } from './terrainCombat';
import type { SimTickResult } from './types';

const NEUTRAL_EXPANSION_MIN_CHANCE = 0.18;
const NEUTRAL_EXPANSION_MAX_CHANCE = 0.98;
const HOMELAND_GRACE_REGION_COUNT = 10;
const CORE_DISTANCE_PRESSURE_START = 0.06;
const CORE_DISTANCE_PRESSURE_FULL = 0.34;
const BORDER_PRESSURE_START = 18;
const BORDER_PRESSURE_FULL = 96;
const NEUTRAL_DISTANCE_PENALTY_MAX = 0.62;
const NEUTRAL_BORDER_PENALTY_MAX = 0.26;
const WAR_ADMIN_PENALTY_SCALE = 0.32;
const SETTLEMENT_TARGET_WEIGHT: Record<SettlementSummary['tier'], number> = {
  village: 1.4,
  town: 1.8,
  city: 2.2,
  capital: 2.6,
};
const SETTLEMENT_FORTIFICATION_PENALTY: Record<SettlementSummary['tier'], number> = {
  village: 0.04,
  town: 0.08,
  city: 0.12,
  capital: 0.16,
};
const SIEGE_MOMENTUM_START_TICKS = 16;
const SIEGE_MOMENTUM_FULL_TICKS = 80;
const SIEGE_MOMENTUM_FORTIFICATION_REDUCTION = 0.65;
const SETTLEMENT_SIEGE_CAPTURE_THRESHOLD = 0.9;
const CAPITAL_SHOCK_ATTACK_BIAS = 0.14;

export interface RunExpansionTickInput {
  tick: Tick;
  map: MapData;
  factions: FactionSummary[];
  rng: RandomSource;
  settlements?: SettlementSummary[];
  activeWars?: WarSummary[];
  /** 每 tick 进行的扩张尝试次数；默认 clamp(势力数*16, 40, 100)，终局阶段翻倍 */
  attemptsPerTick?: number;
}

interface FactionRuntime {
  id: FactionId;
  name: string;
  /** 边界州集合（自己拥有，且至少一个邻居非己方） */
  border: Set<number>;
  totalRegions: number;
  anchorRegionId: RegionId | null;
  anchorPoint: { x: number; y: number } | null;
  summary: FactionSummary;
}

/**
 * 单步扩张内核（Phase 8.5 Frontline 重构）。
 *
 * 与旧版的差别：
 *   - 不再每次 attempt 全表 refreshSnapshotBorders；
 *   - 维护每势力的 border Set<RegionId>，每次 owner 变更只对「该州 + 邻居」做局部 patch；
 *   - 默认 attemptsPerTick 从 ceil(N/2) 升到 clamp(N*16, 40, 100)，把 3000 州地图打热。
 *   - 仍保持纯函数：不读 store、不写 store、不依赖渲染。
 */
export function runExpansionTick(input: RunExpansionTickInput): SimTickResult {
  const { tick, map, factions, rng } = input;

  const runtimeById = buildRuntimes(map, factions);
  const result: SimTickResult = { patches: [], events: [] };
  // ownerOverride：tick 内累计的 owner 变更，下一个 attempt 看到的就是「本 tick 已变后」的视图
  const ownerOverride = new Map<number, FactionId | null>();

  const liveRuntimes = Array.from(runtimeById.values()).filter((r) => r.totalRegions > 0);
  if (liveRuntimes.length === 0) {
    return result;
  }

  const occupied = liveRuntimes.reduce((sum, r) => sum + r.totalRegions, 0);
  const landProvinces = map.provinces.filter((p) => p.terrain !== 'ocean');
  const landProvinceCount = Math.max(1, landProvinces.length);
  if (liveRuntimes.length === 1 && occupied >= landProvinces.length) {
    const champion = liveRuntimes[0];
    result.events.push({
      tick,
      type: 'victory',
      regionId: null,
      attackerId: champion.id,
      defenderId: null,
      message: `${champion.name} 一统天下`,
    });
    return result;
  }

  const liveCount = liveRuntimes.length;
  const occupiedRatio = occupied / landProvinceCount;
  const largestFactionShare = Math.max(...liveRuntimes.map((r) => r.totalRegions)) / occupied;
  const tempo = getTempoConfig({ occupiedRatio, liveCount, largestFactionShare });
  const attempts = input.attemptsPerTick ?? tempo.attempts;
  const factionSummaryById = new Map(factions.map((faction) => [faction.id, faction]));
  const settlementByRegion = buildSettlementByRegion(input.settlements);
  const adminDistance = buildAdminDistanceState({
    map,
    factions,
    settlements: input.settlements,
  });
  const frontPressure = buildFrontPressureState({
    map,
    factions: liveRuntimes.map((runtime) => {
      const summary = factionSummaryById.get(runtime.id);
      return {
        id: runtime.id,
        regions: runtime.totalRegions,
        centroidRegionId: summary?.centroidRegionId ?? summary?.capitalRegionId ?? null,
      };
    }),
    ownedTargetPreference: tempo.ownedTargetPreference,
  });

  const ownerOf = (id: RegionId): FactionId | null => {
    const idNum = id as unknown as number;
    return getEffectiveOwner(map, ownerOverride, idNum);
  };

  for (let i = 0; i < attempts; i++) {
    const attackersWithBorder: FactionRuntime[] = [];
    for (const r of liveRuntimes) {
      if (r.totalRegions > 0 && r.border.size > 0) attackersWithBorder.push(r);
    }
    if (attackersWithBorder.length === 0) break;

    const attacker = attackersWithBorder[Math.floor(rng.next() * attackersWithBorder.length)];
    const activeWarSource =
      input.activeWars && input.activeWars.length > 0
        ? pickWarfrontFromBorder(
            attacker.border,
            map,
            ownerOf,
            attacker.id,
            rng,
            input.activeWars,
          )
        : null;
    const preferOwnedTarget = rng.next() < tempo.ownedTargetPreference;
    const sourceRegionNum =
      activeWarSource ??
      (preferOwnedTarget
        ? (pickWarfrontFromBorder(attacker.border, map, ownerOf, attacker.id, rng) ??
          pickFromSet(attacker.border, rng))
        : pickFromSet(attacker.border, rng));
    if (sourceRegionNum == null) continue;
    const sourceProvince = map.provinces[sourceRegionNum];
    if (!sourceProvince || sourceProvince.neighbors.length === 0) continue;

    const enemyNeighbors: RegionId[] = [];
    const neutralNeighbors: Array<{ region: RegionId; weight: number }> = [];
    const ownedEnemyNeighbors: Array<{ region: RegionId; weight: number }> = [];
    for (const nid of sourceProvince.neighbors) {
      const targetNum = nid as unknown as number;
      const targetProv = map.provinces[targetNum];
      // 海洋州不可扩张
      if (targetProv?.terrain === 'ocean') continue;
      const owner = ownerOf(nid);
      if (owner === attacker.id) continue;
      if (owner != null && input.activeWars && !isActiveWarPair(input.activeWars, attacker.id, owner)) continue;
      enemyNeighbors.push(nid);
      if (owner == null) {
        neutralNeighbors.push({
          region: nid,
          weight: getNeutralExpansionWeight(map, adminDistance, attacker, sourceRegionNum, nid),
        });
      } else {
        const defender = runtimeById.get(owner);
        const strength = defender?.totalRegions ?? 1;
        const targetSettlement = getHostileSettlementAtRegion(settlementByRegion, targetNum, owner);
        ownedEnemyNeighbors.push({
          region: nid,
          weight:
            (1 / (strength + 1)) *
            getDefenderPressureTargetWeight(frontPressure, owner) *
            getActiveWarTargetWeight(input.activeWars, attacker.id, owner) *
            getSettlementWarTargetWeight(targetSettlement) *
            getStrategicWarTargetWeight(targetProv),
        });
      }
    }
    if (enemyNeighbors.length === 0) {
      // 源州其实已被己方包围（可能因为本 tick 内已扩张）→ 修正其 border 标记
      attacker.border.delete(sourceRegionNum);
      continue;
    }

    const targetRegion =
      activeWarSource != null && ownedEnemyNeighbors.length > 0
        ? pickWeightedRegion(ownedEnemyNeighbors, rng)
        : neutralNeighbors.length > 0
          ? pickWeightedRegion(neutralNeighbors, rng)
          : preferOwnedTarget && ownedEnemyNeighbors.length > 0
            ? pickWeightedRegion(ownedEnemyNeighbors, rng)
            : enemyNeighbors[Math.floor(rng.next() * enemyNeighbors.length)];
    const targetRegionNum = targetRegion as unknown as number;
    const targetProvince = map.provinces[targetRegionNum];
    if (!targetProvince) continue;

    const defenderId = ownerOf(targetRegion);

    if (defenderId == null) {
      const settleChance = getNeutralExpansionChance(map, adminDistance, attacker, sourceRegionNum, targetRegion);
      if (rng.next() >= settleChance) continue;
      applyOwnerChange(map, runtimeById, ownerOverride, targetRegion, attacker.id);
      result.patches.push({
        regionId: targetRegion,
        fromOwnerId: null,
        toOwnerId: attacker.id,
        tick,
      });
      result.events.push({
        tick,
        type: 'capture',
        regionId: targetRegion,
        attackerId: attacker.id,
        defenderId: null,
        message: `${attacker.name} 占领无主之地 #${targetRegion}`,
      });
      continue;
    }

    if (defenderId === attacker.id) continue;

    const defender = runtimeById.get(defenderId);
    const defenderRegions = defender?.totalRegions ?? 1;
    const baseProb = TERRAIN_ATTACK_PROB[targetProvince.terrain];
    const targetSettlement = getHostileSettlementAtRegion(
      settlementByRegion,
      targetRegionNum,
      defenderId,
    );
    const siegeMomentum = getSiegeMomentum({
      wars: input.activeWars,
      attackerId: attacker.id,
      defenderId,
      tick,
      targetSettlement,
    });
    const settlementSiegeReady = hasPersistentSettlementSiegeAtThreshold({
      wars: input.activeWars,
      attackerId: attacker.id,
      defenderId,
      targetSettlement,
      threshold: SETTLEMENT_SIEGE_CAPTURE_THRESHOLD,
    });
    const settlementFortificationPenalty = getSettlementFortificationPenalty(
      targetSettlement,
      siegeMomentum,
    );
    // 河流跨越惩罚：如果源州和目标州之间的边界边是河流州，则降低胜率
    const riverCrossingPenalty = computeRiverCrossingPenalty(map, sourceRegionNum, targetRegionNum);
    const geographicPenalty = getGeographicCombatPenalty(targetProvince);
    const strategicProfile = computeRegionStrategicProfile(targetProvince);
    const pressure = resolveFrontBattlePressure({
      state: frontPressure,
      map,
      attackerId: attacker.id,
      defenderId,
      targetRegion,
      ownerOf,
    });
    const collapseBias = getSmallRealmCollapseBias(occupiedRatio, defenderRegions);
    const capitalShockBias = getCapitalShockAttackBias({
      wars: input.activeWars,
      attackerId: attacker.id,
      defenderId,
      tick,
    });
    const adminSupport = getAdminSupport({
      state: adminDistance,
      faction: attacker.summary,
      sourceRegionId: sourceRegionNum,
    });
    const combatAdminPenalty = adminSupport.totalPenalty * WAR_ADMIN_PENALTY_SCALE;
    const winProb = clamp01(
      baseProb +
        pressure.frontBias +
        pressure.localSurroundBias +
        collapseBias +
        capitalShockBias -
        pressure.multiFrontPenalty -
        riverCrossingPenalty -
        geographicPenalty -
        combatAdminPenalty -
        settlementFortificationPenalty,
    );
    const combatDetail = formatCombatDetail({
      terrain: targetProvince.terrain,
      baseProb,
      pressure,
      collapseBias,
      capitalShockBias,
      adminPenalty: combatAdminPenalty,
      geographicPenalty,
      travelCost: strategicProfile.travelCost,
      strategicValue: strategicProfile.strategicValue,
      adminDistance: adminSupport.distance,
      settlementCount: adminSupport.settlementCount,
      settlementTarget: targetSettlement,
      siegeMomentum,
      settlementFortificationPenalty,
      winProb,
      attackerRegions: attacker.totalRegions,
      defenderRegions,
      occupiedRatio,
      ownedTargetPreference: tempo.ownedTargetPreference,
      tempoLabel: tempo.label,
    });

    if (rng.next() < winProb || settlementSiegeReady) {
      applyOwnerChange(map, runtimeById, ownerOverride, targetRegion, attacker.id);
      const defenderName = defender ? defender.name : '敌方';
      result.patches.push({
        regionId: targetRegion,
        fromOwnerId: defenderId,
        toOwnerId: attacker.id,
        tick,
      });
      result.events.push({
        tick,
        type: 'capture',
        regionId: targetRegion,
        attackerId: attacker.id,
        defenderId,
        message: `${attacker.name} 攻陷 ${defenderName} 控制的 #${targetRegion}（${combatDetail}）`,
      });

      if (defender && defender.totalRegions <= 0) {
        result.events.push({
          tick,
          type: 'eliminate',
          regionId: null,
          attackerId: attacker.id,
          defenderId,
          message: `${defender.name} 已被 ${attacker.name} 消灭（最后失守 #${targetRegion}；${combatDetail}）`,
        });
      }
    } else {
      const defenderName = defender ? defender.name : '敌方';
      result.events.push({
        tick,
        type: 'repel',
        regionId: targetRegion,
        attackerId: attacker.id,
        defenderId,
        message: `${attacker.name} 攻击 #${targetRegion} 失利，被 ${defenderName} 击退（${combatDetail}）`,
      });
    }
  }

  // 终局检测
  const aliveAfter = Array.from(runtimeById.values()).filter((r) => r.totalRegions > 0);
  const occupiedFinal = aliveAfter.reduce((s, r) => s + r.totalRegions, 0);
  if (aliveAfter.length === 1 && occupiedFinal >= landProvinces.length) {
    result.events.push({
      tick,
      type: 'victory',
      regionId: null,
      attackerId: aliveAfter[0].id,
      defenderId: null,
      message: `${aliveAfter[0].name} 一统天下`,
    });
  } else if (aliveAfter.length === 1 && result.patches.length === 0) {
    const lonely = aliveAfter[0];
    if (lonely.border.size === 0) {
      result.events.push({
        tick,
        type: 'stalemate',
        regionId: null,
        attackerId: lonely.id,
        defenderId: null,
        message: `${lonely.name} 已无可扩张方向，进入僵局`,
      });
    }
  } else if (
    aliveAfter.length >= 2 &&
    result.patches.length === 0 &&
    aliveAfter.every((r) => r.border.size === 0)
  ) {
    result.events.push({
      tick,
      type: 'stalemate',
      regionId: null,
      attackerId: null,
      defenderId: null,
      message: '各方势力互相封锁，进入僵局',
    });
  }

  if (import.meta.env?.DEV) {
    assertContiguous(map, ownerOverride);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Frontline 维护                                                      */
/* ------------------------------------------------------------------ */

function buildRuntimes(map: MapData, factions: FactionSummary[]): Map<FactionId, FactionRuntime> {
  const runtimeById = new Map<FactionId, FactionRuntime>();
  for (const f of factions) {
    runtimeById.set(f.id, {
      id: f.id,
      name: f.name,
      border: new Set<number>(),
      totalRegions: 0,
      anchorRegionId: pickFactionAnchor(map, f),
      anchorPoint: null,
      summary: f,
    });
  }
  for (const runtime of runtimeById.values()) {
    runtime.anchorPoint =
      runtime.anchorRegionId == null
        ? null
        : (map.provinces[runtime.anchorRegionId as unknown as number]?.centroid ?? null);
  }
  const activeRegionIdsByFaction = new Map<FactionId, Set<number>>();
  for (const runtime of runtimeById.values()) {
    const components = collectOwnedComponents(
      map,
      (id) => map.provinces[id]?.ownerFactionId ?? null,
      runtime.id,
    );
    const active = components.length > 0 ? pickPrimaryComponent(components, runtime.anchorRegionId) : [];
    activeRegionIdsByFaction.set(runtime.id, new Set(active));
  }
  for (const province of map.provinces) {
    if (province.terrain === 'ocean') continue;
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    const r = runtimeById.get(owner);
    if (!r) continue;
    r.totalRegions += 1;
    const activeRegionIds = activeRegionIdsByFaction.get(owner);
    if (!activeRegionIds?.has(province.id as unknown as number)) continue;
    let isBorder = false;
    for (const nid of province.neighbors) {
      const neighbor = map.provinces[nid as unknown as number];
      if (!neighbor || neighbor.terrain === 'ocean') continue;
      if (neighbor.ownerFactionId !== owner) {
        isBorder = true;
        break;
      }
    }
    if (isBorder) r.border.add(province.id as unknown as number);
  }
  return runtimeById;
}

/**
 * 单州 owner 变更后，仅对「该州 + 它的邻居」做边界状态局部刷新。
 */
function applyOwnerChange(
  map: MapData,
  runtimeById: Map<FactionId, FactionRuntime>,
  ownerOverride: Map<number, FactionId | null>,
  regionId: RegionId,
  newOwner: FactionId | null,
): void {
  const idNum = regionId as unknown as number;
  const prevOwner = getEffectiveOwner(map, ownerOverride, idNum);

  if (prevOwner === newOwner) return;
  ownerOverride.set(idNum, newOwner);

  const prevRuntime = prevOwner != null ? runtimeById.get(prevOwner) : null;
  const nextRuntime = newOwner != null ? runtimeById.get(newOwner) : null;

  if (prevRuntime) {
    prevRuntime.totalRegions -= 1;
    prevRuntime.border.delete(idNum);
  }
  if (nextRuntime) {
    nextRuntime.totalRegions += 1;
  }

  const ownerOf = (id: number): FactionId | null => {
    return getEffectiveOwner(map, ownerOverride, id);
  };

  // 对 region 自身重新评估边界状态
  refreshBorderState(map, runtimeById, ownerOf, idNum);
  // 邻居中：先前与 prevOwner 同色 / 现在与 newOwner 同色 的州，可能边界状态变化
  const province = map.provinces[idNum];
  if (province) {
    for (const nid of province.neighbors) {
      refreshBorderState(map, runtimeById, ownerOf, nid as unknown as number);
    }
  }
}

function refreshBorderState(
  map: MapData,
  runtimeById: Map<FactionId, FactionRuntime>,
  ownerOf: (id: number) => FactionId | null,
  idNum: number,
): void {
  const province = map.provinces[idNum];
  if (!province || province.terrain === 'ocean') {
    for (const r of runtimeById.values()) r.border.delete(idNum);
    return;
  }
  const owner = ownerOf(idNum);
  if (owner == null) {
    // 无主州不会进任何 border 集合
    for (const r of runtimeById.values()) r.border.delete(idNum);
    return;
  }
  let isBorder = false;
  for (const nid of province.neighbors) {
    const neighbor = map.provinces[nid as unknown as number];
    if (!neighbor || neighbor.terrain === 'ocean') continue;
    if (ownerOf(nid as unknown as number) !== owner) {
      isBorder = true;
      break;
    }
  }
  for (const r of runtimeById.values()) {
    if (r.id !== owner) r.border.delete(idNum);
  }
  const r = runtimeById.get(owner);
  if (!r) return;
  if (isBorder) r.border.add(idNum);
  else r.border.delete(idNum);
}

function collectOwnedComponents(
  map: MapData,
  ownerOf: (id: number) => FactionId | null,
  factionId: FactionId,
): number[][] {
  const seen = new Uint8Array(map.provinces.length);
  const components: number[][] = [];

  for (const province of map.provinces) {
    const start = province.id as unknown as number;
    if (seen[start] || province.terrain === 'ocean' || ownerOf(start) !== factionId) continue;

    const component: number[] = [];
    const stack = [start];
    seen[start] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      component.push(current);
      const currentProvince = map.provinces[current];
      if (!currentProvince) continue;

      for (const neighborId of currentProvince.neighbors) {
        const neighbor = neighborId as unknown as number;
        const neighborProvince = map.provinces[neighbor];
        if (
          !neighborProvince ||
          seen[neighbor] ||
          neighborProvince.terrain === 'ocean' ||
          ownerOf(neighbor) !== factionId
        ) {
          continue;
        }
        seen[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

function pickPrimaryComponent(components: number[][], anchorRegionId: RegionId | null): number[] {
  if (anchorRegionId != null) {
    const anchor = anchorRegionId as unknown as number;
    const anchored = components.find((component) => component.includes(anchor));
    if (anchored) return anchored;
  }
  return components.reduce((best, component) => (component.length > best.length ? component : best));
}

/* ------------------------------------------------------------------ */
/* dev-only：飞地校验                                                   */
/* ------------------------------------------------------------------ */

/**
 * 模块级状态：记录上一次 assertContiguous 看到的每势力连通分量数。
 * 仅当当前 tick 的分量数 > 上一次记录时才 warn，避免「基线就有的飞地」
 * 或「海岛剧本」每 tick 刷屏。
 *
 * 重置时机由调用方负责：剧本切换 / 地图重建 / Replay 重建 → resetContiguityWatch。
 */
const lastComponentByFaction = new Map<FactionId, number>();

export function resetContiguityWatch(): void {
  lastComponentByFaction.clear();
}

/**
 * 扩张沿邻居推进仍可能在攻陷瓶颈州时切开防守方领土。
 * tick 内不改写飞地 owner；断开的非主连通块只会在 runtime 中失去扩张资格。
 * 这里保留 dev 防御性断言：
 * 若仍发现某势力当前的连通分量数比上一次记录更多，向 console 报警一次。
 */
export function assertContiguous(map: MapData, ownerOverride: Map<number, FactionId | null>): void {
  const ownerOf = (id: number): FactionId | null => {
    return getEffectiveOwner(map, ownerOverride, id);
  };
  const seen = new Uint8Array(map.provinces.length);
  const componentByFaction = new Map<FactionId, number>();
  for (const province of map.provinces) {
    const idNum = province.id as unknown as number;
    if (seen[idNum]) continue;
    const owner = ownerOf(idNum);
    if (owner == null) {
      seen[idNum] = 1;
      continue;
    }
    // BFS 标记本连通分量
    const stack: number[] = [idNum];
    seen[idNum] = 1;
    while (stack.length > 0) {
      const cur = stack.pop() as number;
      const curProv = map.provinces[cur];
      if (!curProv) continue;
      for (const nid of curProv.neighbors) {
        const nNum = nid as unknown as number;
        if (seen[nNum]) continue;
        if (ownerOf(nNum) !== owner) continue;
        seen[nNum] = 1;
        stack.push(nNum);
      }
    }
    const prev = componentByFaction.get(owner) ?? 0;
    componentByFaction.set(owner, prev + 1);
  }
  for (const [factionId, count] of componentByFaction.entries()) {
    const prev = lastComponentByFaction.get(factionId) ?? 1;
    if (count > prev) {
      console.warn(
        `[worldsim] faction ${factionId as unknown as number} 连通分量 ${prev} → ${count}（疑似新增飞地）`,
      );
    }
    lastComponentByFaction.set(factionId, count);
  }
  // 已被消灭的势力清掉记录，下次再出现飞地仍能 warn 一次
  for (const factionId of Array.from(lastComponentByFaction.keys())) {
    if (!componentByFaction.has(factionId)) {
      lastComponentByFaction.delete(factionId);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 辅助                                                                */
/* ------------------------------------------------------------------ */

function pickWarfrontFromBorder(
  border: Set<number>,
  map: MapData,
  ownerOf: (id: RegionId) => FactionId | null,
  attackerId: FactionId,
  rng: RandomSource,
  activeWars?: readonly WarSummary[],
): number | null {
  const candidates: number[] = [];
  for (const sourceRegionNum of border) {
    const sourceProvince = map.provinces[sourceRegionNum];
    if (!sourceProvince) continue;
    for (const nid of sourceProvince.neighbors) {
      const owner = ownerOf(nid);
      if (owner != null && owner !== attackerId && (!activeWars || isActiveWarPair(activeWars, attackerId, owner))) {
        candidates.push(sourceRegionNum);
        break;
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng.next() * candidates.length)];
}

function getNeutralExpansionWeight(
  map: MapData,
  adminDistance: AdminDistanceState,
  attacker: FactionRuntime,
  sourceRegionNum: number,
  targetRegion: RegionId,
): number {
  return Math.max(0.05, getNeutralExpansionChance(map, adminDistance, attacker, sourceRegionNum, targetRegion));
}

function getNeutralExpansionChance(
  map: MapData,
  adminDistance: AdminDistanceState,
  attacker: FactionRuntime,
  sourceRegionNum: number,
  targetRegion: RegionId,
): number {
  if (attacker.totalRegions <= HOMELAND_GRACE_REGION_COUNT) {
    return NEUTRAL_EXPANSION_MAX_CHANCE;
  }

  const targetProvince = map.provinces[targetRegion as unknown as number];
  if (!targetProvince) return NEUTRAL_EXPANSION_MIN_CHANCE;

  const mapDiagonal = Math.max(1, Math.hypot(map.meta.bounds.width, map.meta.bounds.height));
  const coreDistanceRatio =
    attacker.anchorPoint == null
      ? 0
      : distance(attacker.anchorPoint, targetProvince.centroid) / mapDiagonal;
  const distancePressure = smoothstep(
    CORE_DISTANCE_PRESSURE_START,
    CORE_DISTANCE_PRESSURE_FULL,
    coreDistanceRatio,
  );
  const borderPressure = smoothstep(
    BORDER_PRESSURE_START,
    BORDER_PRESSURE_FULL,
    attacker.border.size,
  );
  const adminSupport = getAdminSupport({
    state: adminDistance,
    faction: attacker.summary,
    sourceRegionId: sourceRegionNum,
  });
  const terrainPenalty = getNeutralTerrainPenalty(targetProvince.terrain);

  return clamp(
    NEUTRAL_EXPANSION_MAX_CHANCE -
      distancePressure * NEUTRAL_DISTANCE_PENALTY_MAX -
      borderPressure * NEUTRAL_BORDER_PENALTY_MAX -
      adminSupport.totalPenalty -
      terrainPenalty,
    NEUTRAL_EXPANSION_MIN_CHANCE,
    NEUTRAL_EXPANSION_MAX_CHANCE,
  );
}

function getNeutralTerrainPenalty(terrain: string): number {
  switch (terrain) {
    case 'mountain':
      return 0.12;
    case 'desert':
      return 0.08;
    case 'river':
      return 0.04;
    case 'forest':
      return 0.03;
    default:
      return 0;
  }
}

function buildSettlementByRegion(
  settlements: readonly SettlementSummary[] | undefined,
): Map<number, SettlementSummary> {
  const out = new Map<number, SettlementSummary>();
  for (const settlement of settlements ?? []) {
    out.set(settlement.regionId as unknown as number, settlement);
  }
  return out;
}

function getHostileSettlementAtRegion(
  settlementByRegion: ReadonlyMap<number, SettlementSummary>,
  regionNum: number,
  defenderId: FactionId,
): SettlementSummary | null {
  const settlement = settlementByRegion.get(regionNum);
  return settlement?.factionId === defenderId ? settlement : null;
}

function getSettlementWarTargetWeight(settlement: SettlementSummary | null): number {
  if (!settlement) return 1;
  return SETTLEMENT_TARGET_WEIGHT[settlement.tier] ?? 1;
}

function getSettlementFortificationPenalty(
  settlement: SettlementSummary | null,
  siegeMomentum: number,
): number {
  if (!settlement) return 0;
  const base = SETTLEMENT_FORTIFICATION_PENALTY[settlement.tier] ?? 0;
  return base * (1 - siegeMomentum * SIEGE_MOMENTUM_FORTIFICATION_REDUCTION);
}

function getSiegeMomentum(input: {
  wars: readonly WarSummary[] | undefined;
  attackerId: FactionId;
  defenderId: FactionId;
  tick: Tick;
  targetSettlement: SettlementSummary | null;
}): number {
  if (!input.targetSettlement || !input.wars) return 0;
  const war = input.wars.find(
    (item) =>
      item.status === 'active' &&
      ((item.attackerFactionId === input.attackerId && item.defenderFactionId === input.defenderId) ||
        (item.attackerFactionId === input.defenderId && item.defenderFactionId === input.attackerId)),
  );
  if (!war) return 0;
  const persisted = war.siegeProgress?.find(
    (item) =>
      item.settlementId === input.targetSettlement?.id &&
      item.regionId === input.targetSettlement.regionId &&
      item.attackerFactionId === input.attackerId &&
      item.defenderFactionId === input.defenderId,
  );
  if (persisted) return clamp(persisted.progress, 0, 1);
  const elapsed = (input.tick as unknown as number) - (war.startedTick as unknown as number);
  return smoothstep(SIEGE_MOMENTUM_START_TICKS, SIEGE_MOMENTUM_FULL_TICKS, elapsed);
}

function hasPersistentSettlementSiegeAtThreshold(input: {
  wars: readonly WarSummary[] | undefined;
  attackerId: FactionId;
  defenderId: FactionId;
  targetSettlement: SettlementSummary | null;
  threshold: number;
}): boolean {
  if (!input.targetSettlement || !input.wars) return false;
  return input.wars.some(
    (war) =>
      war.status === 'active' &&
      ((war.attackerFactionId === input.attackerId && war.defenderFactionId === input.defenderId) ||
        (war.attackerFactionId === input.defenderId && war.defenderFactionId === input.attackerId)) &&
      (war.siegeProgress ?? []).some(
        (progress) =>
          progress.settlementId === input.targetSettlement?.id &&
          progress.regionId === input.targetSettlement.regionId &&
          progress.attackerFactionId === input.attackerId &&
          progress.defenderFactionId === input.defenderId &&
          progress.progress >= input.threshold,
      ),
  );
}

function getCapitalShockAttackBias(input: {
  wars: readonly WarSummary[] | undefined;
  attackerId: FactionId;
  defenderId: FactionId;
  tick: Tick;
}): number {
  if (!input.wars) return 0;
  const hasShock = input.wars.some(
    (war) =>
      war.status === 'active' &&
      ((war.attackerFactionId === input.attackerId && war.defenderFactionId === input.defenderId) ||
        (war.attackerFactionId === input.defenderId && war.defenderFactionId === input.attackerId)) &&
      (war.capitalShocks ?? []).some(
        (shock) =>
          shock.factionId === input.defenderId &&
          (shock.untilTick as unknown as number) >= (input.tick as unknown as number),
      ),
  );
  return hasShock ? CAPITAL_SHOCK_ATTACK_BIAS : 0;
}

function getEffectiveOwner(
  map: MapData,
  ownerOverride: Map<number, FactionId | null>,
  idNum: number,
): FactionId | null {
  const province = map.provinces[idNum];
  if (!province || province.terrain === 'ocean') return null;
  if (ownerOverride.has(idNum)) return ownerOverride.get(idNum) ?? null;
  return province.ownerFactionId ?? null;
}

function pickFactionAnchor(map: MapData, faction: FactionSummary): RegionId | null {
  const candidates = [
    faction.capitalRegionId,
    faction.centroidRegionId,
    faction.birthRegionId,
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const province = map.provinces[candidate as unknown as number];
    if (province && province.terrain !== 'ocean' && province.ownerFactionId === faction.id) {
      return candidate;
    }
  }

  return null;
}

function formatCombatDetail(input: {
  terrain: string;
  baseProb: number;
  pressure: FrontBattlePressure;
  collapseBias: number;
  capitalShockBias: number;
  adminPenalty: number;
  geographicPenalty: number;
  travelCost: number;
  strategicValue: number;
  adminDistance: number | null;
  settlementCount: number;
  settlementTarget: SettlementSummary | null;
  siegeMomentum: number;
  settlementFortificationPenalty: number;
  winProb: number;
  attackerRegions: number;
  defenderRegions: number;
  occupiedRatio: number;
  ownedTargetPreference: number;
  tempoLabel: string;
}): string {
  const adminDistanceText = input.adminDistance == null ? '断' : String(input.adminDistance);
  const details = [
    `阶段=${input.tempoLabel}`,
    `地形=${input.terrain}`,
    `胜率=${formatPercent(input.winProb)}`,
    `基础=${formatPercent(input.baseProb)}`,
    `地利=-${formatPercent(input.geographicPenalty)}`,
    `通行=${input.travelCost.toFixed(1)}`,
    `战略=${formatPercent(input.strategicValue)}`,
    `前线=${input.pressure.frontBias >= 0 ? '+' : ''}${formatPercent(input.pressure.frontBias)}`,
    `兵力=${Math.round(input.pressure.attackerPower)}:${Math.round(input.pressure.defenderPower)}`,
    `补给=${formatPercent(input.pressure.attackerSupply)}`,
    `多线=-${formatPercent(input.pressure.multiFrontPenalty)}`,
    `合围=${input.pressure.localSurroundBias >= 0 ? '+' : ''}${formatPercent(input.pressure.localSurroundBias)}`,
    `残局=${formatPercent(input.collapseBias)}`,
    `行政=-${formatPercent(input.adminPenalty)}`,
    `聚落=${input.settlementCount}`,
    `距城=${adminDistanceText}`,
  ];
  if (input.capitalShockBias > 0) {
    details.push(`都城震荡=+${formatPercent(input.capitalShockBias)}`);
  }
  if (input.settlementTarget) {
    details.push(
      `目标=${formatSettlementTier(input.settlementTarget.tier)}`,
      `围城=${formatPercent(input.siegeMomentum)}`,
      `城防=-${formatPercent(input.settlementFortificationPenalty)}`,
    );
  }
  details.push(
    `州数=${input.attackerRegions}:${input.defenderRegions}`,
    `前线数=${input.pressure.attackerFrontCount}:${input.pressure.defenderFrontCount}`,
    `占领率=${formatPercent(input.occupiedRatio)}`,
    `战争偏好=${formatPercent(input.ownedTargetPreference)}`,
  );
  return details.join('，');
}

function formatSettlementTier(tier: SettlementSummary['tier']): string {
  switch (tier) {
    case 'capital':
      return '都城';
    case 'city':
      return '城市';
    case 'town':
      return '城镇';
    case 'village':
      return '村庄';
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pickWeightedRegion(
  targets: Array<{ region: RegionId; weight: number }>,
  rng: RandomSource,
): RegionId {
  const totalWeight = targets.reduce((sum, target) => sum + target.weight, 0);
  let cursor = rng.next() * totalWeight;
  for (const target of targets) {
    cursor -= target.weight;
    if (cursor <= 0) return target.region;
  }
  return targets[targets.length - 1].region;
}

function pickFromSet(set: Set<number>, rng: RandomSource): number | null {
  const size = set.size;
  if (size === 0) return null;
  const target = Math.floor(rng.next() * size);
  let i = 0;
  for (const v of set) {
    if (i === target) return v;
    i++;
  }
  return null;
}

function clamp01(v: number): number {
  if (v < 0.02) return 0.02;
  if (v > 0.98) return 0.98;
  return v;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 河流跨越惩罚：检查源州和目标州之间的共享边界边，
 * 如果任一侧的州是 river 地形，则返回惩罚值（降低进攻胜率）。
 * 模拟渡河作战的难度。
 */
function computeRiverCrossingPenalty(map: MapData, sourceId: number, targetId: number): number {
  const source = map.provinces[sourceId];
  const target = map.provinces[targetId];
  if (!source || !target) return 0;

  // 检查源州和目标州是否都是 river 地形
  const sourceIsRiver = source.terrain === 'river';
  const targetIsRiver = target.terrain === 'river';

  // 跨越河流边界时施加惩罚
  if (sourceIsRiver || targetIsRiver) {
    return 0.12; // 渡河作战，攻方胜率降低 12%
  }

  return 0;
}
