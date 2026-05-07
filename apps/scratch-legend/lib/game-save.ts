import {
  getUnlockMilestoneThreshold,
  getWorkLevel,
  INITIAL_GOLD,
  type LoanState,
  type PlayerState,
  type ScratchCardProgressState,
  type ScratchCardState,
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
  // 垃圾桶购买资格，达到熟练度后自动解锁。
  trashCanUnlocked: boolean;
  // 垃圾桶是否已购买；购买后才会出现在桌面并可使用。
  trashCanPurchased: boolean;
  // 所有累计金币里程碑的当前解锁状态。
  unlockedMilestones: Record<UnlockMilestoneId, boolean>;
};

export type ScratchLegendNoticeState = {
  // 玩家是否已经关闭过碎盘风险电话。
  workRiskMessageDismissed: boolean;
  // 玩家是否已经关闭过刮刮乐解锁电话。
  scratchMessageDismissed: boolean;
};

export type ScratchLegendLoanState = {
  // 当前尚未偿还的贷款。
  activeLoans: LoanState[];
  // 下一笔贷款的玩家侧编号。
  nextLoanId: number;
  // 下一笔贷款使用的模板序号，超过模板数量后循环。
  nextLoanTemplateIndex: number;
};

export type ScratchLegendScratchCardsState = {
  // “成双入对”卡片自己的等级进度。
  basicSafe: ScratchCardProgressState;
};

export type ScratchLegendWorkspaceState = {
  // 当前主流程处于什么阶段。
  phase: WorkPhase;
  // 当前桌面上还存在的脏盘子列表。
  plates: WorkPlateState[];
  // 当前正在清洁或可领取奖励的那只盘子 id。
  activePlateId: number | null;
  // 桌面上还存在的刮刮卡列表，每张卡独立携带预生成结果。
  scratchCards: ScratchCardState[];
  // 当前正在放大刮开或等待结算的刮刮卡 id。
  activeScratchCardId: number | null;
  // 旧版本单卡存档字段，只用于迁移；新逻辑不再写入。
  activeScratchCard: ScratchCardState | null;
  // 下一个新盘子的 id 计数器。
  nextPlateId: number;
  // 下一个新刮刮卡的 id 计数器。
  nextScratchCardId: number;
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
  // 当前贷款状态。
  loans: ScratchLegendLoanState;
  // 当前刮刮卡目录进度。
  scratchCards: ScratchLegendScratchCardsState;
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

function isScratchCardState(card: ScratchCardState | null): card is ScratchCardState {
  return Boolean(card);
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
      trashCanPurchased: false,
      unlockedMilestones: createInitialMilestoneUnlockState(),
    },
    notices: {
      workRiskMessageDismissed: false,
      scratchMessageDismissed: false,
    },
    loans: {
      activeLoans: [],
      nextLoanId: 1,
      nextLoanTemplateIndex: 0,
    },
    scratchCards: {
      basicSafe: {
        cardsSettled: 0,
      },
    },
    workspace: {
      phase: 'idle',
      plates: [],
      activePlateId: null,
      scratchCards: [],
      activeScratchCardId: null,
      activeScratchCard: null,
      nextPlateId: 1,
      nextScratchCardId: 1,
    },
  };
}

export function mergeScratchLegendSave(
  partialSave?: DeepPartial<ScratchLegendSave>,
): ScratchLegendSave {
  const initialSave = createInitialScratchLegendSave();
  const legacyActiveScratchCard = normalizeScratchCardState(
    (partialSave?.workspace?.activeScratchCard as ScratchCardState | null | undefined) ?? null,
  );
  const scratchCards =
    partialSave?.workspace?.scratchCards
      ?.map((card) => normalizeScratchCardState(card))
      .filter(isScratchCardState) ??
    (legacyActiveScratchCard ? [legacyActiveScratchCard] : initialSave.workspace.scratchCards);

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
    loans: {
      ...initialSave.loans,
      ...partialSave?.loans,
      activeLoans: partialSave?.loans?.activeLoans ?? initialSave.loans.activeLoans,
    },
    scratchCards: {
      ...initialSave.scratchCards,
      ...partialSave?.scratchCards,
      basicSafe: {
        ...initialSave.scratchCards.basicSafe,
        ...partialSave?.scratchCards?.basicSafe,
      },
    },
    workspace: {
      ...initialSave.workspace,
      ...partialSave?.workspace,
      plates: partialSave?.workspace?.plates ?? initialSave.workspace.plates,
      scratchCards,
      activeScratchCardId: partialSave?.workspace?.activeScratchCardId ?? null,
      activeScratchCard: null,
    },
  });
}

function normalizeScratchCardState(card: ScratchCardState | null) {
  if (!card) {
    return null;
  }

  return {
    ...card,
    level: card.level ?? 1,
  } satisfies ScratchCardState;
}

export function syncScratchLegendSave(save: ScratchLegendSave): ScratchLegendSave {
  const unlockedMilestones = { ...save.unlocks.unlockedMilestones };

  for (const milestone of UNLOCK_MILESTONES) {
    if (save.player.lifetimeGoldEarned >= getUnlockMilestoneThreshold(milestone.id)) {
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
        save.unlocks.trashCanUnlocked ||
        shouldUnlockTrashCan(save.player.lifetimeGoldEarned, false),
      trashCanPurchased: save.unlocks.trashCanPurchased,
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

export function getActiveScratchCard(save: ScratchLegendSave) {
  if (!save.workspace.activeScratchCardId) {
    return null;
  }

  return (
    save.workspace.scratchCards.find((card) => card.id === save.workspace.activeScratchCardId) ??
    null
  );
}
