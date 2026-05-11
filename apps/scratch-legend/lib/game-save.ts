import {
  createInitialUpgradeToolStates,
  getUnlockMilestoneThreshold,
  getWorkLevel,
  INITIAL_GOLD,
  LOAN_CONFIG,
  type LoanState,
  type PlayerState,
  type ScratchCardProgressState,
  type ScratchCardState,
  shouldUnlockTrashCan,
  UNLOCK_MILESTONES,
  type UnlockMilestoneId,
  type UpgradeToolId,
  type UpgradeToolState,
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
  // 玩家是否已经真实遇到过碎盘，遇到后才触发风险电话。
  workRiskNoticeTriggered: boolean;
  // 玩家是否已经关闭过刮刮乐解锁电话。
  scratchMessageDismissed: boolean;
  // 玩家是否已经关闭过升级工具解锁电话。
  upgradeToolsMessageDismissed: boolean;
  // 玩家是否已经关闭过“三连胜出”解锁电话。
  tripleMatchMessageDismissed: boolean;
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
  // “三连胜出”卡片自己的等级进度。
  tripleMatch: ScratchCardProgressState;
  // “险中求财”风险卡自己的等级进度。
  riskPeek: ScratchCardProgressState;
};

export type ScratchLegendUpgradeToolsState = Record<UpgradeToolId, UpgradeToolState>;

