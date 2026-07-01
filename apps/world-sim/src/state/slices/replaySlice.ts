import type { StateCreator } from 'zustand';
import { computeCapitalsAndCentroids, resetContiguityWatch } from '@/core/sim';
import type {
  FactionId,
  FactionSummary,
  LogEvent,
  ReplayDoc,
  ReplayFrame,
  ReplayInitialFaction,
  ReplaySpeed,
  ReplayStatus,
} from '@/shared/types';
import { asFactionId, asRegionId, asTick, REPLAY_DOC_VERSION } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import type { LogSlice } from './logSlice';
import type { MapSlice } from './mapSlice';
import type { ScenarioSlice } from './scenarioSlice';
import type { SimSlice } from './simSlice';

/**
 * Phase 11 Replay System。
 *
 * 录制：每 sim tick 完成后，simSlice 调用 recordFrame 把当帧的 patches/events/rankings/status
 * 追加到 replayFrames。新一局（loadScenario / regenerateMap / setMapMode / resetBattle）会
 * 调用 captureBaseline，把当时的 ownership + factions 落成 baseline，frames 清零。
 *
 * 回放：
 * - replayMode === 'recording'：跟随 sim 推演，frames 不断追加。
 * - replayMode === 'replaying'：sim 暂停，由 App.tsx 的 RAF 按 replaySpeed 调用 stepReplay 前进；
 *   拖动时间轴或后退时调用 seekReplay，重建 ownership / factions / logs / status / tick。
 *
 * 不感知地图模式（random / three-kingdoms 都一样），仅依赖 RegionId / FactionId 索引；
 * 因此程序化地图 + 编辑后导入的地图都能录回放。
 */
export type ReplayMode = 'recording' | 'replaying';

export interface ReplaySlice {
  /** 是否处于回放模式（true=暂停 sim，按 cursor 重放） */
  replayMode: ReplayMode;
  /** 回放是否正在播放（独立于 mode，便于一键暂停） */
  replayPlaying: boolean;
  /** 回放速率档位 */
  replaySpeed: ReplaySpeed;
  /** 当前回放游标：0 表示尚未应用任何帧（=baseline），N 表示已应用 frames[0..N-1] */
  replayCursor: number;
  /** 录制的帧列表 */
  replayFrames: ReplayFrame[];
  /** baseline ownership：与 map.provinces 等长 */
  initialOwnership: Array<FactionId | null>;
  /** baseline factions（按 id 不会变；name/leader/color 在新一局之前固定） */
  initialFactions: ReplayInitialFaction[];
  /** baseline 时机的剧本 id，写入导出文件以便对照 */
  baselineScenarioId: string | null;
  /** 上一次导出/导入提示，UI 显示 */
  replayMessage: string | null;

  /** 把当前 map.ownership + factions 作为新的 baseline；frames 清空，cursor 归零 */
  captureBaseline: () => void;
  /** 录制一帧；由 simSlice 在 tick 完成后调用 */
  recordFrame: (frame: ReplayFrame) => void;

  /** 进入回放模式：暂停 sim，把 cursor 跳到 0，可由 stepReplay/seek 推进 */
  enterReplayMode: () => void;
  /** 退出回放模式：把 sim 还原到「跟随当前 cursor」的状态，sim 不会自动恢复 paused/running */
  exitReplayMode: () => void;
  /** 切播放/暂停（仅在 replayMode 时生效） */
  toggleReplayPlay: () => void;
  /** 设置回放速率 */
  setReplaySpeed: (speed: ReplaySpeed) => void;
  /** 推进 cursor（n 可为负），并把 ownership/factions/logs 重建到对应帧 */
  stepReplay: (n: number) => void;
  /** 跳到指定 cursor */
  seekReplay: (cursor: number) => void;

  /** 导出 ReplayDoc JSON */
  exportReplayToJson: () => string;
  /** 导入 ReplayDoc：替换当前 map ownership / factions / logs / cursor，并切到 replaying 模式 */
  importReplayFromJson: (json: string) => { ok: boolean; message: string };
}

