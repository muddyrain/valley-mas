import {
  AUTO_SCRATCH_MACHINE_CONFIG,
  advanceBasicSafeScratchCardProgress,
  BASIC_SAFE_CARD_PRICE,
  createInitialUpgradeToolStates,
  createScratchCard,
  type FinalChanceOutcome,
  getScratchCardLevelProgress,
  getScratchCardSettlementProgressKey,
  getUnlockMilestoneThreshold,
  getWorkLevel,
  INITIAL_GOLD,
  LOAN_CONFIG,
  type LoanState,
  type PlayerState,
  type ScratchCardProgressState,
  type ScratchCardState,
  type ScratchCardType,
  settleScratchCard,
  shouldForceWrongScratchCardForLoan,
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
  // “步步加码”高风险卡自己的等级进度。
  pushLuck: ScratchCardProgressState;
  // “最后一刮”终局票自己的结算进度。
  finalChance: ScratchCardProgressState;
};

export type ScratchLegendUpgradeToolsState = Record<UpgradeToolId, UpgradeToolState>;

export type ScratchLegendAutoScratchMachineStatus =
  | 'locked'
  | 'idle'
  | 'refilling'
  | 'processing'
  | 'paused'
  | 'blocked';

export type ScratchLegendAutoScratchMachineBlockReason =
  | 'none'
  | 'auto-buy-off'
  | 'no-allowed-card-types'
  | 'queue-full'
  | 'not-enough-gold'
  | 'reserve';

