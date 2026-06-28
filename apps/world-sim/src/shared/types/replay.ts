import type { WarSummary } from './conflict';
import type { LogEvent } from './event';
import type { FactionId, RegionId, SettlementId, Tick, WarId } from './ids';

/**
 * Phase 11 回放状态机镜像。与 core/sim 的 SimStatus 同义，
 * 但放在 shared/types 内，避免 shared → core 反向依赖。
 */
export type ReplayStatus = 'idle' | 'running' | 'victory' | 'stalemate';

/**
 * Phase 11：回放系统类型。
 *
 * 录制策略：
 * - 进入新一局（剧本加载 / 重置战局 / 导入地图）后，把当时的 ownership + factions 作为「初始快照」
 *   写入 replaySlice.initialOwnership / initialFactions，frames 清空，cursor 归零。
 * - 每个 sim tick 完成时，simSlice 把 patches、log events、rankings、status 打包成 ReplayFrame
 *   追加到 replayFrames，便于后续按时间轴重放/拖动。
 *
 * 回放策略：
 * - 拖动时间轴或后退：先 reset 到初始快照，再按顺序应用 frames[0..cursor)。
 * - 前进：直接应用 frames[cursor]，cursor++。
 * - 暂停 / 慢放 / 快进 由 replaySpeed + replayPlaying 控制；App.tsx 同一个 RAF 循环驱动。
 *
 * 数据 JSON 化使用普通 number 即可——branded 类型在运行期就是 number。
 */

export type ReplaySpeed = '0.25x' | '0.5x' | '1x' | '2x' | '4x' | '8x';

export const REPLAY_SPEED_TIERS: ReplaySpeed[] = ['0.25x', '0.5x', '1x', '2x', '4x', '8x'];

export const REPLAY_SPEED_MULTIPLIER: Record<ReplaySpeed, number> = {
  '0.25x': 0.25,
  '0.5x': 0.5,
  '1x': 1,
  '2x': 2,
  '4x': 4,
  '8x': 8,
};

/** Replay 内部 patch；与 SimPatch 等价但全部用 plain number 存储，便于 JSON 化。 */
export interface ReplayPatch {
  regionId: number;
  from: number | null;
  to: number | null;
}

/** Replay 内部 ranking 行：tick 结束后该势力的领地数。 */
export interface ReplayRankingRow {
  factionId: number;
  regions: number;
}

export interface ReplayCapitalUpdate {
  factionId: FactionId;
  capitalRegionId: RegionId | null;
  centroidRegionId: RegionId | null;
}

export interface ReplaySettlementUpdate {
  settlementId: SettlementId;
  population?: number;
  development?: number;
  loyalty: number;
  unrest: number;
  revoltProgress: number;
}

export type ReplayTerrainKind = 'plain' | 'forest' | 'mountain' | 'desert' | 'river' | 'ocean';

export interface ReplayTerrainUpdate {
  regionId: RegionId;
  from: ReplayTerrainKind;
  to: ReplayTerrainKind;
}

export interface ReplayFrame {
  /** 该帧应用后的 tick 序号（与 simSlice.tick 同序）。 */
  tick: Tick;
  /** 该帧本 tick 内发生的所有 ownership 变更（已合并）。 */
  patches: ReplayPatch[];
  /** 本 tick 内追加到 LogPanel 的事件（含 occupy / lose / eliminate / victory / stalemate 等）。 */
  events: LogEvent[];
  /** 本 tick 结束后的排行榜快照（仅 regions，名字/颜色用 initialFactions 索引）。 */
  rankings: ReplayRankingRow[];
  /** 本 tick 中发生变化的首都/重心，用于回放精确还原迁都。 */
  capitalUpdates?: ReplayCapitalUpdate[];
  /** 本 tick 中被神力或事件直接改写的聚落状态。 */
  settlementUpdates?: ReplaySettlementUpdate[];
  /** 本 tick 中被神力或事件直接改写的地形。 */
  terrainUpdates?: ReplayTerrainUpdate[];
  /** 本 tick 中新创建的势力，例如叛乱义军。 */
  newFactions?: ReplayInitialFaction[];
  /** 本 tick 中新创建的战争，例如叛乱战争。 */
  newWars?: WarSummary[];
  /** 本 tick 中状态变化的战争，例如进入停战。 */
  updatedWars?: WarSummary[];
  /** 本 tick 中从当前战争列表移除的战争。 */
  endedWarIds?: WarId[];
  /** 本 tick 结束后的 sim 状态机；通常是 running，胜负终局会切到 victory / stalemate。 */
  status: ReplayStatus;
  /** 胜利 / 终局存活势力；非 victory / stalemate 时为 null。 */
  winnerFactionId: FactionId | null;
}

export interface ReplayInitialFaction {
  id: FactionId;
  name: string;
  leader: string;
  colorHex: string;
  birthRegionId: RegionId | null;
  /** Phase 8.5 / Replay v2：录制开始时的首都；v1 文件 import 时会回退到 birthRegionId。 */
  capitalRegionId: RegionId | null;
  population: number;
}

export interface ReplayDoc {
  version: number;
  exportedAt: string;
  meta: {
    seed: string;
    provinceCount: number;
    mapMode: string;
    scenarioId: string | null;
    totalTicks: number;
  };
  /** 与 map.provinces 等长的初始归属数组；null = 无主 */
  initialOwnership: Array<number | null>;
  /** 初始势力列表（含出生地与颜色，用于回放期还原排行榜与版图色） */
  initialFactions: ReplayInitialFaction[];
  frames: ReplayFrame[];
}

export const REPLAY_DOC_VERSION = 2;
