import type { StateCreator } from 'zustand';
import type { SimEventType, SimStatus } from '@/core/sim';
import { runExpansionTick } from '@/core/sim';
import { createPrngFromSeed, type RandomSource } from '@/shared/math';
import type {
  FactionId,
  FactionSummary,
  LogEvent,
  LogEventCategory,
  LogEventLevel,
  ReplayFrame,
  ReplayPatch,
  ReplayRankingRow,
  SimMode,
  SimSpeedTier,
  Tick,
} from '@/shared/types';
import { asEventId, asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import { type LogSlice, MAX_LOG_ENTRIES } from './logSlice';
import type { MapSlice } from './mapSlice';
import type { ReplaySlice } from './replaySlice';

const SIM_LOG_LEVEL_BY_TYPE: Record<SimEventType, LogEventLevel> = {
  capture: 'battle',
  repel: 'battle',
  eliminate: 'system',
  victory: 'system',
  stalemate: 'system',
};

const SIM_LOG_CATEGORY_BY_TYPE: Record<SimEventType, LogEventCategory> = {
  capture: 'occupy',
  repel: 'repel',
  eliminate: 'eliminate',
  victory: 'victory',
  stalemate: 'stalemate',
};

export interface SimSlice {
  /** 当前 tick（占位/驱动器共用） */
  tick: Tick;
  /** 当前播放速度档位 */
  speed: SimSpeedTier;
  /** 是否暂停（独立于 speed，便于一键暂停/继续） */
  paused: boolean;
  /** Live 推演 vs Replay 回放 */
  mode: SimMode;
  /** 模拟运行状态机：idle / running / victory / stalemate */
  status: SimStatus;
  /** 胜利方 / 终局存活势力。仅在 victory / stalemate 时填充 */
  winnerFactionId: FactionId | null;
  /** 上一次内核 tick 触发的事件数；用于 LogPanel 简单的「忙碌指示」 */
  lastTickEventCount: number;
  /** 最近一次发布的快照版本号；Phase 5 用于通知渲染层「数据已变」 */
  snapshotVersion: number;

  setSpeed: (speed: SimSpeedTier) => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setMode: (mode: SimMode) => void;
  /** 调试用：手动推进 1 tick（即便处于 idle 也会驱动一次内核） */
  advanceTick: (n?: number) => void;
  /** 把 sim 切换到 running 状态。已有出生地的势力直接开打；否则也允许，等用户改局后再继续。 */
  startSim: () => void;
  /** 重置 tick / status / winner / paused，但保留地图与势力 */
  resetSim: () => void;
  /** 重置战局：清空地图所有占领、清势力出生信息，并复位 sim 状态机。势力定义本身保留 */
  resetBattle: () => void;
}

type Deps = SimSlice & MapSlice & FactionSlice & LogSlice & ReplaySlice;

export const createSimSlice: StateCreator<Deps, [], [], SimSlice> = (set, get) => {
  let logSeq = 1;

  const driveOneTick = (): void => {
    const state = get();
    if (state.status === 'victory' || state.status === 'stalemate') return;

    const map = state.map;
    if (!map) return;

    const factions = state.factions;
    const nextTick = asTick(state.tick + 1);

    const rng: RandomSource = createPrngFromSeed(`tick-${state.seed}-${nextTick}`);
    const result = runExpansionTick({
      tick: nextTick,
      map,
      factions,
      rng,
    });

    const newLogs: LogEvent[] = [];
    let nextStatus: SimStatus = state.status === 'idle' ? 'idle' : 'running';
    let winnerFactionId: FactionId | null = state.winnerFactionId;

    const factionNameById = new Map<FactionId, string>(
      factions.map((f: FactionSummary) => [f.id, f.name]),
    );

    const pushLog = (
      level: LogEventLevel,
      category: LogEventCategory,
      message: string,
      factionId: FactionId | null | undefined,
    ): void => {
      newLogs.push({
        id: asEventId(Date.now() * 1000 + logSeq++),
        tick: nextTick,
        level,
        category,
        message,
        factionId: factionId ?? undefined,
      });
    };

    for (const event of result.events) {
      const level = SIM_LOG_LEVEL_BY_TYPE[event.type];
      const category = SIM_LOG_CATEGORY_BY_TYPE[event.type];
      // 主条目：从攻方视角描述
      const primaryFactionId = event.attackerId ?? event.defenderId ?? null;
      pushLog(level, category, event.message, primaryFactionId);

      // 派生条目：capture 同时记一条「失地」（仅当原本有守方时；空州占领没有失地）
      if (event.type === 'capture' && event.defenderId != null) {
        const defenderName = factionNameById.get(event.defenderId) ?? '敌方';
        const attackerName =
          event.attackerId != null ? (factionNameById.get(event.attackerId) ?? '敌方') : '敌方';
        const regionRef = event.regionId == null ? '边境州' : `#${event.regionId}`;
        pushLog(
          'battle',
          'lose',
          `${defenderName} 失去 ${regionRef}（被 ${attackerName} 攻陷）`,
          event.defenderId,
        );
      }

      if (event.type === 'victory') {
        nextStatus = 'victory';
        winnerFactionId = event.attackerId;
      } else if (event.type === 'stalemate') {
        nextStatus = 'stalemate';
        winnerFactionId = event.attackerId;
      }
    }

    let nextMap = map;
    if (result.patches.length > 0) {
      nextMap = {
        ...map,
        provinces: map.provinces.map((p) => ({ ...p })),
      };
      for (const patch of result.patches) {
        const idx = patch.regionId as unknown as number;
        const province = nextMap.provinces[idx];
        if (province) province.ownerFactionId = patch.toOwnerId;
      }
    }

    // 重新统计每势力 region 数（在 patch 应用后）
    const regionsByFaction = new Map<FactionId, number>();
    for (const province of nextMap.provinces) {
      const owner = province.ownerFactionId;
      if (owner == null) continue;
      regionsByFaction.set(owner, (regionsByFaction.get(owner) ?? 0) + 1);
    }
    // Phase 8.5：刷新每势力的领土重心 + 必要时迁都
    const capitalsByFaction = computeCapitalsAndCentroids(nextMap, factions);
    const factionsNext = factions.map((f) => {
      const capInfo = capitalsByFaction.get(f.id);
      return {
        ...f,
        regions: regionsByFaction.get(f.id) ?? 0,
        capitalRegionId: capInfo ? capInfo.capital : f.capitalRegionId,
        centroidRegionId: capInfo ? capInfo.centroid : f.centroidRegionId,
      };
    });

    const logsNext = newLogs.length > 0 ? appendLogs(state.logs, newLogs) : state.logs;

    set({
      tick: nextTick,
      map: nextMap,
      factions: factionsNext,
      logs: logsNext,
      status: nextStatus,
      winnerFactionId,
      lastTickEventCount: result.events.length,
      snapshotVersion: state.snapshotVersion + 1,
    });

    // Phase 11：把本 tick 录入 replay。仅在录制模式下追加；回放模式期间 sim 已被外层暂停，不会进来。
    if (state.replayMode === 'recording') {
      const patches: ReplayPatch[] = result.patches.map((p) => ({
        regionId: p.regionId as unknown as number,
        from: p.fromOwnerId == null ? null : (p.fromOwnerId as unknown as number),
        to: p.toOwnerId == null ? null : (p.toOwnerId as unknown as number),
      }));
      const rankings: ReplayRankingRow[] = factionsNext.map((f) => ({
        factionId: f.id as unknown as number,
        regions: f.regions ?? 0,
      }));
      const frame: ReplayFrame = {
        tick: nextTick,
        patches,
        events: newLogs,
        rankings,
        status: nextStatus,
        winnerFactionId,
      };
      get().recordFrame(frame);
    }
  };

  return {
    tick: asTick(0),
    speed: '1x',
    paused: true,
    mode: 'live',
    status: 'idle',
    winnerFactionId: null,
    lastTickEventCount: 0,
    snapshotVersion: 0,

    setSpeed: (speed) =>
      set((s) => ({
        speed,
        paused: speed === 'paused',
        status: s.status === 'idle' && speed !== 'paused' ? 'running' : s.status,
      })),

    setPaused: (paused) => set({ paused }),

    togglePaused: () =>
      set((s) => {
        const next = !s.paused;
        return {
          paused: next,
          // 取消暂停时若速度档位是 paused，自动恢复到 1x，否则用户点了「继续」也不会推进
          speed: !next && s.speed === 'paused' ? '1x' : s.speed,
          status: s.status === 'idle' && !next ? 'running' : s.status,
        };
      }),

    setMode: (mode) => set({ mode }),

    advanceTick: (n = 1) => {
      for (let i = 0; i < Math.max(1, n); i++) {
        driveOneTick();
      }
    },

    startSim: () =>
      set((s) => ({
        status: s.status === 'victory' || s.status === 'stalemate' ? s.status : 'running',
        paused: false,
        speed: s.speed === 'paused' ? '1x' : s.speed,
      })),

    resetSim: () =>
      set({
        tick: asTick(0),
        speed: '1x',
        paused: true,
        mode: 'live',
        status: 'idle',
        winnerFactionId: null,
        lastTickEventCount: 0,
        snapshotVersion: 0,
      }),

    resetBattle: () => {
      const state = get();
      const map = state.map;
      const nextMap =
        map == null
          ? null
          : {
              ...map,
              provinces: map.provinces.map((p) => ({ ...p, ownerFactionId: null })),
            };
      const factionsNext = state.factions.map((f) => ({
        ...f,
        birthRegionId: null,
        capitalRegionId: null,
        centroidRegionId: null,
        regions: 0,
      }));
      set({
        ...(nextMap ? { map: nextMap } : {}),
        factions: factionsNext,
        tick: asTick(0),
        speed: '1x',
        paused: true,
        mode: 'live',
        status: 'idle',
        winnerFactionId: null,
        lastTickEventCount: 0,
        snapshotVersion: 0,
      });

      get().captureBaseline();
    },
  };
};

function appendLogs(prev: LogEvent[], next: LogEvent[]): LogEvent[] {
  const combined = prev.length + next.length;
  if (combined <= MAX_LOG_ENTRIES) {
    return [...prev, ...next];
  }
  const drop = combined - MAX_LOG_ENTRIES;
  return [...prev.slice(drop), ...next];
}

interface CapitalInfo {
  capital: import('@/shared/types').RegionId | null;
  centroid: import('@/shared/types').RegionId | null;
}

/**
 * Phase 8.5：在所有 patches 应用后，重新计算每势力的领土重心州；
 * 若当前 capital 不在己方掌控，则迁都至 centroid。无领土的势力保持原样。
 */
function computeCapitalsAndCentroids(
  map: import('@/core/map').MapData,
  factions: FactionSummary[],
): Map<FactionId, CapitalInfo> {
  const out = new Map<FactionId, CapitalInfo>();
  // 聚合 owned regions 的 centroid 平均
  const sumByFaction = new Map<FactionId, { x: number; y: number; count: number }>();
  const ownedByFaction = new Map<FactionId, number[]>();
  for (const province of map.provinces) {
    const owner = province.ownerFactionId;
    if (owner == null) continue;
    let agg = sumByFaction.get(owner);
    if (!agg) {
      agg = { x: 0, y: 0, count: 0 };
      sumByFaction.set(owner, agg);
    }
    agg.x += province.centroid.x;
    agg.y += province.centroid.y;
    agg.count += 1;
    let owned = ownedByFaction.get(owner);
    if (!owned) {
      owned = [];
      ownedByFaction.set(owner, owned);
    }
    owned.push(province.id as unknown as number);
  }
  for (const f of factions) {
    const agg = sumByFaction.get(f.id);
    if (!agg || agg.count === 0) {
      out.set(f.id, { capital: null, centroid: null });
      continue;
    }
    const avgX = agg.x / agg.count;
    const avgY = agg.y / agg.count;
    const owned = ownedByFaction.get(f.id) ?? [];
    let bestId = owned[0];
    let bestDist = Infinity;
    for (const idNum of owned) {
      const p = map.provinces[idNum];
      if (!p) continue;
      const dx = p.centroid.x - avgX;
      const dy = p.centroid.y - avgY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestId = idNum;
      }
    }
    const centroidId = bestId as unknown as import('@/shared/types').RegionId;

    // 迁都判定
    let capitalId = f.capitalRegionId;
    if (capitalId == null) {
      capitalId = centroidId;
    } else {
      const capProvince = map.provinces[capitalId as unknown as number];
      if (!capProvince || capProvince.ownerFactionId !== f.id) {
        capitalId = centroidId;
      }
    }
    out.set(f.id, { capital: capitalId, centroid: centroidId });
  }
  return out;
}