export type ScratchLegendAutomationState = {
  // 阶段 5 入口：自动刮刮机是否已经购买解锁。
  autoScratchMachineUnlocked: boolean;
  // 自动刮刮机当前运行状态。
  autoScratchMachineStatus: ScratchLegendAutoScratchMachineStatus;
  // 自动刮刮机等待处理的队列，第一版只自动购买和处理稳定票。
  autoScratchQueue: ScratchCardState[];
  // 当前正在被机器处理的卡片。
  autoScratchCurrentCard: ScratchCardState | null;
  // 当前处理进度，单位毫秒。
  autoScratchProgressMs: number;
  // 第一版默认开启自动购买。
  autoScratchAutoBuyEnabled: boolean;
  // 第一版只允许稳定票“成双入对”进入自动机。
  autoScratchAllowedCardTypes: ScratchCardType[];
  // 自动购买时至少保留的金币。
  autoScratchMinReserveGold: number;
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

export type ScratchLegendRoundSettlementState = {
  completed: boolean;
  result: FinalChanceOutcome | 'none';
  legendCount: number;
  gloryPreview: number;
  finalChanceCardId: number | null;
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
  // 当前轮是否已经由终局票推进到结算时刻。
  roundSettlement: ScratchLegendRoundSettlementState;
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

function isScratchCardState(card: ScratchCardState | null | undefined): card is ScratchCardState {
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

function createInitialAutomationState(): ScratchLegendAutomationState {
  return {
    autoScratchMachineUnlocked: false,
    autoScratchMachineStatus: 'locked',
    autoScratchQueue: [],
    autoScratchCurrentCard: null,
    autoScratchProgressMs: 0,
    autoScratchAutoBuyEnabled: true,
    autoScratchAllowedCardTypes: [AUTO_SCRATCH_MACHINE_CONFIG.base.defaultCardType],
    autoScratchMinReserveGold: 0,
  };
}

function createInitialRoundSettlementState(): ScratchLegendRoundSettlementState {
  return {
    completed: false,
    result: 'none',
    legendCount: 0,
    gloryPreview: 0,
    finalChanceCardId: null,
  };
}

function mergeRoundSettlementState(
  partialRoundSettlement?: DeepPartial<ScratchLegendRoundSettlementState>,
): ScratchLegendRoundSettlementState {
  const initialRoundSettlement = createInitialRoundSettlementState();
  const completed = partialRoundSettlement?.completed ?? initialRoundSettlement.completed;

  if (!completed) {
    return initialRoundSettlement;
  }

  return {
    completed,
    result: partialRoundSettlement?.result ?? initialRoundSettlement.result,
    legendCount: Math.max(
      0,
      Math.floor(partialRoundSettlement?.legendCount ?? initialRoundSettlement.legendCount),
    ),
    gloryPreview: Math.max(
      0,
      Math.floor(partialRoundSettlement?.gloryPreview ?? initialRoundSettlement.gloryPreview),
    ),
    finalChanceCardId:
      partialRoundSettlement?.finalChanceCardId ?? initialRoundSettlement.finalChanceCardId,
  };
}

function normalizeAutomationCard(card?: ScratchCardState | null) {
  return normalizeScratchCardState(card ?? null);
}

function normalizeAutoScratchMachineStatus(
  unlocked: boolean,
  status: ScratchLegendAutoScratchMachineStatus,
  currentCard: ScratchCardState | null,
) {
  if (!unlocked) {
    return 'locked';
  }

  if (status === 'locked') {
    return currentCard ? 'processing' : 'idle';
  }

  return status;
}

function mergeAutomationState(
  initialAutomation: ScratchLegendAutomationState,
  partialAutomation?: DeepPartial<ScratchLegendAutomationState>,
): ScratchLegendAutomationState {
  const unlocked =
    partialAutomation?.autoScratchMachineUnlocked ?? initialAutomation.autoScratchMachineUnlocked;
  const queue =
    partialAutomation?.autoScratchQueue
      ?.map((card) => normalizeAutomationCard(card))
      .filter(isScratchCardState) ?? initialAutomation.autoScratchQueue;
  const currentCard = normalizeAutomationCard(partialAutomation?.autoScratchCurrentCard ?? null);
  const allowedCardTypes =
    partialAutomation?.autoScratchAllowedCardTypes === undefined
      ? initialAutomation.autoScratchAllowedCardTypes
      : Array.from(
          new Set(
            partialAutomation.autoScratchAllowedCardTypes.filter(
              (cardType): cardType is ScratchCardType => cardType === 'basic-safe',
            ),
          ),
        );
  const status = partialAutomation?.autoScratchMachineStatus ?? (unlocked ? 'idle' : 'locked');

  return {
    ...initialAutomation,
    ...partialAutomation,
    autoScratchMachineUnlocked: unlocked,
    autoScratchMachineStatus: normalizeAutoScratchMachineStatus(unlocked, status, currentCard),
    autoScratchQueue: queue,
    autoScratchCurrentCard: currentCard,
    autoScratchProgressMs: Math.max(
      0,
      Math.floor(
        partialAutomation?.autoScratchProgressMs ?? initialAutomation.autoScratchProgressMs,
      ),
    ),
    autoScratchAutoBuyEnabled:
      partialAutomation?.autoScratchAutoBuyEnabled ?? initialAutomation.autoScratchAutoBuyEnabled,
    autoScratchAllowedCardTypes: allowedCardTypes,
    autoScratchMinReserveGold: Math.max(
      0,
      Math.floor(
        partialAutomation?.autoScratchMinReserveGold ?? initialAutomation.autoScratchMinReserveGold,
      ),
    ),
  };
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
      pushLuck: {
        cardsSettled: 0,
      },
      finalChance: {
        cardsSettled: 0,
      },
    },
    upgradeTools: createInitialUpgradeToolStates(),
    automation: createInitialAutomationState(),
    roundSettlement: createInitialRoundSettlementState(),
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
      pushLuck: {
        ...initialSave.scratchCards.pushLuck,
        ...partialSave?.scratchCards?.pushLuck,
      },
      finalChance: {
        ...initialSave.scratchCards.finalChance,
        ...partialSave?.scratchCards?.finalChance,
      },
    },
    upgradeTools: mergeUpgradeToolStates(partialSave?.upgradeTools),
    automation: mergeAutomationState(initialSave.automation, partialSave?.automation),
    roundSettlement: mergeRoundSettlementState(partialSave?.roundSettlement),
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

function normalizeScratchCardState(
  card: ScratchCardState | null | undefined,
): ScratchCardState | null {
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
      finalChance:
        card.type === 'final-chance'
          ? {
              legendCount: Math.max(0, Math.floor(card.result.finalChance?.legendCount ?? 0)),
              gloryPreview: Math.max(0, Math.floor(card.result.finalChance?.gloryPreview ?? 0)),
              outcome: card.result.finalChance?.outcome ?? 'failure',
            }
          : card.result.finalChance,
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

  const automation = mergeAutomationState(createInitialAutomationState(), save.automation);
  const roundSettlement = mergeRoundSettlementState(save.roundSettlement);

  return {
    ...save,
    workspace,
    automation: roundSettlement.completed
      ? {
          ...automation,
          autoScratchMachineStatus: automation.autoScratchMachineUnlocked ? 'paused' : 'locked',
          autoScratchAutoBuyEnabled: false,
          autoScratchProgressMs: 0,
        }
      : automation,
    roundSettlement,
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

export function settleFinalChanceScratchCardSave(save: ScratchLegendSave): ScratchLegendSave {
  const activeCard = getActiveScratchCard(save);

  if (!activeCard || activeCard.type !== 'final-chance' || activeCard.status !== 'claimable') {
    return save;
  }

  const finalChance = activeCard.result.finalChance;

  if (!finalChance) {
    return save;
  }

  const remainingScratchCards = save.workspace.scratchCards.filter(
    (card) => card.id !== activeCard.id,
  );

  return syncScratchLegendSave({
    ...save,
    player: {
      ...save.player,
      cardsScratched: save.player.cardsScratched + 1,
      loseStreak: finalChance.outcome === 'failure' ? save.player.loseStreak + 1 : 0,
    },
    scratchCards: {
      ...save.scratchCards,
      finalChance: advanceBasicSafeScratchCardProgress(save.scratchCards.finalChance),
    },
    automation: {
      ...save.automation,
      autoScratchMachineStatus: save.automation.autoScratchMachineUnlocked ? 'paused' : 'locked',
      autoScratchAutoBuyEnabled: false,
      autoScratchProgressMs: 0,
    },
    roundSettlement: {
      completed: true,
      result: finalChance.outcome,
      legendCount: finalChance.legendCount,
      gloryPreview: finalChance.gloryPreview,
      finalChanceCardId: activeCard.id,
    },
    workspace: {
      ...save.workspace,
      scratchCards: remainingScratchCards,
      activeScratchCardId: null,
      phase: getDesktopPhase(save.workspace.plates.length, remainingScratchCards.length),
    },
  });
}

type AdvanceAutoScratchMachineOptions = {
  random?: () => number;
  symbolRandom?: () => number;
};

function getAutoScratchMachineProcessingMs() {
  return AUTO_SCRATCH_MACHINE_CONFIG.base.processingSeconds * 1000;
}

function getAutoScratchMachineOccupiedSlots(automation: ScratchLegendAutomationState) {
  return automation.autoScratchQueue.length + (automation.autoScratchCurrentCard ? 1 : 0);
}

function getWorkspacePhaseAfterScratchCardAdded(workspace: ScratchLegendWorkspaceState) {
  if (
    (workspace.phase === 'cleaning' || workspace.phase === 'claimable') &&
    workspace.activePlateId !== null
  ) {
    return workspace.phase;
  }

  if (workspace.phase === 'scratchingCard' && workspace.activeScratchCardId !== null) {
    return workspace.phase;
  }

  return getDesktopPhase(workspace.plates.length, workspace.scratchCards.length + 1);
}

function getAutoScratchMachineStatusAfterTakeover(
  automation: ScratchLegendAutomationState,
  tookCurrentCard: boolean,
  remainingQueue: ScratchCardState[],
) {
  if (automation.autoScratchMachineStatus === 'paused') {
    return 'paused';
  }

  if (!tookCurrentCard && automation.autoScratchCurrentCard) {
    return 'processing';
  }

  if (remainingQueue.length > 0) {
    return 'idle';
  }

  return 'idle';
}

function canAutoScratchMachineBuyBasicSafeCard(save: ScratchLegendSave) {
  const automation = save.automation;
  const occupiedSlots = getAutoScratchMachineOccupiedSlots(automation);

  return (
    automation.autoScratchMachineUnlocked &&
    automation.autoScratchAutoBuyEnabled &&
    automation.autoScratchAllowedCardTypes.includes('basic-safe') &&
    occupiedSlots < AUTO_SCRATCH_MACHINE_CONFIG.base.queueCapacity &&
    save.player.gold - BASIC_SAFE_CARD_PRICE >= automation.autoScratchMinReserveGold
  );
}

export function getAutoScratchMachineBlockReason(
  save: ScratchLegendSave,
): ScratchLegendAutoScratchMachineBlockReason {
  const automation = save.automation;
  const occupiedSlots = getAutoScratchMachineOccupiedSlots(automation);

  if (
    !automation.autoScratchMachineUnlocked ||
    automation.autoScratchMachineStatus === 'paused' ||
    automation.autoScratchCurrentCard ||
    automation.autoScratchQueue.length > 0
  ) {
    return 'none';
  }

  if (!automation.autoScratchAutoBuyEnabled) {
    return 'auto-buy-off';
  }

  if (!automation.autoScratchAllowedCardTypes.includes('basic-safe')) {
    return 'no-allowed-card-types';
  }

  if (occupiedSlots >= AUTO_SCRATCH_MACHINE_CONFIG.base.queueCapacity) {
    return 'queue-full';
  }

  if (save.player.gold < BASIC_SAFE_CARD_PRICE) {
    return 'not-enough-gold';
  }

  if (save.player.gold - BASIC_SAFE_CARD_PRICE < automation.autoScratchMinReserveGold) {
    return 'reserve';
  }

  return 'none';
}

function createAutoScratchMachineCard(
  save: ScratchLegendSave,
  options: AdvanceAutoScratchMachineOptions,
) {
  const cardType = AUTO_SCRATCH_MACHINE_CONFIG.base.defaultCardType;
  const progressKey = getScratchCardSettlementProgressKey(cardType);
  const progress = getScratchCardLevelProgress(
    cardType,
    save.scratchCards[progressKey].cardsSettled,
  );
  const scratchCardId = save.workspace.nextScratchCardId;

  return createScratchCard(cardType, {
    id: scratchCardId,
    level: progress.level,
    luckLevel: save.upgradeTools['scratch-luck']?.level ?? 0,
    random: options.random,
    symbolRandom: options.symbolRandom,
    forcedTierId:
      cardType === 'basic-safe' &&
      shouldForceWrongScratchCardForLoan(save.loans.activeLoans, scratchCardId)
        ? 'no-pair'
        : undefined,
  });
}

export function takeOverAutoScratchMachineCard(
  save: ScratchLegendSave,
  cardId: number,
): ScratchLegendSave {
  const automation = save.automation;
  const currentCard = automation.autoScratchCurrentCard;
  const tookCurrentCard = currentCard?.id === cardId;
  const queuedCard = automation.autoScratchQueue.find((card) => card.id === cardId) ?? null;
  const card = tookCurrentCard ? currentCard : queuedCard;

  if (!automation.autoScratchMachineUnlocked || !card) {
    return save;
  }

  const remainingQueue = automation.autoScratchQueue.filter((item) => item.id !== cardId);
  const manualCard = {
    ...card,
    status: 'onTable',
    scratchPoints: card.scratchPoints ?? [],
  } satisfies ScratchCardState;

  return syncScratchLegendSave({
    ...save,
    automation: {
      ...automation,
      autoScratchMachineStatus: getAutoScratchMachineStatusAfterTakeover(
        automation,
        tookCurrentCard,
        remainingQueue,
      ),
      autoScratchQueue: remainingQueue,
      autoScratchCurrentCard: tookCurrentCard ? null : automation.autoScratchCurrentCard,
      autoScratchProgressMs: tookCurrentCard ? 0 : automation.autoScratchProgressMs,
    },
    workspace: {
      ...save.workspace,
      phase: getWorkspacePhaseAfterScratchCardAdded(save.workspace),
      scratchCards: [...save.workspace.scratchCards, manualCard],
    },
  });
}

export function advanceAutoScratchMachineSave(
  save: ScratchLegendSave,
  elapsedMs: number,
  options: AdvanceAutoScratchMachineOptions = {},
): ScratchLegendSave {
  const elapsed = Math.max(0, Math.floor(elapsedMs));
  const automation = save.automation;

  if (save.roundSettlement.completed) {
    return syncScratchLegendSave(save);
  }

  if (!automation.autoScratchMachineUnlocked) {
    return {
      ...save,
      automation: {
        ...automation,
        autoScratchMachineStatus: 'locked',
        autoScratchCurrentCard: null,
        autoScratchProgressMs: 0,
      },
    };
  }

  if (automation.autoScratchMachineStatus === 'paused') {
    return save;
  }

  if (automation.autoScratchCurrentCard) {
    const nextProgressMs = automation.autoScratchProgressMs + elapsed;

    if (nextProgressMs < getAutoScratchMachineProcessingMs()) {
      return {
        ...save,
        automation: {
          ...automation,
          autoScratchMachineStatus: 'processing',
          autoScratchProgressMs: nextProgressMs,
        },
      };
    }

    const currentCard = automation.autoScratchCurrentCard;
    const progressKey = getScratchCardSettlementProgressKey(currentCard.type);

    return syncScratchLegendSave({
      ...save,
      player: settleScratchCard(save.player, currentCard),
      scratchCards: {
        ...save.scratchCards,
        [progressKey]: advanceBasicSafeScratchCardProgress(save.scratchCards[progressKey]),
      },
      automation: {
        ...automation,
        autoScratchMachineStatus: 'idle',
        autoScratchCurrentCard: null,
        autoScratchProgressMs: 0,
      },
    });
  }

  if (automation.autoScratchQueue.length > 0) {
    const [nextCard, ...remainingQueue] = automation.autoScratchQueue;

    return {
      ...save,
      automation: {
        ...automation,
        autoScratchMachineStatus: 'processing',
        autoScratchQueue: remainingQueue,
        autoScratchCurrentCard: nextCard ?? null,
        autoScratchProgressMs: 0,
      },
    };
  }

  if (canAutoScratchMachineBuyBasicSafeCard(save)) {
    const card = createAutoScratchMachineCard(save, options);

    return {
      ...save,
      player: {
        ...save.player,
        gold: save.player.gold - card.price,
      },
      automation: {
        ...automation,
        autoScratchMachineStatus: 'refilling',
        autoScratchQueue: [...automation.autoScratchQueue, card],
      },
      workspace: {
        ...save.workspace,
        nextScratchCardId: save.workspace.nextScratchCardId + 1,
      },
    };
  }

  return {
    ...save,
    automation: {
      ...automation,
      autoScratchMachineStatus:
        getAutoScratchMachineBlockReason(save) === 'auto-buy-off' ? 'idle' : 'blocked',
      autoScratchProgressMs: 0,
    },
  };
}
