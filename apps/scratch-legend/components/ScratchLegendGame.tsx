'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CleaningCanvas } from '@/components/CleaningCanvas';
import { ScratchCardCanvas } from '@/components/ScratchCardCanvas';
import {
  advanceBasicSafeScratchCardProgress,
  BASIC_SAFE_CARD_PRICE,
  canBuyBasicSafeScratchCard,
  canBuyTrashCan,
  canBuyUpgradeTool,
  canStartWorkFromPhase,
  createBasicSafeScratchCard,
  createLoanFromTemplate,
  getBasicSafeScratchCardPrizePoolForLevel,
  getBoundedPlatePosition,
  getLoanRepaymentFeedback,
  getNextUnlockMilestone,
  getOutcomeAmountLabel,
  getRandomPlateSpawnPosition,
  getScratchBrushRadius,
  getScratchCardLevelProgress,
  getUnlockMilestoneCurrentValue,
  getUnlockMilestoneProgress,
  getWorkBrokenPlatePenaltyForLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  isBrokenPlateEnabled,
  isPointInsideCircleBounds,
  LOAN_CONFIG,
  LOAN_REPAYMENT_AMOUNT,
  type LoanState,
  repayLoan,
  rollWorkReward,
  type ScratchCardState,
  type ScratchSurfacePoint,
  settleBasicSafeScratchCard,
  shouldCloseCleaningOverlay,
  shouldForceWrongScratchCardForLoan,
  shouldHandlePlatePointerDown,
  shouldOfferLoanPhone,
  shouldOpenPlateFromPointerUp,
  shouldShowScratchCover,
  shouldShowUpgradeToolsUnlockNotice,
  shouldShowWorkRiskNotice,
  TRASH_CAN_PRICE,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  type UnlockMilestoneId,
  UPGRADE_TOOLS_CONFIG,
  UPGRADE_TOOLS_MILESTONE_ID,
  type UpgradeToolConfig,
  WORK_ACTION_DURATION_MS,
  WORK_BROKEN_PLATE_CHANCE,
  WORK_PLATE_COST,
  WORK_SAFE_REWARD_CHANCE,
  type WorkPhase,
  type WorkPlateState,
} from '@/lib/game';
import { scratchLegendConfig } from '@/lib/game-config';
import {
  getActiveScratchCard,
  getActiveWorkPlate,
  isUnlockMilestoneUnlocked,
} from '@/lib/game-save';
import { useScratchLegendStore } from '@/lib/game-store';

const SCRATCH_MODE_MILESTONE_ID: UnlockMilestoneId = 'scratch-mode';
const DESKTOP_PLATE_SIZE = scratchLegendConfig.work.plate.desktopSize;
const PLATE_ENTER_ANIMATION_MS = scratchLegendConfig.work.plate.enterAnimationMs;
const PLATE_DRAG_HOLD_MS = scratchLegendConfig.work.drag.holdMs;
const PLATE_DRAG_MOVE_THRESHOLD = scratchLegendConfig.work.drag.moveThreshold;

type PlatePointerState = {
  plateId: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  holdReady: boolean;
  dragging: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
};

type ScratchCardPointerState = {
  cardId: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  holdReady: boolean;
  dragging: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
};

type LoanRepaymentFeedback = {
  loan: LoanState;
  loanIndex: number;
  amount: number;
  statusLabel: string;
  detailLabel: string;
  isFinal: boolean;
};

type UnlockToast = 'trash' | 'scratch' | 'upgrade' | null;
type PhoneNoticeType = 'loan' | 'scratch' | 'upgrade-tools' | 'work-risk' | null;

const SCRATCH_SYMBOL_LABELS = {
  fire: '火焰',
  cash: '纸钞',
  bag: '钱袋',
  blank: '未中',
} as const;

const SCRATCH_PHONE_LINES = [
  '你对自己的日常工作感到厌烦吗？',
  '我这里有个好东西，非常适合你......',
  '刮刮卡！',
] as const;

const UPGRADE_TOOLS_PHONE_LINES = [
  '刮起来是不是有点费力？',
  '别担心，我这正好有你要的东西——升级！',
  '升级到刮工具，刮起卡来轻轻松松！',
  '听我的，现在不升级，以后那些卡的涂层你根本刮不动......',
  '而且你还能升级运气呢，多稀罕呀！',
] as const;

const LOAN_PHONE_COPY =
  '大发慈悲给你一笔贷款。温馨提示，我们的贷款利率是 6000%。为了防止你不还，我们贴心地给你在右上角加了一个按钮，可以查看当前贷款。';

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScratchSymbolIcon({ symbol }: { symbol: keyof typeof SCRATCH_SYMBOL_LABELS }) {
  return (
    <span className={`scratch-symbol-icon ${symbol}`} aria-hidden="true">
      <span />
    </span>
  );
}

function UpgradeToolIcon({ toolId }: { toolId: UpgradeToolConfig['id'] }) {
  return <span className={`upgrade-tool-icon ${toolId}`} aria-hidden="true" />;
}

function getPrizeTierSymbol(tierId: ScratchCardState['result']['tierId']) {
  if (tierId === 'pair-fire') {
    return 'fire';
  }

  if (tierId === 'pair-cash') {
    return 'cash';
  }

  if (tierId === 'pair-bag') {
    return 'bag';
  }

  return 'blank';
}

