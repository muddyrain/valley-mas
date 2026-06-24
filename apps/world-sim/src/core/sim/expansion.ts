import type { MapData } from '@/core/map';
import type { RandomSource } from '@/shared/math';
import type { FactionId, FactionSummary, RegionId, Tick } from '@/shared/types';
import { strengthBias, TERRAIN_ATTACK_PROB } from './terrainCombat';
import type { SimTickResult } from './types';

export interface RunExpansionTickInput {
  tick: Tick;
  map: MapData;
  factions: FactionSummary[];
  rng: RandomSource;
  /** 每 tick 进行的扩张尝试次数；默认 clamp(势力数*8, 20, 50) */
  attemptsPerTick?: number;
}

interface FactionRuntime {
  id: FactionId;
  name: string;
  /** 边界州集合（自己拥有，且至少一个邻居非己方） */
  border: Set<number>;
  totalRegions: number;
}

/**
 * 单步扩张内核（Phase 8.5 Frontline 重构）。
 *
 * 与旧版的差别：
 *   - 不再每次 attempt 全表 refreshSnapshotBorders；
 *   - 维护每势力的 border Set<RegionId>，每次 owner 变更只对「该州 + 邻居」做局部 patch；
 *   - 默认 attemptsPerTick 从 ceil(N/2) 升到 clamp(N*8, 20, 50)，把 3000 州地图打热。
 *   - 仍保持纯函数：不读 store、不写 store、不依赖渲染。
 */
export function runExpansionTick(input: RunExpansionTickInput): SimTickResult {
  const { tick, map, factions, rng } = input;

  const runtimeById = buildRuntimes(map, factions);
  const liveRuntimes = Array.from(runtimeById.values()).filter((r) => r.totalRegions > 0);

  const result: SimTickResult = { patches: [], events: [] };

  if (liveRuntimes.length === 0) {
    return result;
  }

  const occupied = liveRuntimes.reduce((sum, r) => sum + r.totalRegions, 0);
  if (liveRuntimes.length === 1 && occupied === map.provinces.length) {
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
  const attempts = input.attemptsPerTick ?? clamp(liveCount * 8, 20, 50);

  // ownerOverride：tick 内累计的 owner 变更，下一个 attempt 看到的就是「本 tick 已变后」的视图
  const ownerOverride = new Map<number, FactionId | null>();
  const ownerOf = (id: RegionId): FactionId | null => {
    const idNum = id as unknown as number;
    if (ownerOverride.has(idNum)) return ownerOverride.get(idNum) ?? null;
    return map.provinces[idNum]?.ownerFactionId ?? null;
  };

  for (let i = 0; i < attempts; i++) {
    const attackersWithBorder: FactionRuntime[] = [];
    for (const r of liveRuntimes) {
      if (r.totalRegions > 0 && r.border.size > 0) attackersWithBorder.push(r);
    }
    if (attackersWithBorder.length === 0) break;

    const attacker = attackersWithBorder[Math.floor(rng.next() * attackersWithBorder.length)];
    const sourceRegionNum = pickFromSet(attacker.border, rng);
    if (sourceRegionNum == null) continue;
    const sourceProvince = map.provinces[sourceRegionNum];
    if (!sourceProvince || sourceProvince.neighbors.length === 0) continue;

    const enemyNeighbors: RegionId[] = [];
    for (const nid of sourceProvince.neighbors) {
      if (ownerOf(nid) !== attacker.id) enemyNeighbors.push(nid);
    }
    if (enemyNeighbors.length === 0) {
      // 源州其实已被己方包围（可能因为本 tick 内已扩张）→ 修正其 border 标记
      attacker.border.delete(sourceRegionNum);
      continue;
    }

    const targetRegion = enemyNeighbors[Math.floor(rng.next() * enemyNeighbors.length)];
    const targetRegionNum = targetRegion as unknown as number;
    const targetProvince = map.provinces[targetRegionNum];
    if (!targetProvince) continue;

    const defenderId = ownerOf(targetRegion);

    if (defenderId == null) {
      // 空州：必占
      applyOwnerChange(map, runtimeById, ownerOverride, targetRegion, attacker.id);
      result.patches.push({
        regionId: targetRegion,
        fromOwnerId: null,
        toOwnerId: attacker.id,
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
    const baseProb = TERRAIN_ATTACK_PROB[targetProvince.terrain];
    const bias = strengthBias(attacker.totalRegions, defender?.totalRegions ?? 1);
    const winProb = clamp01(baseProb + bias);

    if (rng.next() < winProb) {
      applyOwnerChange(map, runtimeById, ownerOverride, targetRegion, attacker.id);
      const defenderName = defender ? defender.name : '敌方';
      result.patches.push({
        regionId: targetRegion,
        fromOwnerId: defenderId,
        toOwnerId: attacker.id,
      });
      result.events.push({
        tick,
        type: 'capture',
        regionId: targetRegion,
        attackerId: attacker.id,
        defenderId,
        message: `${attacker.name} 攻陷 ${defenderName} 控制的 #${targetRegion}`,
      });

      if (defender && defender.totalRegions <= 0) {
        result.events.push({
          tick,
          type: 'eliminate',
          regionId: null,
          attackerId: attacker.id,
          defenderId,
          message: `${defender.name} 已被消灭`,
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
        message: `${attacker.name} 攻击 #${targetRegion} 失利，被 ${defenderName} 击退`,
      });
    }
  }

  // 终局检测
  const aliveAfter = Array.from(runtimeById.values()).filter((r) => r.totalRegions > 0);
  const occupiedFinal = aliveAfter.reduce((s, r) => s + r.totalRegions, 0);
  if (aliveAfter.length === 1 && occupiedFinal === map.provinces.length) {
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
    });
  }
  for (const province of map.provinces) {
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    const r = runtimeById.get(owner);
    if (!r) continue;
    r.totalRegions += 1;
    let isBorder = false;
    for (const nid of province.neighbors) {
      if (map.provinces[nid as unknown as number]?.ownerFactionId !== owner) {
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
  const prevOwner: FactionId | null = ownerOverride.has(idNum)
    ? (ownerOverride.get(idNum) ?? null)
    : (map.provinces[idNum]?.ownerFactionId ?? null);

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
    if (ownerOverride.has(id)) return ownerOverride.get(id) ?? null;
    return map.provinces[id]?.ownerFactionId ?? null;
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
  if (!province) return;
  const owner = ownerOf(idNum);
  if (owner == null) {
    // 无主州不会进任何 border 集合
    for (const r of runtimeById.values()) r.border.delete(idNum);
    return;
  }
  let isBorder = false;
  for (const nid of province.neighbors) {
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
 * 由于扩张内核只允许沿邻居推进，结构上不会产生飞地。这里只做 dev 防御性断言：
 * 若发现某势力当前的连通分量数比上一次记录更多，向 console 报警一次。
 */
export function assertContiguous(map: MapData, ownerOverride: Map<number, FactionId | null>): void {
  const ownerOf = (id: number): FactionId | null => {
    if (ownerOverride.has(id)) return ownerOverride.get(id) ?? null;
    return map.provinces[id]?.ownerFactionId ?? null;
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

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function clamp01(v: number): number {
  if (v < 0.02) return 0.02;
  if (v > 0.98) return 0.98;
  return v;
}