type Deps = ReplaySlice & MapSlice & FactionSlice & SimSlice & LogSlice & ScenarioSlice;

export const createReplaySlice: StateCreator<Deps, [], [], ReplaySlice> = (set, get) => ({
  replayMode: 'recording',
  replayPlaying: false,
  replaySpeed: '1x',
  replayCursor: 0,
  replayFrames: [],
  initialOwnership: [],
  initialFactions: [],
  baselineScenarioId: null,
  replayMessage: null,

  captureBaseline: () => {
    const state = get();
    const map = state.map;
    // 新基线视为新一局，清掉飞地告警的历史 prev 计数，避免上一局或上一份地图的遗留状态影响告警。
    resetContiguityWatch();
    if (!map) {
      set({
        replayMode: 'recording',
        replayPlaying: false,
        replayCursor: 0,
        replayFrames: [],
        initialOwnership: [],
        initialFactions: [],
        baselineScenarioId: state.currentScenarioId ?? null,
      });
      return;
    }
    const initialOwnership: Array<FactionId | null> = map.provinces.map((p) => p.ownerFactionId);
    const initialFactions: ReplayInitialFaction[] = state.factions.map((f) => ({
      id: f.id,
      name: f.name,
      leader: f.leader,
      colorHex: f.colorHex,
      birthRegionId: f.birthRegionId,
      capitalRegionId: f.capitalRegionId ?? f.birthRegionId,
      population: f.population,
    }));
    set({
      replayMode: 'recording',
      replayPlaying: false,
      replayCursor: 0,
      replayFrames: [],
      initialOwnership,
      initialFactions,
      baselineScenarioId: state.currentScenarioId ?? null,
    });
  },

  recordFrame: (frame) => {
    const state = get();
    if (state.replayMode !== 'recording') return;
    set({
      replayFrames: [...state.replayFrames, frame],
      replayCursor: state.replayCursor + 1,
    });
  },

  enterReplayMode: () => {
    const state = get();
    if (state.replayFrames.length === 0 && state.initialOwnership.length === 0) {
      set({ replayMessage: '当前局没有可回放的帧，先开始一局推演' });
      return;
    }
    // 先把当前世界倒带到 baseline，再保留 cursor=0；UI 端若想从尾部开始可调 seekReplay(frames.length)
    rebuildWorldUpToCursor(get, set, 0);
    set({
      replayMode: 'replaying',
      replayPlaying: false,
      replayCursor: 0,
      paused: true,
      mode: 'replay',
    });
  },

  exitReplayMode: () => {
    set({
      replayMode: 'recording',
      replayPlaying: false,
      mode: 'live',
    });
  },

  toggleReplayPlay: () => {
    const state = get();
    if (state.replayMode !== 'replaying') return;
    set({ replayPlaying: !state.replayPlaying });
  },

  setReplaySpeed: (speed) => set({ replaySpeed: speed }),

  stepReplay: (n) => {
    const state = get();
    if (state.replayMode !== 'replaying') return;
    const next = clamp(state.replayCursor + n, 0, state.replayFrames.length);
    if (next === state.replayCursor) return;
    rebuildWorldUpToCursor(get, set, next);
    // 终点：自动暂停
    if (next === state.replayFrames.length) {
      set({ replayPlaying: false });
    }
  },

  seekReplay: (cursor) => {
    const state = get();
    if (state.replayMode !== 'replaying') return;
    const next = clamp(Math.floor(cursor), 0, state.replayFrames.length);
    rebuildWorldUpToCursor(get, set, next);
  },

  exportReplayToJson: () => {
    const state = get();
    const map = state.map;
    if (!map) return '';
    const doc: ReplayDoc = {
      version: REPLAY_DOC_VERSION,
      exportedAt: new Date().toISOString(),
      meta: {
        seed: map.meta.seed,
        provinceCount: map.meta.provinceCount,
        mapMode: state.mapMode,
        scenarioId: state.baselineScenarioId,
        totalTicks: state.replayFrames.length,
      },
      initialOwnership: state.initialOwnership.map((id) =>
        id == null ? null : (id as unknown as number),
      ),
      initialFactions: state.initialFactions.map((f) => ({
        id: f.id,
        name: f.name,
        leader: f.leader,
        colorHex: f.colorHex,
        birthRegionId: f.birthRegionId,
        capitalRegionId: f.capitalRegionId ?? f.birthRegionId,
        population: f.population,
      })),
      frames: state.replayFrames,
    };
    return JSON.stringify(doc, null, 2);
  },

  importReplayFromJson: (json) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failure = `Replay 解析失败：${message}`;
      set({ replayMessage: failure });
      return { ok: false, message: failure };
    }
    const validation = validateReplayDoc(parsed);
    if (!validation.ok) {
      set({ replayMessage: validation.message });
      return validation;
    }
    const doc = validation.doc;
    const state = get();
    const map = state.map;
    if (!map) {
      const failure = '请先生成或加载地图，再导入 Replay';
      set({ replayMessage: failure });
      return { ok: false, message: failure };
    }
    if (doc.initialOwnership.length !== map.provinces.length) {
      const failure = `Replay 与当前地图州数不一致（${doc.initialOwnership.length} vs ${map.provinces.length}），请先加载对应地图`;
      set({ replayMessage: failure });
      return { ok: false, message: failure };
    }

    // 应用 baseline + frames，置入 store
    const initialOwnership = doc.initialOwnership.map((v) =>
      v == null ? null : asFactionId(v),
    ) as Array<FactionId | null>;
    const initialFactions: ReplayInitialFaction[] = doc.initialFactions.map((f) => {
      const birth =
        f.birthRegionId == null ? null : asRegionId(f.birthRegionId as unknown as number);
      // v1 文件没有 capitalRegionId 字段：fallback 到 birth
      const rawCapital = (f as { capitalRegionId?: number | null }).capitalRegionId;
      const capital = rawCapital == null ? birth : asRegionId(rawCapital as unknown as number);
      return {
        id: asFactionId(f.id as unknown as number),
        name: f.name,
        leader: f.leader,
        colorHex: f.colorHex,
        birthRegionId: birth,
        capitalRegionId: capital,
        population: f.population,
      };
    });

    set({
      replayMode: 'replaying',
      replayPlaying: false,
      replayCursor: 0,
      replaySpeed: '1x',
      replayFrames: doc.frames as ReplayFrame[],
      initialOwnership,
      initialFactions,
      baselineScenarioId: doc.meta.scenarioId,
      replayMessage: `已导入 Replay：${doc.frames.length} tick`,
      mode: 'replay',
      paused: true,
    });
    rebuildWorldUpToCursor(get, set, 0);
    return { ok: true, message: `已导入 ${doc.frames.length} 帧` };
  },
});