export type ScratchLegendAutomationState = {
  // 阶段 5 入口：自动刮刮机是否已经购买解锁。
  autoScratchMachineUnlocked: boolean;
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
  // 当前升级工具等级状态。
  upgradeTools: ScratchLegendUpgradeToolsState;
  // 当前自动化能力状态。
  automation: ScratchLegendAutomationState;
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

function normalizeScratchPoints(points?: WorkPlateState['cleanPoints']) {
  return points ?? [];
}

function mergeUpgradeToolStates(
  partialUpgradeTools?: DeepPartial<ScratchLegendUpgradeToolsState>,
): ScratchLegendUpgradeToolsState {
  const initialUpgradeTools = createInitialUpgradeToolStates();

  return Object.fromEntries(
    Object.entries(initialUpgradeTools).map(([toolId, initialToolState]) => {
      const typedToolId = toolId as UpgradeToolId;
      const persistedToolState = partialUpgradeTools?.[typedToolId];

      return [
        typedToolId,
        {
          level: persistedToolState?.level ?? initialToolState.level,
        },
      ];
    }),
  ) as ScratchLegendUpgradeToolsState;
}

function normalizeLoanState(loan: LoanState) {
  const template = LOAN_CONFIG.templates.find((item) => item.id === loan.templateId);

  return {
    ...loan,
    penalty: loan.penalty ??
      template?.penalty ?? { ...LOAN_CONFIG.templates[0].penalty, enabled: false },
  } satisfies LoanState;
}

export function createInitialScratchLegendSave(): ScratchLegendSave {
  return {
    version: 1,
    player: {
      gold: INITIAL_GOLD,
      lifetimeGoldEarned: 0,
      proficiency: 0,
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
      workRiskNoticeTriggered: false,
      scratchMessageDismissed: false,
      upgradeToolsMessageDismissed: false,
      tripleMatchMessageDismissed: false,
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
      tripleMatch: {
        cardsSettled: 0,
      },
      riskPeek: {
        cardsSettled: 0,
      },
    },
    upgradeTools: createInitialUpgradeToolStates(),
    automation: {
      autoScratchMachineUnlocked: false,
    },
    workspace: createInitialWorkspaceState(),
  };
}

export function mergeScratchLegendSave(
  partialSave?: DeepPartial<ScratchLegendSave>,
): ScratchLegendSave {
  const initialSave = createInitialScratchLegendSave();
  const mergedPlayer = {
    ...initialSave.player,
    ...partialSave?.player,
    proficiency:
      partialSave?.player?.proficiency ??
      partialSave?.player?.lifetimeGoldEarned ??
      initialSave.player.proficiency,
  };
  const legacyActiveScratchCard = normalizeScratchCardState(
    (partialSave?.workspace?.activeScratchCard as ScratchCardState | null | undefined) ?? null,
  );
  const scratchCards =
    partialSave?.workspace?.scratchCards
      ?.map((card) => normalizeScratchCardState(card))
      .filter(isScratchCardState) ??
    (legacyActiveScratchCard ? [legacyActiveScratchCard] : initialSave.workspace.scratchCards);
  const plates =
    partialSave?.workspace?.plates?.map((plate) => normalizeWorkPlateState(plate)) ??
    initialSave.workspace.plates;

  return syncScratchLegendSave({
    ...initialSave,
    ...partialSave,
    player: mergedPlayer,
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
      activeLoans:
        partialSave?.loans?.activeLoans?.map((loan) => normalizeLoanState(loan)) ??
        initialSave.loans.activeLoans,
    },
    scratchCards: {
      ...initialSave.scratchCards,
      ...partialSave?.scratchCards,
      basicSafe: {
        ...initialSave.scratchCards.basicSafe,
        ...partialSave?.scratchCards?.basicSafe,
      },
      tripleMatch: {
        ...initialSave.scratchCards.tripleMatch,
        ...partialSave?.scratchCards?.tripleMatch,
      },
      riskPeek: {
        ...initialSave.scratchCards.riskPeek,
        ...partialSave?.scratchCards?.riskPeek,
      },
    },
    upgradeTools: mergeUpgradeToolStates(partialSave?.upgradeTools),
    automation: {
      ...initialSave.automation,
      ...partialSave?.automation,
    },
    workspace: {
      ...initialSave.workspace,
      ...partialSave?.workspace,
      plates,
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
    level: card.level ?? 0,
    result: {
      ...card.result,
      penaltySlotIndexes: card.result.penaltySlotIndexes ?? [],
      penaltyTriggered: card.result.penaltyTriggered ?? false,
      discardCost: card.result.discardCost ?? 0,
      penaltyAmount: card.result.penaltyAmount ?? 0,
    },
    scratchPoints: normalizeScratchPoints(card.scratchPoints),
  } satisfies ScratchCardState;
}

function normalizeWorkPlateState(plate: WorkPlateState) {
  return {
    ...plate,
    cleanPoints: normalizeScratchPoints(plate.cleanPoints),
    isCleaned: plate.isCleaned ?? false,
  } satisfies WorkPlateState;
}

function getDesktopPhase(plateCount: number, scratchCardCount: number): WorkPhase {
  if (scratchCardCount > 0) {
    return 'scratchCardSpawned';
  }

  if (plateCount > 0) {
    return 'plateSpawned';
  }

  return 'idle';
}

function createInitialWorkspaceState(): ScratchLegendWorkspaceState {
  return {
    phase: 'idle',
    plates: [],
    activePlateId: null,
    scratchCards: [],
    activeScratchCardId: null,
    activeScratchCard: null,
    nextPlateId: 1,
    nextScratchCardId: 1,
  };
}

function isFreshPlayerProgress(player: PlayerState) {
  return (
    player.gold === INITIAL_GOLD &&
    player.lifetimeGoldEarned === 0 &&
    player.proficiency === 0 &&
    player.plateCleaned === 0 &&
    player.cardsScratched === 0 &&
    getWorkLevel(player.plateCleaned) === 0
  );
}

function hasWorkspaceProgress(workspace: ScratchLegendWorkspaceState) {
  return (
    workspace.phase !== 'idle' ||
    workspace.plates.length > 0 ||
    workspace.scratchCards.length > 0 ||
    workspace.activePlateId !== null ||
    workspace.activeScratchCardId !== null
  );
}

function normalizeWorkspaceState(workspace: ScratchLegendWorkspaceState) {
  const activePlateExists = workspace.plates.some((plate) => plate.id === workspace.activePlateId);
  const activeScratchCardExists = workspace.scratchCards.some(
    (card) => card.id === workspace.activeScratchCardId,
  );
  const desktopPhase = getDesktopPhase(workspace.plates.length, workspace.scratchCards.length);

  if ((workspace.phase === 'cleaning' || workspace.phase === 'claimable') && activePlateExists) {
    return {
      ...workspace,
      activeScratchCardId: null,
    } satisfies ScratchLegendWorkspaceState;
  }

  if (workspace.phase === 'scratchingCard' && activeScratchCardExists) {
    return {
      ...workspace,
      activePlateId: null,
    } satisfies ScratchLegendWorkspaceState;
  }

  if (
    workspace.phase === desktopPhase &&
    workspace.activePlateId === null &&
    workspace.activeScratchCardId === null
  ) {
    return workspace;
  }

  return {
    ...workspace,
    activePlateId: null,
    activeScratchCardId: null,
    phase: desktopPhase,
  } satisfies ScratchLegendWorkspaceState;
}

export function syncScratchLegendSave(save: ScratchLegendSave): ScratchLegendSave {
  const unlockedMilestones = { ...save.unlocks.unlockedMilestones };
  const normalizedProficiency = Math.max(
    0,
    save.player.proficiency ?? save.player.lifetimeGoldEarned ?? 0,
  );
  const workspace =
    isFreshPlayerProgress(save.player) && hasWorkspaceProgress(save.workspace)
      ? createInitialWorkspaceState()
      : normalizeWorkspaceState(save.workspace);

  for (const milestone of UNLOCK_MILESTONES) {
    if (normalizedProficiency >= getUnlockMilestoneThreshold(milestone.id)) {
      unlockedMilestones[milestone.id] = true;
    }
  }

  return {
    ...save,
    workspace,
    player: {
      ...save.player,
      proficiency: normalizedProficiency,
      workLevel: getWorkLevel(save.player.plateCleaned),
    },
    unlocks: {
      trashCanUnlocked:
        save.unlocks.trashCanUnlocked || shouldUnlockTrashCan(normalizedProficiency, false),
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
