import {
  getWorkLevel,
  INITIAL_GOLD,
  type PlayerState,
  shouldUnlockTrashCan,
  UNLOCK_MILESTONES,
  type UnlockMilestoneId,
  type WorkPhase,
  type WorkPlateState,
} from './game';

// Scratch Legend 的动态存档结构。
// 这份数据代表“当前这局玩到了哪里”，适合后续直接接 localStorage、IndexedDB
// 或服务端存档，而不是继续把运行态散在组件内部。

export type ScratchLegendUnlockState = {
  // 垃圾桶属于阶段一道具解锁，单独显式保存。
  trashCanUnlocked: boolean;
  // 所有累计金币里程碑的当前解锁状态。
  unlockedMilestones: Record<UnlockMilestoneId, boolean>;
};

export type ScratchLegendNoticeState = {
  // 玩家是否已经关闭过碎盘风险电话。
  workRiskMessageDismissed: boolean;
  // 玩家是否已经关闭过刮刮乐解锁电话。
  scratchMessageDismissed: boolean;
};

export type ScratchLegendWorkspaceState = {
  // 当前主流程处于什么阶段。
  phase: WorkPhase;
  // 当前桌面上还存在的脏盘子列表。
  plates: WorkPlateState[];
  // 当前正在清洁或可领取奖励的那只盘子 id。
  activePlateId: number | null;
  // 下一个新盘子的 id 计数器。
  nextPlateId: number;
};

export type ScratchLegendSave = {
  // 存档版本，后续结构演进时用于兼容迁移。
  version: 1;
  // 玩家核心进度：金币、累计金币、工作等级相关数据。
  player: PlayerState;
  // 当前已经达成的功能解锁状态。
  unlocks: ScratchLegendUnlockState;
  // 当前已经处理过的提示状态。
  notices: ScratchLegendNoticeState;
  // 当前桌面与工作流状态。
  workspace: ScratchLegendWorkspaceState;
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

function createInitialMilestoneUnlockState(): Record<UnlockMilestoneId, boolean> {
  return Object.fromEntries(UNLOCK_MILESTONES.map((milestone) => [milestone.id, false])) as Record<
    UnlockMilestoneId,
    boolean
  >;
}

export function createInitialScratchLegendSave(): ScratchLegendSave {
  return {
    version: 1,
    player: {
      gold: INITIAL_GOLD,
      lifetimeGoldEarned: 0,
      plateCleaned: 0,
      cardsScratched: 0,
      loseStreak: 0,
      workLevel: 0,
    },
    unlocks: {
      trashCanUnlocked: false,
      unlockedMilestones: createInitialMilestoneUnlockState(),
    },
    notices: {
      workRiskMessageDismissed: false,
      scratchMessageDismissed: false,
    },
    workspace: {
      phase: 'idle',
      plates: [],
      activePlateId: null,
      nextPlateId: 1,
    },
  };
}

export function mergeScratchLegendSave(
  partialSave?: DeepPartial<ScratchLegendSave>,
): ScratchLegendSave {
  const initialSave = createInitialScratchLegendSave();

  return syncScratchLegendSave({
    ...initialSave,
    ...partialSave,
    player: {
      ...initialSave.player,
      ...partialSave?.player,
    },
    unlocks: {
      ...initialSave.unlocks,
      ...partialSave?.unlocks,
      unlockedMilestones: {
        ...initialSave.unlocks.unlockedMilestones,
        ...partialSave?.unlocks?.unlockedMilestones,
      },
    },
    notices: {
      ...initialSave.notices,
      ...partialSave?.notices,
    },
    workspace: {
      ...initialSave.workspace,
      ...partialSave?.workspace,
      plates: partialSave?.workspace?.plates ?? initialSave.workspace.plates,
    },
  });
}

export function syncScratchLegendSave(save: ScratchLegendSave): ScratchLegendSave {
  const unlockedMilestones = { ...save.unlocks.unlockedMilestones };

  for (const milestone of UNLOCK_MILESTONES) {
    if (save.player.lifetimeGoldEarned >= milestone.totalGoldEarned) {
      unlockedMilestones[milestone.id] = true;
    }
  }

  return {
    ...save,
    player: {
      ...save.player,
      workLevel: getWorkLevel(save.player.plateCleaned),
    },
    unlocks: {
      trashCanUnlocked:
        save.unlocks.trashCanUnlocked || shouldUnlockTrashCan(save.player.plateCleaned, false),
      unlockedMilestones,
    },
  };
}

export function isUnlockMilestoneUnlocked(save: ScratchLegendSave, milestoneId: UnlockMilestoneId) {
  return save.unlocks.unlockedMilestones[milestoneId];
}

export function getActiveWorkPlate(save: ScratchLegendSave) {
  if (!save.workspace.activePlateId) {
    return null;
  }

  return save.workspace.plates.find((plate) => plate.id === save.workspace.activePlateId) ?? null;
}