/* ------------------------------------------------------------------ */
/* 重建：根据 baseline + frames[0..cursor) 还原 map / factions / logs    */
/* ------------------------------------------------------------------ */

type Get = () => Deps;
type Set = (partial: Partial<Deps>) => void;

function rebuildWorldUpToCursor(get: Get, set: Set, cursor: number): void {
  const state = get();
  const map = state.map;
  if (!map) return;

  const ownership: Array<FactionId | null> = state.initialOwnership.slice();
  let status: ReplayStatus = 'idle';
  let winnerFactionId: FactionId | null = null;
  const aggregatedLogs: LogEvent[] = [];
  let lastTickEventCount = 0;

  for (let i = 0; i < cursor; i++) {
    const frame = state.replayFrames[i];
    if (!frame) break;
    for (const patch of frame.patches) {
      const idx = patch.regionId;
      const to = patch.to == null ? null : asFactionId(patch.to);
      ownership[idx] = to;
    }
    aggregatedLogs.push(...frame.events);
    status = frame.status;
    winnerFactionId = frame.winnerFactionId == null ? null : frame.winnerFactionId;
    lastTickEventCount = frame.events.length;
  }
  // 如果 cursor === 0，仍要把 status 复位为 idle
  if (cursor === 0) {
    status = 'idle';
    winnerFactionId = null;
    lastTickEventCount = 0;
  }

  // 还原 provinces
  const nextProvinces = map.provinces.map((p, i) => ({
    ...p,
    ownerFactionId: ownership[i] ?? null,
  }));
  const nextMap = { ...map, provinces: nextProvinces };

  // 重新统计 regions
  const regionsByFaction = new Map<number, number>();
  for (const owner of ownership) {
    if (owner == null) continue;
    const k = owner as unknown as number;
    regionsByFaction.set(k, (regionsByFaction.get(k) ?? 0) + 1);
  }
  // P0：基于重建后的 ownership 重新计算每势力的首都/重心，
  // 与 simSlice live tick 保持一致；否则回放下首都永远停在 baseline。
  // 输入用 initialFactions 的 capitalRegionId 作为「上一帧首都」；computeCapitalsAndCentroids
  // 在 capital 不再 self-owned 时会自动迁都至 centroid，等价于把整段历史一次性追上。
  const capitalsByFaction = computeCapitalsAndCentroids(
    nextMap,
    state.initialFactions.map((f) => ({
      id: f.id,
      capitalRegionId: f.capitalRegionId ?? f.birthRegionId,
    })),
  );
  // 优先用 initialFactions 重建（保证 baseline 时的颜色/名字稳定）；当前 store 里多余的势力丢弃
  const factionsNext: FactionSummary[] = state.initialFactions.map((f) => {
    const cap = capitalsByFaction.get(f.id);
    const fallback = f.capitalRegionId ?? f.birthRegionId;
    return {
      id: f.id,
      name: f.name,
      leader: f.leader,
      colorHex: f.colorHex,
      birthRegionId: f.birthRegionId,
      capitalRegionId: cap ? cap.capital : fallback,
      centroidRegionId: cap ? cap.centroid : fallback,
      regions: regionsByFaction.get(f.id as unknown as number) ?? 0,
      population: f.population,
    };
  });

  // 截断 logs：MAX_LOG_ENTRIES 由 logSlice 管控，这里直接全量写入并取末尾
  const MAX = 1000;
  const logsNext = aggregatedLogs.length <= MAX ? aggregatedLogs : aggregatedLogs.slice(-MAX);

  // tick 等于 cursor（baseline 后的 frame 索引数）
  const tickNumber = cursor;

  set({
    map: nextMap,
    factions: factionsNext,
    logs: logsNext,
    tick: asTick(tickNumber),
    status,
    winnerFactionId,
    lastTickEventCount,
    snapshotVersion: state.snapshotVersion + 1,
    replayCursor: cursor,
  });
  // 回放期 sim 已暂停，不会再触发 assertContiguous；但 rebuild 出来的世界相当于新基线，
  // 主动清掉飞地告警记录，避免之后退出回放接续 live tick 时拿到陈旧 prev 计数。
  resetContiguityWatch();
}

/* ------------------------------------------------------------------ */
/* 校验                                                                */
/* ------------------------------------------------------------------ */

function validateReplayDoc(
  raw: unknown,
): { ok: true; doc: ReplayDoc } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: '不是合法的 JSON 对象' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    return { ok: false, message: '缺少 version 字段' };
  }
  // 兼容 v1（无 capitalRegionId 字段）与 v2
  if (obj.version !== REPLAY_DOC_VERSION && obj.version !== 1) {
    return { ok: false, message: `不支持的 Replay 版本：${obj.version}` };
  }
  if (!obj.meta || typeof obj.meta !== 'object') {
    return { ok: false, message: 'meta 不是对象' };
  }
  if (!Array.isArray(obj.initialOwnership)) {
    return { ok: false, message: 'initialOwnership 不是数组' };
  }
  if (!Array.isArray(obj.initialFactions)) {
    return { ok: false, message: 'initialFactions 不是数组' };
  }
  if (!Array.isArray(obj.frames)) {
    return { ok: false, message: 'frames 不是数组' };
  }
  return { ok: true, doc: obj as unknown as ReplayDoc };
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