export function ScratchLegendGame() {
  const save = useScratchLegendStore((state) => state.save);
  const sidebarTab = useScratchLegendStore((state) => state.sidebarTab);
  const hasHydrated = useScratchLegendStore((state) => state.hasHydrated);
  const setSidebarTab = useScratchLegendStore((state) => state.setSidebarTab);
  const updateSave = useScratchLegendStore((state) => state.updateSave);
  const [, setCleanProgress] = useState(0);
  const [scratchProgress, setScratchProgress] = useState(0);
  const [cleaningStartedAt, setCleaningStartedAt] = useState<number | null>(null);
  const [draggingPlateId, setDraggingPlateId] = useState<number | null>(null);
  const [liftedPlateId, setLiftedPlateId] = useState<number | null>(null);
  const [draggingScratchCardId, setDraggingScratchCardId] = useState<number | null>(null);
  const [liftedScratchCardId, setLiftedScratchCardId] = useState<number | null>(null);
  const [enteringPlateIds, setEnteringPlateIds] = useState<number[]>([]);
  const [enteringScratchCardIds, setEnteringScratchCardIds] = useState<number[]>([]);
  const [scratchPhoneStep, setScratchPhoneStep] = useState(0);
  const [unlockToast, setUnlockToast] = useState<UnlockToast>(null);
  const [trashHoverPlateId, setTrashHoverPlateId] = useState<number | null>(null);
  const [trashHoverScratchCardId, setTrashHoverScratchCardId] = useState<number | null>(null);
  const [loanLedgerOpen, setLoanLedgerOpen] = useState(false);
  const [loanRepaymentFeedback, setLoanRepaymentFeedback] = useState<LoanRepaymentFeedback | null>(
    null,
  );
  const [phoneMessageOpen, setPhoneMessageOpen] = useState(false);
  const [upgradeToolsPhoneStep, setUpgradeToolsPhoneStep] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const trashCanRef = useRef<HTMLDivElement | null>(null);
  const cleaningPlateRef = useRef<HTMLDivElement | null>(null);
  const scratchCardRef = useRef<HTMLDivElement | null>(null);
  const platePointerRef = useRef<PlatePointerState | null>(null);
  const scratchCardPointerRef = useRef<ScratchCardPointerState | null>(null);
  const plateEnterTimerRefs = useRef<number[]>([]);
  const unlockToastTimerRef = useRef<number | null>(null);
  const loanRepaymentTimerRef = useRef<number | null>(null);
  const previousTrashCanUnlockedRef = useRef(save.unlocks.trashCanUnlocked);
  const previousScratchModeUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, SCRATCH_MODE_MILESTONE_ID),
  );
  const previousUpgradeToolsUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, UPGRADE_TOOLS_MILESTONE_ID),
  );
  const unlockToastReadyRef = useRef(false);

  const player = save.player;
  const phase: WorkPhase = save.workspace.phase;
  const plates = save.workspace.plates;
  const activePlateId = save.workspace.activePlateId;
  const tableScratchCards = save.workspace.scratchCards;
  const activeScratchCard = getActiveScratchCard(save);
  const activeLoans = save.loans.activeLoans;
  const visibleLedgerLoans = loanRepaymentFeedback
    ? (() => {
        if (activeLoans.some((loan) => loan.id === loanRepaymentFeedback.loan.id)) {
          return activeLoans;
        }

        const loans = [...activeLoans];
        loans.splice(
          Math.min(loanRepaymentFeedback.loanIndex, loans.length),
          0,
          loanRepaymentFeedback.loan,
        );
        return loans;
      })()
    : activeLoans;
  const loanLedgerButtonVisible = activeLoans.length > 0 || loanRepaymentFeedback !== null;
  const loanLedgerVisible = loanLedgerOpen && visibleLedgerLoans.length > 0;
  const basicSafeLevelProgress = getScratchCardLevelProgress(
    'basic-safe',
    save.scratchCards.basicSafe.cardsSettled,
  );
  const basicSafePrizePool = useMemo(
    () => getBasicSafeScratchCardPrizePoolForLevel(basicSafeLevelProgress.level),
    [basicSafeLevelProgress.level],
  );
  const activeScratchCardPrizePool = useMemo(
    () =>
      getBasicSafeScratchCardPrizePoolForLevel(
        activeScratchCard?.level ?? basicSafeLevelProgress.level,
      ),
    [activeScratchCard?.level, basicSafeLevelProgress.level],
  );
  const activeScratchPrizeRows = activeScratchCardPrizePool.filter((tier) => tier.id !== 'no-pair');
  const trashCanUnlocked = save.unlocks.trashCanUnlocked;
  const trashCanPurchased = save.unlocks.trashCanPurchased;
  const trashCanAvailable = trashCanUnlocked && trashCanPurchased;
  const workRiskMessageDismissed = save.notices.workRiskMessageDismissed;
  const scratchMessageDismissed = save.notices.scratchMessageDismissed;
  const upgradeToolsMessageDismissed = save.notices.upgradeToolsMessageDismissed;
  const scratchModeUnlocked = isUnlockMilestoneUnlocked(save, SCRATCH_MODE_MILESTONE_ID);
  const upgradeToolsUnlocked = isUnlockMilestoneUnlocked(save, UPGRADE_TOOLS_MILESTONE_ID);
  const scratchCardVisible = scratchModeUnlocked && scratchMessageDismissed;
  const upgradeToolsVisible = upgradeToolsUnlocked && upgradeToolsMessageDismissed;

  const nextUnlockMilestone = getNextUnlockMilestone(player.lifetimeGoldEarned);
  const finalUnlockMilestone =
    scratchLegendConfig.progression.proficiencyMilestones[
      scratchLegendConfig.progression.proficiencyMilestones.length - 1
    ];
  const unlockProgressTarget =
    nextUnlockMilestone?.requiredProficiency ?? finalUnlockMilestone.requiredProficiency;
  const unlockProgressCurrent = getUnlockMilestoneCurrentValue(
    player.lifetimeGoldEarned,
    nextUnlockMilestone,
  );
  const scratchUnlockProgress = getUnlockMilestoneProgress(
    player.lifetimeGoldEarned,
    nextUnlockMilestone,
  );
  const workLevel = player.workLevel;
  const workLevelProgress = getWorkLevelProgress(player.plateCleaned);
  const previewRewardAmount = getWorkRewardAmountForLevel(workLevel);
  const brokenPlateEnabled = isBrokenPlateEnabled(workLevel);
  const workBrokenPlatePenalty = getWorkBrokenPlatePenaltyForLevel(workLevel);
  const scratchRadiusToolLevel = save.upgradeTools['scratch-radius']?.level ?? 0;
  const scratchBrushRadius = getScratchBrushRadius(scratchRadiusToolLevel, activeLoans);
  const workSafeRewardPercent = `${Math.round(
    (brokenPlateEnabled ? WORK_SAFE_REWARD_CHANCE : 1) * 100,
  )}%`;
  const workBrokenPlatePercent = `${Math.round(WORK_BROKEN_PLATE_CHANCE * 100)}%`;
  const canStartWork = canStartWorkFromPhase(phase, player.gold);
  const canBuyScratchCard =
    scratchCardVisible &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyBasicSafeScratchCard(player);
  const canPurchaseTrashCan = canBuyTrashCan(player.gold, trashCanUnlocked, trashCanPurchased);
  const isCleaningView = phase === 'cleaning' || phase === 'claimable';
  const activePlate = getActiveWorkPlate(save);
  const activeReward = activePlate?.reward ?? {
    base: previewRewardAmount,
    total: previewRewardAmount,
    isCrit: false,
    isBroken: false,
  };
  const workOutcomeRevealed = phase === 'claimable';
  const workClaimAmountLabel = getOutcomeAmountLabel(workOutcomeRevealed, activeReward.total);
  const workSafeOutcomeLabel =
    workOutcomeRevealed && !activeReward.isBroken
      ? getOutcomeAmountLabel(true, activeReward.total)
      : getOutcomeAmountLabel(false, previewRewardAmount);
  const workBrokenOutcomeLabel =
    workOutcomeRevealed && activeReward.isBroken
      ? getOutcomeAmountLabel(true, activeReward.total)
      : getOutcomeAmountLabel(false, -workBrokenPlatePenalty);
  const workRiskNoticeVisible = shouldShowWorkRiskNotice(workLevel, workRiskMessageDismissed);
  const scratchUnlockNoticeVisible = scratchModeUnlocked && !scratchMessageDismissed;
  const upgradeToolsUnlockNoticeVisible = shouldShowUpgradeToolsUnlockNotice(
    player.lifetimeGoldEarned,
    upgradeToolsMessageDismissed,
  );
  const loanOfferNoticeVisible =
    phase === 'idle' &&
    shouldOfferLoanPhone({
      gold: player.gold,
      plateCount: plates.length,
      activeScratchCard: tableScratchCards.length > 0,
      activeLoansCount: activeLoans.length,
    });
  const phoneNoticeType: PhoneNoticeType = scratchUnlockNoticeVisible
    ? 'scratch'
    : upgradeToolsUnlockNoticeVisible
      ? 'upgrade-tools'
      : loanOfferNoticeVisible
        ? 'loan'
        : workRiskNoticeVisible
          ? 'work-risk'
          : null;
  const phoneNoticePending = phoneNoticeType !== null;
  const phoneNoticeVisible = phoneNoticePending && phoneMessageOpen;

  const statusLabel = useMemo(() => {
    if (phase === 'idle' && plates.length === 0 && tableScratchCards.length === 0) {
      return '等待接单';
    }
    if (phase === 'plateSpawned') {
      return `待洗盘子 ${plates.length}`;
    }
    if (phase === 'cleaning') {
      return '清洁中';
    }
    if (phase === 'scratchCardSpawned') {
      return `待刮卡片 ${tableScratchCards.length}`;
    }
    if (phase === 'scratchingCard') {
      return activeScratchCard?.status === 'claimable' ? '可结算刮刮卡' : '刮卡中';
    }
    return '可领取';
  }, [activeScratchCard?.status, phase, plates.length, tableScratchCards.length]);

  useEffect(() => {
    return () => {
      if (platePointerRef.current?.holdTimer) {
        clearTimeout(platePointerRef.current.holdTimer);
      }

      if (scratchCardPointerRef.current?.holdTimer) {
        clearTimeout(scratchCardPointerRef.current.holdTimer);
      }

      for (const timer of plateEnterTimerRefs.current) {
        window.clearTimeout(timer);
      }

      if (unlockToastTimerRef.current) {
        window.clearTimeout(unlockToastTimerRef.current);
      }

      if (loanRepaymentTimerRef.current) {
        window.clearTimeout(loanRepaymentTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || unlockToastReadyRef.current) {
      return;
    }

    previousTrashCanUnlockedRef.current = trashCanUnlocked;
    previousScratchModeUnlockedRef.current = scratchModeUnlocked;
    previousUpgradeToolsUnlockedRef.current = upgradeToolsUnlocked;
    unlockToastReadyRef.current = true;
  }, [hasHydrated, scratchModeUnlocked, trashCanUnlocked, upgradeToolsUnlocked]);

  useEffect(() => {
    previousScratchModeUnlockedRef.current = scratchModeUnlocked;
  }, [scratchModeUnlocked]);

  useEffect(() => {
    previousUpgradeToolsUnlockedRef.current = upgradeToolsUnlocked;
  }, [upgradeToolsUnlocked]);

  useEffect(() => {
    if (!unlockToastReadyRef.current) {
      return;
    }

    if (trashCanUnlocked && !previousTrashCanUnlockedRef.current) {
      if (unlockToastTimerRef.current) {
        window.clearTimeout(unlockToastTimerRef.current);
      }

      setUnlockToast('trash');
      unlockToastTimerRef.current = window.setTimeout(() => {
        setUnlockToast(null);
        unlockToastTimerRef.current = null;
      }, 1800);
    }

    previousTrashCanUnlockedRef.current = trashCanUnlocked;
  }, [trashCanUnlocked]);

  useEffect(() => {
    if (activeLoans.length === 0 && !loanRepaymentFeedback) {
      setLoanLedgerOpen(false);
    }
  }, [activeLoans.length, loanRepaymentFeedback]);

  useEffect(() => {
    if (!phoneNoticePending) {
      setPhoneMessageOpen(false);
      setUpgradeToolsPhoneStep(0);
    }
  }, [phoneNoticePending]);

  function getDesktopPhase(plateCount: number, scratchCardCount: number): WorkPhase {
    if (scratchCardCount > 0) {
      return 'scratchCardSpawned';
    }

    if (plateCount > 0) {
      return 'plateSpawned';
    }

    return 'idle';
  }

  function updatePlatePositionFromPointer(
    plateId: number,
    clientX: number,
    clientY: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const table = tableRef.current;

    if (!table) {
      return;
    }

    const bounds = table.getBoundingClientRect();
    const position = getBoundedPlatePosition(
      {
        clientX: clientX - offsetX,
        clientY: clientY - offsetY,
      },
      bounds,
      DESKTOP_PLATE_SIZE,
    );

    updateSave((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        plates: current.workspace.plates.map((plate) =>
          plate.id === plateId ? { ...plate, position } : plate,
        ),
      },
    }));
  }

  function updateScratchCardPositionFromPointer(
    cardId: number,
    clientX: number,
    clientY: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const table = tableRef.current;

    if (!table) {
      return;
    }

    const bounds = table.getBoundingClientRect();
    const position = getBoundedPlatePosition(
      {
        clientX: clientX - offsetX,
        clientY: clientY - offsetY,
      },
      bounds,
      DESKTOP_PLATE_SIZE,
    );

    updateSave((current) => {
      return {
        ...current,
        workspace: {
          ...current.workspace,
          scratchCards: current.workspace.scratchCards.map((card) =>
            card.id === cardId ? { ...card, position } : card,
          ),
        },
      };
    });
  }

  function isPointerOverTrashCan(clientX: number, clientY: number) {
    const trashBounds = trashCanRef.current?.getBoundingClientRect();

    if (!trashBounds || !trashCanAvailable) {
      return false;
    }

    return (
      clientX >= trashBounds.left &&
      clientX <= trashBounds.right &&
      clientY >= trashBounds.top &&
      clientY <= trashBounds.bottom
    );
  }

  function resetPlatePointer() {
    if (platePointerRef.current?.holdTimer) {
      clearTimeout(platePointerRef.current.holdTimer);
    }

    platePointerRef.current = null;
    setDraggingPlateId(null);
    setLiftedPlateId(null);
    setTrashHoverPlateId(null);
  }

  function resetScratchCardPointer() {
    if (scratchCardPointerRef.current?.holdTimer) {
      clearTimeout(scratchCardPointerRef.current.holdTimer);
    }

    scratchCardPointerRef.current = null;
    setDraggingScratchCardId(null);
    setLiftedScratchCardId(null);
    setTrashHoverScratchCardId(null);
  }

  function startPlateDrag(pointerState: PlatePointerState) {
    pointerState.dragging = true;
    setDraggingPlateId(pointerState.plateId);
    setLiftedPlateId(pointerState.plateId);
    updatePlatePositionFromPointer(
      pointerState.plateId,
      pointerState.startX,
      pointerState.startY,
      pointerState.offsetX,
      pointerState.offsetY,
    );
  }

  function startScratchCardDrag(pointerState: ScratchCardPointerState) {
    pointerState.dragging = true;
    setDraggingScratchCardId(pointerState.cardId);
    setLiftedScratchCardId(pointerState.cardId);
    updateScratchCardPositionFromPointer(
      pointerState.cardId,
      pointerState.startX,
      pointerState.startY,
      pointerState.offsetX,
      pointerState.offsetY,
    );
  }

  function startWork() {
    if (!canStartWork) {
      return;
    }

    const plateId = save.workspace.nextPlateId;
    const goldAfterCost = player.gold - WORK_PLATE_COST;
    const plateReward = rollWorkReward({
      workOrderIndex: plateId - 1,
      gold: goldAfterCost,
      workLevel,
    });

    setCleanProgress(0);
    updateSave((current) => ({
      ...current,
      player: {
        ...current.player,
        gold: current.player.gold - WORK_PLATE_COST,
      },
      workspace: {
        ...current.workspace,
        phase: getDesktopPhase(
          current.workspace.plates.length + 1,
          current.workspace.scratchCards.length,
        ),
        nextPlateId: current.workspace.nextPlateId + 1,
        plates: [
          ...current.workspace.plates,
          {
            id: plateId,
            reward: plateReward,
            position: getRandomPlateSpawnPosition(),
            cleanPoints: [],
            seed: plateId,
          },
        ],
      },
    }));
    setEnteringPlateIds((current) => [...current, plateId]);
    const enterTimer = window.setTimeout(() => {
      setEnteringPlateIds((current) => current.filter((id) => id !== plateId));
    }, PLATE_ENTER_ANIMATION_MS);
    plateEnterTimerRefs.current.push(enterTimer);
  }

  function buyBasicSafeScratchCard() {
    if (!canBuyScratchCard) {
      return;
    }

    const scratchCardId = save.workspace.nextScratchCardId;
    const scratchCard = createBasicSafeScratchCard({
      id: scratchCardId,
      level: basicSafeLevelProgress.level,
      forcedTierId: shouldForceWrongScratchCardForLoan(activeLoans, scratchCardId)
        ? 'no-pair'
        : undefined,
    });

    setScratchProgress(0);
    updateSave((current) => ({
      ...current,
      player: {
        ...current.player,
        gold: current.player.gold - BASIC_SAFE_CARD_PRICE,
      },
      workspace: {
        ...current.workspace,
        phase: 'scratchCardSpawned',
        scratchCards: [...current.workspace.scratchCards, scratchCard],
        nextScratchCardId: current.workspace.nextScratchCardId + 1,
      },
    }));
    setEnteringScratchCardIds((current) => [...current, scratchCardId]);
    const enterTimer = window.setTimeout(() => {
      setEnteringScratchCardIds((current) => current.filter((id) => id !== scratchCardId));
    }, PLATE_ENTER_ANIMATION_MS);
    plateEnterTimerRefs.current.push(enterTimer);
  }

  function openScratchCard(cardId: number) {
    const selectedCard = tableScratchCards.find((card) => card.id === cardId);

    if (phase !== 'scratchCardSpawned' || !selectedCard) {
      return;
    }

    setScratchProgress(selectedCard.status === 'claimable' ? 1 : 0);
    updateSave((current) => {
      const currentCard = current.workspace.scratchCards.find((card) => card.id === cardId);

      if (!currentCard) {
        return current;
      }

      const nextStatus = currentCard.status === 'claimable' ? 'claimable' : 'scratching';

      return {
        ...current,
        workspace: {
          ...current.workspace,
          phase: 'scratchingCard',
          activeScratchCardId: cardId,
          scratchCards: current.workspace.scratchCards.map((card) =>
            card.id === cardId ? { ...card, status: nextStatus } : card,
          ),
        },
      };
    });
  }

  function closeScratchCardView() {
    if (!activeScratchCard) {
      return;
    }

    setScratchProgress(activeScratchCard.status === 'claimable' ? 1 : 0);
    updateSave((current) => {
      if (!current.workspace.activeScratchCardId) {
        return current;
      }

      return {
        ...current,
        workspace: {
          ...current.workspace,
          phase: getDesktopPhase(
            current.workspace.plates.length,
            current.workspace.scratchCards.length,
          ),
          activeScratchCardId: null,
        },
      };
    });
  }

  function openCleaningView(plateId: number) {
    if (phase === 'plateSpawned' || phase === 'scratchCardSpawned') {
      resetPlatePointer();
      setCleanProgress(0);
      setCleaningStartedAt(Date.now());
      updateSave((current) => ({
        ...current,
        workspace: {
          ...current.workspace,
          activePlateId: plateId,
          phase: 'cleaning',
        },
      }));
    }
  }

  function closeCleaningView() {
    if (!activePlateId) {
      return;
    }

    setCleanProgress(0);
    setCleaningStartedAt(null);
    updateSave((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        activePlateId: null,
        phase: getDesktopPhase(
          current.workspace.plates.length,
          current.workspace.scratchCards.length,
        ),
      },
    }));
  }

  function recordActivePlateCleanPoint(point: ScratchSurfacePoint) {
    updateSave((current) => {
      const activeId = current.workspace.activePlateId;

      if (!activeId) {
        return current;
      }

      return {
        ...current,
        workspace: {
          ...current.workspace,
          plates: current.workspace.plates.map((plate) =>
            plate.id === activeId
              ? { ...plate, cleanPoints: [...plate.cleanPoints, point] }
              : plate,
          ),
        },
      };
    });
  }

  function recordActiveScratchPoint(point: ScratchSurfacePoint) {
    updateSave((current) => {
      const activeId = current.workspace.activeScratchCardId;

      if (!activeId) {
        return current;
      }

      return {
        ...current,
        workspace: {
          ...current.workspace,
          scratchCards: current.workspace.scratchCards.map((card) =>
            card.id === activeId
              ? { ...card, scratchPoints: [...card.scratchPoints, point] }
              : card,
          ),
        },
      };
    });
  }

  function handleCleaningViewPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const plateBounds = cleaningPlateRef.current?.getBoundingClientRect();
    const clickedInsidePlate = plateBounds
      ? isPointInsideCircleBounds({ clientX: event.clientX, clientY: event.clientY }, plateBounds)
      : false;
    const clickedControl = Boolean(
      event.target instanceof Element && event.target.closest('[data-cleaning-control="true"]'),
    );

    if (
      shouldCloseCleaningOverlay(
        phase,
        event.target === event.currentTarget,
        clickedInsidePlate,
        clickedControl,
      )
    ) {
      closeCleaningView();
    }
  }

  function handleScratchCardViewPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const clickedControl = Boolean(
      event.target instanceof Element && event.target.closest('[data-scratch-control="true"]'),
    );

    if (
      event.target === event.currentTarget ||
      (!clickedControl && !scratchCardRef.current?.contains(event.target as Node))
    ) {
      closeScratchCardView();
    }
  }

  function handlePlatePointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    plate: WorkPlateState,
  ) {
    if (!shouldHandlePlatePointerDown(phase)) {
      return;
    }

    resetPlatePointer();
    event.currentTarget.setPointerCapture(event.pointerId);

    const tableBounds = tableRef.current?.getBoundingClientRect();
    const plateCenterX = tableBounds
      ? tableBounds.left + (plate.position.xPercent / 100) * tableBounds.width
      : event.clientX;
    const plateCenterY = tableBounds
      ? tableBounds.top + (plate.position.yPercent / 100) * tableBounds.height
      : event.clientY;

    const pointerState: PlatePointerState = {
      plateId: plate.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - plateCenterX,
      offsetY: event.clientY - plateCenterY,
      holdReady: false,
      dragging: false,
      holdTimer: null,
    };

    pointerState.holdTimer = setTimeout(() => {
      pointerState.holdReady = true;
      setLiftedPlateId(pointerState.plateId);
    }, PLATE_DRAG_HOLD_MS);

    platePointerRef.current = pointerState;
  }

  function handlePlatePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerState = platePointerRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerState.startX,
      event.clientY - pointerState.startY,
    );

    if (
      !pointerState.dragging &&
      pointerState.holdReady &&
      movedDistance >= PLATE_DRAG_MOVE_THRESHOLD
    ) {
      startPlateDrag(pointerState);
    }

    if (!pointerState.dragging) {
      return;
    }

    event.preventDefault();
    updatePlatePositionFromPointer(
      pointerState.plateId,
      event.clientX,
      event.clientY,
      pointerState.offsetX,
      pointerState.offsetY,
    );
    setTrashHoverPlateId(
      isPointerOverTrashCan(event.clientX, event.clientY) ? pointerState.plateId : null,
    );
  }

  function handlePlatePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerState = platePointerRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const wasDragged = pointerState.dragging;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (wasDragged && isPointerOverTrashCan(event.clientX, event.clientY)) {
      updateSave((current) => {
        const remainingPlates = current.workspace.plates.filter(
          (plate) => plate.id !== pointerState.plateId,
        );

        return {
          ...current,
          workspace: {
            ...current.workspace,
            plates: remainingPlates,
            phase: getDesktopPhase(remainingPlates.length, current.workspace.scratchCards.length),
          },
        };
      });
      resetPlatePointer();
      return;
    }

    if (shouldOpenPlateFromPointerUp(wasDragged, false) && !pointerState.holdReady) {
      const plateId = pointerState.plateId;
      resetPlatePointer();
      openCleaningView(plateId);
      return;
    }

    resetPlatePointer();
  }

  function handleScratchCardPointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    card: ScratchCardState,
  ) {
    if (phase !== 'scratchCardSpawned') {
      return;
    }

    resetScratchCardPointer();
    event.currentTarget.setPointerCapture(event.pointerId);

    const tableBounds = tableRef.current?.getBoundingClientRect();
    const cardCenterX = tableBounds
      ? tableBounds.left + (card.position.xPercent / 100) * tableBounds.width
      : event.clientX;
    const cardCenterY = tableBounds
      ? tableBounds.top + (card.position.yPercent / 100) * tableBounds.height
      : event.clientY;

    const pointerState: ScratchCardPointerState = {
      cardId: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - cardCenterX,
      offsetY: event.clientY - cardCenterY,
      holdReady: false,
      dragging: false,
      holdTimer: null,
    };

    pointerState.holdTimer = setTimeout(() => {
      pointerState.holdReady = true;
      setLiftedScratchCardId(pointerState.cardId);
    }, PLATE_DRAG_HOLD_MS);

    scratchCardPointerRef.current = pointerState;
  }

  function handleScratchCardPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerState = scratchCardPointerRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const movedDistance = Math.hypot(
      event.clientX - pointerState.startX,
      event.clientY - pointerState.startY,
    );

    if (
      !pointerState.dragging &&
      pointerState.holdReady &&
      movedDistance >= PLATE_DRAG_MOVE_THRESHOLD
    ) {
      startScratchCardDrag(pointerState);
    }

    if (!pointerState.dragging) {
      return;
    }

    event.preventDefault();
    updateScratchCardPositionFromPointer(
      pointerState.cardId,
      event.clientX,
      event.clientY,
      pointerState.offsetX,
      pointerState.offsetY,
    );
    setTrashHoverScratchCardId(
      isPointerOverTrashCan(event.clientX, event.clientY) ? pointerState.cardId : null,
    );
  }

  function handleScratchCardPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const pointerState = scratchCardPointerRef.current;

    if (!pointerState || pointerState.pointerId !== event.pointerId) {
      return;
    }

    const wasDragged = pointerState.dragging;
    const droppedOnTrashCan = wasDragged && isPointerOverTrashCan(event.clientX, event.clientY);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (droppedOnTrashCan) {
      updateSave((current) => {
        const remainingScratchCards = current.workspace.scratchCards.filter(
          (card) => card.id !== pointerState.cardId,
        );

        return {
          ...current,
          workspace: {
            ...current.workspace,
            scratchCards: remainingScratchCards,
            activeScratchCardId: null,
            phase: getDesktopPhase(current.workspace.plates.length, remainingScratchCards.length),
          },
        };
      });
      setScratchProgress(0);
      resetScratchCardPointer();
      return;
    }

    if (!wasDragged && !pointerState.holdReady) {
      const cardId = pointerState.cardId;
      resetScratchCardPointer();
      openScratchCard(cardId);
      return;
    }

    resetScratchCardPointer();
  }

  function completeCleaning() {
    const elapsed = Date.now() - (cleaningStartedAt ?? Date.now());
    const delay = Math.max(0, WORK_ACTION_DURATION_MS - elapsed);

    window.setTimeout(() => {
      updateSave((current) => ({
        ...current,
        workspace: {
          ...current.workspace,
          phase: 'claimable',
        },
      }));
    }, delay);
  }

  function claimReward() {
    if (phase !== 'claimable') {
      return;
    }

    const claimedPlate = activePlate;

    if (!claimedPlate) {
      return;
    }

    updateSave((current) => {
      const remainingPlates = current.workspace.plates.filter(
        (plate) => plate.id !== claimedPlate.id,
      );

      return {
        ...current,
        player: {
          ...current.player,
          gold: Math.max(0, current.player.gold + claimedPlate.reward.total),
          lifetimeGoldEarned:
            current.player.lifetimeGoldEarned + Math.max(0, claimedPlate.reward.total),
          plateCleaned: current.player.plateCleaned + 1,
        },
        workspace: {
          ...current.workspace,
          activePlateId: null,
          plates: remainingPlates,
          phase: getDesktopPhase(remainingPlates.length, current.workspace.scratchCards.length),
        },
      };
    });
    setCleanProgress(0);
  }

  function completeScratchCard() {
    setScratchProgress(1);
    updateSave((current) => {
      const activeCardId = current.workspace.activeScratchCardId;

      if (!activeCardId) {
        return current;
      }

      return {
        ...current,
        workspace: {
          ...current.workspace,
          scratchCards: current.workspace.scratchCards.map((card) =>
            card.id === activeCardId ? { ...card, status: 'claimable' } : card,
          ),
        },
      };
    });
  }

  function claimScratchCardPrize() {
    if (!activeScratchCard || activeScratchCard.status !== 'claimable') {
      return;
    }

    updateSave((current) => {
      const currentCard = getActiveScratchCard(current);

      if (!currentCard) {
        return current;
      }

      const remainingScratchCards = current.workspace.scratchCards.filter(
        (card) => card.id !== currentCard.id,
      );

      return {
        ...current,
        player: settleBasicSafeScratchCard(current.player, currentCard),
        scratchCards: {
          ...current.scratchCards,
          basicSafe: advanceBasicSafeScratchCardProgress(current.scratchCards.basicSafe),
        },
        workspace: {
          ...current.workspace,
          scratchCards: remainingScratchCards,
          activeScratchCardId: null,
          phase: getDesktopPhase(current.workspace.plates.length, remainingScratchCards.length),
        },
      };
    });
    setScratchProgress(0);
  }

  function signEmergencyLoan() {
    if (!loanOfferNoticeVisible) {
      return;
    }

    updateSave((current) => {
      const loan = createLoanFromTemplate({
        id: current.loans.nextLoanId,
        templateIndex: current.loans.nextLoanTemplateIndex,
      });

      return {
        ...current,
        player: {
          ...current.player,
          gold: current.player.gold + loan.signGold,
        },
        loans: {
          activeLoans: [...current.loans.activeLoans, loan],
          nextLoanId: current.loans.nextLoanId + 1,
          nextLoanTemplateIndex: current.loans.nextLoanTemplateIndex + 1,
        },
      };
    });
    setLoanLedgerOpen(true);
  }

  function buyTrashCan() {
    if (!canPurchaseTrashCan) {
      return;
    }

    updateSave((current) => ({
      ...current,
      player: {
        ...current.player,
        gold: current.player.gold - TRASH_CAN_PRICE,
      },
      unlocks: {
        ...current.unlocks,
        trashCanPurchased: true,
      },
    }));
  }

  function buyUpgradeTool(tool: UpgradeToolConfig) {
    if (!upgradeToolsVisible) {
      return;
    }

    updateSave((current) => {
      const currentToolState = current.upgradeTools[tool.id];

      if (!currentToolState || !canBuyUpgradeTool(current.player.gold, tool, currentToolState)) {
        return current;
      }

      return {
        ...current,
        player: {
          ...current.player,
          gold: current.player.gold - tool.price,
        },
        upgradeTools: {
          ...current.upgradeTools,
          [tool.id]: {
            level: currentToolState.level + 1,
          },
        },
      };
    });
  }

  function repayActiveLoan(loanId: number) {
    if (loanRepaymentFeedback) {
      return;
    }

    const repaidLoanIndex = activeLoans.findIndex((item) => item.id === loanId);
    const repaidLoan = activeLoans[repaidLoanIndex];

    if (!repaidLoan || player.gold < repaidLoan.amount) {
      return;
    }

    const repaymentFeedback = getLoanRepaymentFeedback(repaidLoan);
    const isFinalLoan = activeLoans.length === 1;

    setLoanRepaymentFeedback({
      loan: repaidLoan,
      loanIndex: repaidLoanIndex,
      amount: repaidLoan.amount,
      statusLabel: repaymentFeedback.statusLabel,
      detailLabel: repaymentFeedback.detailLabel,
      isFinal: isFinalLoan,
    });

    if (loanRepaymentTimerRef.current) {
      window.clearTimeout(loanRepaymentTimerRef.current);
    }

    loanRepaymentTimerRef.current = window.setTimeout(() => {
      setLoanRepaymentFeedback(null);
      loanRepaymentTimerRef.current = null;

      if (isFinalLoan) {
        setLoanLedgerOpen(false);
      }
    }, 1150);

    updateSave((current) => {
      const loan = current.loans.activeLoans.find((item) => item.id === loanId);

      if (!loan || current.player.gold < loan.amount) {
        return current;
      }

      const remainingLoans = current.loans.activeLoans.filter((item) => item.id !== loanId);

      return {
        ...current,
        player: {
          ...current.player,
          gold: repayLoan(current.player.gold, loan),
        },
        loans: {
          ...current.loans,
          activeLoans: remainingLoans,
        },
      };
    });
  }

  function advanceScratchUnlockPhone() {
    if (scratchPhoneStep < SCRATCH_PHONE_LINES.length - 1) {
      setScratchPhoneStep((current) => current + 1);
      return;
    }

    updateSave((current) => ({
      ...current,
      notices: {
        ...current.notices,
        scratchMessageDismissed: true,
      },
    }));

    if (unlockToastTimerRef.current) {
      window.clearTimeout(unlockToastTimerRef.current);
    }

    setUnlockToast('scratch');
    unlockToastTimerRef.current = window.setTimeout(() => {
      setUnlockToast(null);
      unlockToastTimerRef.current = null;
    }, 1800);
  }

  function advanceUpgradeToolsUnlockPhone() {
    if (upgradeToolsPhoneStep < UPGRADE_TOOLS_PHONE_LINES.length - 1) {
      setUpgradeToolsPhoneStep((current) => current + 1);
      return;
    }

    updateSave((current) => ({
      ...current,
      notices: {
        ...current.notices,
        upgradeToolsMessageDismissed: true,
      },
    }));

    if (unlockToastTimerRef.current) {
      window.clearTimeout(unlockToastTimerRef.current);
    }

    setUnlockToast('upgrade');
    unlockToastTimerRef.current = window.setTimeout(() => {
      setUnlockToast(null);
      unlockToastTimerRef.current = null;
    }, 1800);
  }

  return (
    <main className="scratch-shell select-none">
      <section className="game-frame" aria-label="刮出传说游戏界面">
        <aside className="left-panel">
          <div className="coin-board">
            <div className="coin-row">
              <span className="coin-icon">$</span>
              <strong>{player.gold}</strong>
            </div>
            <div className="ticket-progress">
              <small>熟练度</small>
              <span>
                {unlockProgressCurrent}/{unlockProgressTarget}
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill amber"
                  style={{ width: `${scratchUnlockProgress * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="tab-row">
            <button
              className={`tab ${sidebarTab === 'cards' ? 'active' : ''}`}
              type="button"
              onClick={() => setSidebarTab('cards')}
            >
              刮刮卡
            </button>
            <button
              className={`tab ${sidebarTab === 'tools' ? 'active' : ''}`}
              type="button"
              onClick={() => setSidebarTab('tools')}
            >
              辅助道具
            </button>
          </div>

          {sidebarTab === 'cards' ? (
            <>
              <button
                className={`work-card ${canStartWork ? '' : 'busy'}`}
                type="button"
                onClick={startWork}
                disabled={!canStartWork}
              >
                <span className="work-icon">
                  <span className="mini-plate" />
                  <span className="mini-sponge" />
                </span>
                <span className="work-copy">
                  <strong>日常工作</strong>
                  <em>${WORK_PLATE_COST}</em>
                  <small>等级 {workLevel}</small>
                </span>
                <span
                  className="work-meter"
                  role="progressbar"
                  aria-label="日常工作等级进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(workLevelProgress * 100)}
                >
                  <span style={{ width: `${Math.max(12, workLevelProgress * 100)}%` }} />
                </span>
              </button>

              {scratchCardVisible && (
                <button
                  className={`scratch-shop-card ${canBuyScratchCard ? '' : 'locked'}`}
                  type="button"
                  onClick={buyBasicSafeScratchCard}
                  disabled={!canBuyScratchCard}
                >
                  <span className="scratch-ticket-icon">
                    <span>2w</span>
                  </span>
                  <span className="scratch-shop-copy">
                    <small>Catalog #1</small>
                    <strong>成双入对</strong>
                    <em>${BASIC_SAFE_CARD_PRICE}</em>
                    <small>
                      小奖 $
                      {basicSafePrizePool.find((tier) => tier.id === 'pair-fire')?.payout ?? 0}
                    </small>
                  </span>
                  <span className="scratch-shop-meta">
                    <span className="scratch-level-badge">Lv. {basicSafeLevelProgress.level}</span>
                    <span
                      className="scratch-level-meter"
                      role="progressbar"
                      aria-label="成双入对等级进度"
                      aria-valuemin={0}
                      aria-valuemax={basicSafeLevelProgress.target}
                      aria-valuenow={basicSafeLevelProgress.current}
                    >
                      <span
                        style={{
                          width: `${Math.max(10, basicSafeLevelProgress.ratio * 100)}%`,
                        }}
                      />
                    </span>
                    <small>
                      {basicSafeLevelProgress.target > 0
                        ? `${basicSafeLevelProgress.current}/${basicSafeLevelProgress.target}`
                        : 'MAX'}
                    </small>
                  </span>
                </button>
              )}

              <div className="sidebar-note">
                <strong>下一目标</strong>
                <span>
                  {nextUnlockMilestone
                    ? `熟练度达到 ${nextUnlockMilestone.requiredProficiency} 解锁${nextUnlockMilestone.label}`
                    : '熟练度里程碑已全部达成'}
                </span>
              </div>
            </>
          ) : (
            <div className="tool-panel">
              {trashCanPurchased ? (
                <div className="tool-card available">
                  <span className="tool-icon trash-preview" />
                  <div>
                    <strong>垃圾桶</strong>
                    <span>已解锁，可把桌面脏盘子拖进去直接处理掉。</span>
                  </div>
                  <em>已购买</em>
                </div>
              ) : trashCanUnlocked ? (
                <button
                  className={`tool-card available buyable ${canPurchaseTrashCan ? '' : 'locked'}`}
                  type="button"
                  onClick={buyTrashCan}
                  disabled={!canPurchaseTrashCan}
                >
                  <span className="tool-icon trash-preview" />
                  <div>
                    <strong>垃圾桶</strong>
                    <span>已解锁，花费 ${TRASH_CAN_PRICE} 后可拖入盘子或刮刮卡。</span>
                  </div>
                  <em>${TRASH_CAN_PRICE}</em>
                </button>
              ) : (
                <>
                  <div className="tool-card locked placeholder">
                    <span className="tool-lock">锁</span>
                    <div>
                      <strong>未解锁</strong>
                      <span>熟练度达到 {TRASH_CAN_UNLOCK_AFTER_PLATES} 后解锁购买资格。</span>
                    </div>
                  </div>
                  <div className="tool-card locked placeholder">
                    <span className="tool-lock">锁</span>
                    <div>
                      <strong>未解锁</strong>
                      <span>后续阶段开放更多辅助道具。</span>
                    </div>
                  </div>
                  <div className="tool-card locked placeholder">
                    <span className="tool-lock">锁</span>
                    <div>
                      <strong>未解锁</strong>
                      <span>当前只保留占位，不提前实现后续功能。</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        <section className="table-stage">
          <div className="stage-topbar">
            <StatusPill label="状态" value={statusLabel} />
            <StatusPill label="已洗盘子" value={`${player.plateCleaned}`} />
            <StatusPill label="刮卡次数" value={`${player.cardsScratched}`} />
            {loanLedgerButtonVisible && (
              <button
                className={`loan-ledger-button ${
                  loanRepaymentFeedback?.isFinal ? 'settling-final' : ''
                }`}
                type="button"
                onClick={() => setLoanLedgerOpen(true)}
                aria-label="查看当前贷款"
              >
                <span className="loan-ledger-icon" aria-hidden="true" />
                <span>贷款</span>
                <strong>{activeLoans.length || 1}</strong>
              </button>
            )}
          </div>

          <div className="wood-table" ref={tableRef}>
            <div className="table-surface" aria-hidden="true" />
            <div className="table-furniture" aria-hidden="true">
              <span className="table-apron" />
              <span className="table-leg left" />
              <span className="table-leg right" />
            </div>

            <button
              className={`phone ${phoneNoticePending ? 'ringing' : ''}`}
              type="button"
              onClick={() => {
                if (phoneNoticePending) {
                  setPhoneMessageOpen(true);
                }
              }}
              disabled={!phoneNoticePending}
              aria-label={phoneNoticePending ? '接听电话提醒' : '电话'}
            >
              <span className="phone-dial" />
            </button>

            {phase === 'idle' && (
              <div className="idle-hint">
                <strong>刮个不停</strong>
                <span>先赚启动金，再去买第一张刮刮卡。</span>
              </div>
            )}

            {(phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
              plates.map((plate, index) => (
                <button
                  className={`small-dirty-plate ${
                    enteringPlateIds.includes(plate.id) ? 'entering' : ''
                  } ${liftedPlateId === plate.id ? 'lifted' : ''} ${
                    draggingPlateId === plate.id ? 'dragging' : ''
                  }`}
                  type="button"
                  key={plate.id}
                  style={{
                    left: `${plate.position.xPercent}%`,
                    top: `${plate.position.yPercent}%`,
                    zIndex: draggingPlateId === plate.id ? 5 : 2 + index,
                  }}
                  onPointerDown={(event) => handlePlatePointerDown(event, plate)}
                  onPointerMove={handlePlatePointerMove}
                  onPointerUp={handlePlatePointerUp}
                  onPointerCancel={resetPlatePointer}
                  aria-label={`点击第 ${index + 1} 个脏盘子开始清洁`}
                  aria-grabbed={draggingPlateId === plate.id}
                >
                  <span />
                </button>
              ))}

            {phase === 'scratchCardSpawned' &&
              tableScratchCards.map((scratchCard, index) => (
                <button
                  className={`tabletop-scratch-card ${
                    enteringScratchCardIds.includes(scratchCard.id) ? 'entering' : ''
                  } ${liftedScratchCardId === scratchCard.id ? 'lifted' : ''} ${
                    draggingScratchCardId === scratchCard.id ? 'dragging' : ''
                  }`}
                  type="button"
                  key={scratchCard.id}
                  style={{
                    left: `${scratchCard.position.xPercent}%`,
                    top: `${scratchCard.position.yPercent}%`,
                    zIndex: draggingScratchCardId === scratchCard.id ? 6 : 3 + index,
                  }}
                  onPointerDown={(event) => handleScratchCardPointerDown(event, scratchCard)}
                  onPointerMove={handleScratchCardPointerMove}
                  onPointerUp={handleScratchCardPointerUp}
                  onPointerCancel={resetScratchCardPointer}
                  aria-label={`打开第 ${index + 1} 张成双入对刮刮卡`}
                  aria-grabbed={draggingScratchCardId === scratchCard.id}
                >
                  <span className="tabletop-ticket-title">TWO$WIN</span>
                  <span className="tabletop-ticket-art" aria-hidden="true">
                    <span className="tabletop-art-sky" />
                    <span className="tabletop-art-mountain tall" />
                    <span className="tabletop-art-mountain low" />
                    <span className="tabletop-art-sun" />
                  </span>
                  <span className="tabletop-ticket-slots">???</span>
                </button>
              ))}

            {phase === 'scratchingCard' && activeScratchCard && (
              <div className="scratch-card-view" onPointerDown={handleScratchCardViewPointerDown}>
                <div
                  className={`scratch-card ${activeScratchCard.result.tierId}`}
                  ref={scratchCardRef}
                >
                  <div className="scratch-card-header">
                    <span>TWO$WIN</span>
                    <strong>成双入对 Lv. {activeScratchCard.level}</strong>
                  </div>
                  <div className="scratch-card-picture" aria-hidden="true">
                    <span className="mountain tall" />
                    <span className="mountain low" />
                    <span className="sun" />
                  </div>
                  <div className="scratch-result-area">
                    <fieldset className="scratch-result-grid" aria-label="刮刮卡结果区">
                      {activeScratchCard.result.symbols.map((symbol, index) => (
                        <span
                          className={`scratch-result-slot ${symbol}`}
                          key={`${symbol}-${index}`}
                        >
                          <ScratchSymbolIcon symbol={symbol} />
                          <small>{SCRATCH_SYMBOL_LABELS[symbol]}</small>
                        </span>
                      ))}
                    </fieldset>
                    <ScratchCardCanvas
                      key={activeScratchCard.id}
                      active={activeScratchCard.status === 'scratching'}
                      visible={shouldShowScratchCover(activeScratchCard.status, scratchProgress)}
                      scratchPoints={activeScratchCard.scratchPoints}
                      brushRadius={scratchBrushRadius}
                      stepDistance={
                        scratchLegendConfig.scratchCards.basicSafe.scratchBrush.stepDistance
                      }
                      onProgressChange={setScratchProgress}
                      onScratchPoint={recordActiveScratchPoint}
                      onComplete={completeScratchCard}
                    />
                  </div>
                </div>
                <div className="scratch-info-card" data-scratch-control="true">
                  <div className="scratch-info-title">
                    <strong>成双入对</strong>
                    <em>Lv. {activeScratchCard.level}</em>
                  </div>
                  <span>
                    {activeScratchCard.status === 'claimable'
                      ? activeScratchCard.result.isWinning
                        ? '刮出一对，可以结算。'
                        : '没有成对，本张 $0。'
                      : `拖动刮开，已揭露 ${Math.round(scratchProgress * 100)}%`}
                  </span>
                  <div className="scratch-rule-row">
                    <em>规则</em>
                    <b>刮出一对即可获胜</b>
                  </div>
                  {activeScratchPrizeRows.map((tier) => (
                    <div className="scratch-rule-row" key={tier.id}>
                      <em className="scratch-rule-symbol">
                        <ScratchSymbolIcon symbol={getPrizeTierSymbol(tier.id)} />
                        {tier.label.replace('成对', '')}
                      </em>
                      <b>
                        {Math.round((tier.displayProbability ?? tier.probability) * 100)}%{' / '}$
                        {tier.payout}
                      </b>
                    </div>
                  ))}
                  <div className="scratch-card-level-line">
                    <em>等级进度</em>
                    <b>
                      {basicSafeLevelProgress.target > 0
                        ? `${basicSafeLevelProgress.current}/${basicSafeLevelProgress.target}`
                        : 'MAX'}
                    </b>
                  </div>
                  <button
                    type="button"
                    onClick={claimScratchCardPrize}
                    disabled={activeScratchCard.status !== 'claimable'}
                  >
                    {getOutcomeAmountLabel(
                      activeScratchCard.status === 'claimable',
                      activeScratchCard.result.isWinning ? activeScratchCard.result.payout : 0,
                    )}
                  </button>
                </div>
              </div>
            )}

            {trashCanAvailable && (
              <div
                ref={trashCanRef}
                className={`trash-can ${trashHoverPlateId || trashHoverScratchCardId ? 'open' : ''}`}
                role="img"
                aria-label="垃圾桶"
              >
                <span className="trash-lid" />
                <span className="trash-body" />
              </div>
            )}

            {unlockToast && (
              <div className={`unlock-toast ${unlockToast}`}>
                <div className={`unlock-icon ${unlockToast}`} />
                <strong>
                  {unlockToast === 'scratch'
                    ? '刮刮卡！'
                    : unlockToast === 'upgrade'
                      ? '已解锁'
                      : '已解锁'}
                </strong>
                <span>
                  {unlockToast === 'scratch'
                    ? '成双入对已上架'
                    : unlockToast === 'upgrade'
                      ? '升级工具'
                      : '垃圾桶'}
                </span>
              </div>
            )}

            {phoneNoticeVisible && (
              <div className="phone-message">
                {phoneNoticeType === 'loan' ? (
                  <>
                    <strong>电话提醒</strong>
                    <span>{LOAN_PHONE_COPY}</span>
                    <div className="phone-loan-terms">
                      <em>到账</em>
                      <b>${LOAN_CONFIG.principal}</b>
                      <em>偿还</em>
                      <b>${LOAN_REPAYMENT_AMOUNT}</b>
                    </div>
                    <button
                      className="fingerprint-sign-button"
                      type="button"
                      onClick={signEmergencyLoan}
                    >
                      <span aria-hidden="true" />
                      指纹签字
                    </button>
                  </>
                ) : phoneNoticeType === 'scratch' ? (
                  <>
                    <strong>电话提醒</strong>
                    <span>{SCRATCH_PHONE_LINES[scratchPhoneStep]}</span>
                    <button type="button" onClick={advanceScratchUnlockPhone}>
                      {scratchPhoneStep < SCRATCH_PHONE_LINES.length - 1 ? '继续听' : '看看好东西'}
                    </button>
                  </>
                ) : phoneNoticeType === 'upgrade-tools' ? (
                  <>
                    <strong>电话提醒</strong>
                    <span>{UPGRADE_TOOLS_PHONE_LINES[upgradeToolsPhoneStep]}</span>
                    <button type="button" onClick={advanceUpgradeToolsUnlockPhone}>
                      {upgradeToolsPhoneStep < UPGRADE_TOOLS_PHONE_LINES.length - 1
                        ? '继续听'
                        : '打开升级'}
                    </button>
                  </>
                ) : (
                  <>
                    <strong>电话提醒</strong>
                    <span>
                      日常工作升到等级{' '}
                      {scratchLegendConfig.notifications.phone.brokenPlateNoticeLevel}{' '}
                      了，之后擦盘子有 {workBrokenPlatePercent} 概率把盘子擦坏。
                    </span>
                    <div className="phone-risk-grid">
                      <div className="phone-risk-row">
                        <em>{workSafeRewardPercent}</em>
                        <b>+${previewRewardAmount}</b>
                      </div>
                      <div className="phone-risk-row danger">
                        <em>{workBrokenPlatePercent}</em>
                        <b>-${workBrokenPlatePenalty}</b>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateSave((current) => ({
                          ...current,
                          notices: {
                            ...current.notices,
                            workRiskMessageDismissed: true,
                          },
                        }))
                      }
                    >
                      我知道了
                    </button>
                  </>
                )}
              </div>
            )}

            {loanLedgerVisible && (
              <div className="loan-ledger-overlay" role="dialog" aria-label="当前贷款列表">
                <div className="loan-ledger-panel">
                  <header>
                    <strong>当前贷款</strong>
                    <span>利率 {LOAN_CONFIG.interestRateLabel}</span>
                  </header>
                  {loanRepaymentFeedback && (
                    <div
                      className={`loan-repayment-feedback ${
                        loanRepaymentFeedback.isFinal ? 'final' : ''
                      }`}
                    >
                      <strong>-${loanRepaymentFeedback.amount}</strong>
                      <span>{loanRepaymentFeedback.statusLabel}</span>
                      <small>{loanRepaymentFeedback.detailLabel}</small>
                    </div>
                  )}
                  <div className="loan-list">
                    {visibleLedgerLoans.map((loan) => {
                      const isRepaying = loanRepaymentFeedback?.loan.id === loan.id;

                      return (
                        <div className={`loan-row ${isRepaying ? 'repaying' : ''}`} key={loan.id}>
                          <div className="loan-row-copy">
                            <strong>{loan.title}</strong>
                            <span>{loan.effect}</span>
                          </div>
                          <b>{loan.amount}</b>
                          <button
                            type="button"
                            onClick={() => repayActiveLoan(loan.id)}
                            disabled={player.gold < loan.amount || isRepaying}
                          >
                            {isRepaying ? '结清' : '偿付'}
                          </button>
                          {isRepaying && <span className="loan-paid-stamp">已偿清</span>}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="loan-ledger-back"
                    type="button"
                    onClick={() => setLoanLedgerOpen(false)}
                  >
                    返回
                  </button>
                </div>
              </div>
            )}

            {isCleaningView && (
              <div className="cleaning-view" onPointerDown={handleCleaningViewPointerDown}>
                <div className="plate-shell">
                  <div
                    className={`plate ${
                      phase === 'claimable' && activeReward.isBroken ? 'broken' : ''
                    }`}
                    key={activePlate?.seed ?? activePlateId ?? 'cleaning'}
                    ref={cleaningPlateRef}
                  >
                    <div className="plate-rim" />
                    <CleaningCanvas
                      key={activePlateId ?? 'cleaning'}
                      active={isCleaningView}
                      cleanPoints={activePlate?.cleanPoints ?? []}
                      onProgressChange={setCleanProgress}
                      onCleanPoint={recordActivePlateCleanPoint}
                      onComplete={completeCleaning}
                    />
                  </div>
                  <button
                    className={`claim-button ${activeReward.isBroken ? 'broken' : ''}`}
                    type="button"
                    onClick={claimReward}
                    disabled={phase !== 'claimable'}
                    data-cleaning-control="true"
                  >
                    {workOutcomeRevealed ? workClaimAmountLabel : '清洁后结算'}
                  </button>
                </div>

                <div className="work-info-card" data-cleaning-control="true">
                  <strong>日常工作</strong>
                  <p className="work-info-copy">挣得不多，都是辛苦钱</p>
                  <span className="work-info-heading">中奖概率</span>
                  <div className="work-info-odds">
                    <div className="work-info-odds-row">
                      <span className="work-info-odds-left">
                        <span className="work-info-token clean" aria-hidden="true" />
                        <em>{workSafeRewardPercent}</em>
                      </span>
                      <b>{workSafeOutcomeLabel}</b>
                    </div>
                    {brokenPlateEnabled && (
                      <div className="work-info-odds-row danger">
                        <span className="work-info-odds-left">
                          <span className="work-info-token broken" aria-hidden="true" />
                          <em>{workBrokenPlatePercent}</em>
                        </span>
                        <b>{workBrokenOutcomeLabel}</b>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside
          className={`right-reserved-space ${upgradeToolsVisible ? 'active' : ''}`}
          aria-label={upgradeToolsVisible ? '升级工具面板' : undefined}
          aria-hidden={!upgradeToolsVisible}
        >
          {upgradeToolsVisible && (
            <section className="upgrade-tools-panel">
              <header>
                <small>Stage 2.5</small>
                <strong>升级工具</strong>
                <span>把刮卡手感和后续成长目标接上。</span>
              </header>
              <div className="upgrade-tool-list">
                {UPGRADE_TOOLS_CONFIG.map((tool) => {
                  const toolState = save.upgradeTools[tool.id];
                  const toolLevel = toolState?.level ?? tool.level;
                  const buyable = canBuyUpgradeTool(player.gold, tool, { level: toolLevel });

                  return (
                    <article className="upgrade-tool-card" key={tool.id}>
                      <UpgradeToolIcon toolId={tool.id} />
                      <div>
                        <strong>{tool.label}</strong>
                        <span>{tool.description}</span>
                        <small>{tool.effectLabel}</small>
                      </div>
                      <div className="upgrade-tool-meta">
                        <em>
                          {tool.id === 'copper-coin' ? '力量' : '等级'} {toolLevel}
                        </em>
                        <small>
                          {toolLevel}/{tool.maxLevel}
                        </small>
                        <button
                          type="button"
                          onClick={() => buyUpgradeTool(tool)}
                          disabled={!buyable}
                        >
                          ${tool.price}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </aside>
      </section>
      <p className="game-disclaimer">
        本游戏为 vibecoding 页面玩法创意参考
        <a href="https://store.steampowered.com/app/3948120/_/" target="_blank" rel="noreferrer">
          《刮个爽》
        </a>
      </p>
    </main>
  );
}
