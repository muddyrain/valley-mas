'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CleaningCanvas } from '@/components/CleaningCanvas';
import { ScratchCardCanvas } from '@/components/ScratchCardCanvas';
import { ShopPurchaseButton } from '@/components/ShopPurchaseButton';
import {
  AUTO_SCRATCH_MACHINE_CONFIG,
  AUTO_SCRATCH_MACHINE_MILESTONE_ID,
  type AutoScratchMachineUnlockProgress,
  advanceBasicSafeScratchCardProgress,
  advanceSegmentedProficiency,
  BASIC_SAFE_CARD_PRICE,
  canAffordWorkPlate,
  canBuyAutoScratchMachine,
  canBuyBasicSafeScratchCard,
  canBuyScratchCard,
  canBuyTrashCan,
  canBuyUpgradeTool,
  canStartWorkFromPhase,
  canUnlockFinalChanceCard,
  cashOutPushLuckScratchCard,
  continuePushLuckScratchCard,
  createLoanFromTemplate,
  createScratchCard,
  FINAL_CHANCE_CARD_PRICE,
  type GoldChangeEffect,
  type GoldEffectSource,
  getAutoScratchMachineUnlockProgress,
  getBoundedDesktopPosition,
  getBoundedPlatePosition,
  getCleaningBrushRadius,
  getEffectiveScratchCardDiscardCost,
  getGoldChangeEffect,
  getGoldDisplayRollValue,
  getLoanRepaymentFeedback,
  getNextUnlockMilestone,
  getOutcomeAmountLabel,
  getPushLuckBustPenalty,
  getRandomPlateSpawnPosition,
  getScratchCardBrushRadius,
  getScratchCardConfig,
  getScratchCardDiscardCost,
  getScratchCardLevelProgress,
  getScratchCardPrizePoolForLevel,
  getScratchCardSettlementHighlightDelayMs,
  getScratchCardSettlementProgressKey,
  getScratchCardSlotIndexes,
  getScratchCardStepDistance,
  getScratchLuckEffectLabel,
  getStageGoalProgress,
  getUnlockMilestoneCurrentValue,
  getUnlockMilestoneProgress,
  getUnlockMilestoneThreshold,
  getUpgradeToolPrice,
  getWinningScratchSymbolIndexes,
  getWorkBrokenPlatePenaltyForLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  isBrokenPlateEnabled,
  isPointInsideCircleBounds,
  LOAN_CONFIG,
  LOAN_PRINCIPAL,
  LOAN_REPAYMENT_AMOUNT,
  type LoanState,
  markScratchCardPenaltyTriggered,
  PUSH_LUCK_CARD_MILESTONE_ID,
  PUSH_LUCK_CARD_PRICE,
  RISK_PEEK_CARD_PRICE,
  repayLoan,
  revealPushLuckLayer,
  rollWorkReward,
  SCRATCH_CARD_ALBUMS_CONFIG,
  type ScratchCardState,
  type ScratchCardSymbol,
  type ScratchCardType,
  type ScratchSurfacePoint,
  settleScratchCard,
  shouldCloseCleaningOverlay,
  shouldForceWrongScratchCardForLoan,
  shouldHandlePlatePointerDown,
  shouldOfferLoanPhone,
  shouldOpenPlateFromPointerUp,
  shouldShowScratchCover,
  shouldShowTripleMatchUnlockNotice,
  shouldShowUpgradeToolsUnlockNotice,
  shouldShowWorkRiskNotice,
  shouldTriggerScratchCardPenalty,
  shouldUnlockTrashCan,
  TRASH_CAN_PRICE,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  TRIPLE_MATCH_CARD_MILESTONE_ID,
  TRIPLE_MATCH_CARD_PRICE,
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
  advanceAutoScratchMachineSave,
  getActiveScratchCard,
  getActiveWorkPlate,
  getAutoScratchMachineBlockReason,
  isUnlockMilestoneUnlocked,
  type ScratchLegendAutoScratchMachineBlockReason,
  type ScratchLegendAutoScratchMachineStatus,
  settleFinalChanceScratchCardSave,
  takeOverAutoScratchMachineCard,
} from '@/lib/game-save';
import { useScratchLegendStore } from '@/lib/game-store';

const SCRATCH_MODE_MILESTONE_ID: UnlockMilestoneId = 'scratch-mode';
const DESKTOP_PLATE_SIZE = scratchLegendConfig.work.plate.desktopSize;
const TABLETOP_SCRATCH_CARD_SIZE = { width: 108, height: 76 } as const;
const PLATE_ENTER_ANIMATION_MS = scratchLegendConfig.work.plate.enterAnimationMs;
const LUCKY_CARD_EFFECT_MS = 1100;
const AUTO_SCRATCH_TICK_MS = 1000;
const AUTO_SCRATCH_PURCHASE_EFFECT_WINDOW_MS = 120;
const AUTO_SCRATCH_AFTER_SETTLEMENT_VISUAL_HOLD_MS = 680;
const AUTO_SCRATCH_RESERVE_OPTIONS = [0, 100, 500] as const;
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

type UnlockToast = 'trash' | 'scratch' | 'upgrade' | 'triple-match' | 'auto-scratcher' | null;
type PhoneNoticeType = 'loan' | 'scratch' | 'upgrade-tools' | 'triple-match' | 'work-risk' | null;
type GoldEffectEvent = GoldChangeEffect & {
  id: number;
  source: GoldEffectSource;
};

type PendingAutoScratchPurchaseEffect = {
  previousGold: number;
  nextGold: number;
};

type AutoScratchSettlementFeedback = {
  id: number;
  title: string;
  label: string;
  payout: number;
  isWinning: boolean;
};

const SCRATCH_SYMBOL_LABELS: Record<ScratchCardSymbol, string> = {
  fire: '火焰',
  cash: '纸钞',
  bag: '钱袋',
  coin: '铜币',
  jackpot: '金币堆',
  blank: '未中',
  danger: '危险',
  legend: '传说',
};

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

const TRIPLE_MATCH_PHONE_LINES = ['哇哦，我这正好有新的刮刮卡！', '这张的奖励更多......'] as const;

const LOAN_PHONE_COPY =
  '大发慈悲给你一笔贷款。温馨提示，我们的贷款利率是 6000%。为了防止你不还，我们贴心地给你在右上角加了一个按钮，可以查看当前贷款。';
const getWorkRiskPhoneCopy = (level: number, brokenPlatePercent: string) =>
  `没有人能一直顺风顺水。刚才那只盘子碎了，但你还在桌边。从等级 ${level} 开始，日常工作会有 ${brokenPlatePercent} 概率碎盘。`;
const GOLD_EFFECT_MAX_EVENTS = 6;
const GOLD_EFFECT_DURATION_MS = 900;
const GOLD_ROLL_DURATION_MS = 560;
const UNLOCK_TOAST_DURATION_MS = 2600;
const SCRATCH_SLOT_FLASH_DURATION_MS = 420;
const SCRATCH_SETTLEMENT_HIGHLIGHT_DELAY_MS = 140;

function StatusPill({ label, value }: { label: string; value: string }) {
  const iconClassName =
    label === '已洗盘子'
      ? 'status-plate'
      : label === '刮卡次数'
        ? 'status-ticket'
        : 'status-default';

  return (
    <div className="status-pill">
      <span className={`status-pill-icon ${iconClassName}`} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScratchSymbolIcon({ symbol }: { symbol: ScratchCardSymbol }) {
  return (
    <span className={`scratch-symbol-icon ${symbol}`} aria-hidden="true">
      <span />
    </span>
  );
}

function UpgradeToolIcon({ toolId }: { toolId: UpgradeToolConfig['id'] }) {
  return <span className={`upgrade-tool-icon ${toolId}`} aria-hidden="true" />;
}

function AutoScratchMachineTargetCard({
  progress,
  unlocked,
  canBuy,
  onBuy,
  compact = false,
}: {
  progress: AutoScratchMachineUnlockProgress;
  unlocked: boolean;
  canBuy?: boolean;
  onBuy?: () => void;
  compact?: boolean;
}) {
  const machine = AUTO_SCRATCH_MACHINE_CONFIG;
  const targetReady = progress.unlockedByTargets;
  const canPurchase = Boolean(canBuy && onBuy);
  const cardClassName = [
    'automation-goal-card',
    compact ? 'compact' : '',
    !unlocked && !canPurchase ? 'insufficient' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const statusLabel = '已解锁';
  let goldLabel = `资金 $${progress.price}`;
  let eyebrowLabel = '可购买';

  if (unlocked) {
    goldLabel = '自动机已解锁';
    eyebrowLabel = '已拥有';
  } else if (progress.goldShortfall > 0) {
    goldLabel = `还差 $${progress.goldShortfall}`;
  }

  return (
    <article className={cardClassName}>
      <span className="automation-machine-icon" aria-hidden="true" />
      <div className="automation-goal-copy">
        <small>{eyebrowLabel}</small>
        <strong>{machine.label}</strong>
        <span>{machine.description}</span>
        <div className="automation-goal-tags">
          <em>{goldLabel}</em>
        </div>
      </div>
      {unlocked ? (
        <b>{statusLabel}</b>
      ) : (
        <ShopPurchaseButton
          className="automation-buy-button"
          price={machine.price}
          onClick={onBuy}
          disabled={!targetReady}
        />
      )}
    </article>
  );
}

const AUTO_SCRATCH_MACHINE_STATUS_LABELS: Record<ScratchLegendAutoScratchMachineStatus, string> = {
  locked: '未解锁',
  idle: '待命',
  refilling: '补票中',
  processing: '处理中',
  paused: '已暂停',
  blocked: '阻塞',
};

const AUTO_SCRATCH_MACHINE_BLOCK_REASON_LABELS: Record<
  ScratchLegendAutoScratchMachineBlockReason,
  string
> = {
  none: '自动购买稳定票，处理完成后自动结算',
  'auto-buy-off': '自动购买已关闭，队列清空后待命',
  'no-allowed-card-types': '没有允许票种，打开成双入对后才会补票',
  'queue-full': '队列已满，等空位后继续补票',
  'not-enough-gold': `金币不足，至少需要 $${BASIC_SAFE_CARD_PRICE}`,
  reserve: '购买会低于保留金币',
};

function AutoScratchMachineTableUnit({
  status,
  currentCard,
  queue,
  progressRatio,
  capacity,
}: {
  status: ScratchLegendAutoScratchMachineStatus;
  currentCard: ScratchCardState | null;
  queue: readonly ScratchCardState[];
  progressRatio: number;
  capacity: number;
}) {
  const visibleCards = currentCard ? [currentCard, ...queue] : [...queue];

  return (
    <div className={`auto-scratch-machine-unit ${status}`}>
      <div className="auto-machine-body" aria-hidden="true">
        <span className="auto-machine-slot" />
        <span className="auto-machine-light" />
      </div>
      <div className="auto-machine-copy">
        <strong>自动刮刮机</strong>
        <span>{AUTO_SCRATCH_MACHINE_STATUS_LABELS[status]}</span>
      </div>
      <div className="auto-machine-queue">
        {Array.from({ length: capacity }).map((_, index) => {
          const card = visibleCards[index];
          const isCurrent = Boolean(currentCard && card?.id === currentCard.id);

          return (
            <span
              className={`auto-machine-queue-slot ${card ? 'filled' : ''} ${
                isCurrent ? 'current' : ''
              }`}
              key={index}
            >
              {card ? getScratchCardDisplay(card.type).miniTitle : '空位'}
            </span>
          );
        })}
      </div>
      <div className="auto-machine-progress" aria-hidden="true">
        <span style={{ width: `${Math.round(progressRatio * 100)}%` }} />
      </div>
    </div>
  );
}

function getUnlockToastTitle(unlockToast: Exclude<UnlockToast, null>) {
  if (unlockToast === 'scratch') {
    return '刮刮卡！';
  }

  if (unlockToast === 'auto-scratcher') {
    return '自动刮刮机！';
  }

  if (unlockToast === 'trash') {
    return '购买资格已解锁';
  }

  return '已解锁';
}

function getUnlockToastDetail(unlockToast: Exclude<UnlockToast, null>) {
  if (unlockToast === 'scratch') {
    return '成双入对已上架';
  }

  if (unlockToast === 'triple-match') {
    return '三连胜出';
  }

  if (unlockToast === 'upgrade') {
    return '升级工具';
  }

  if (unlockToast === 'auto-scratcher') {
    return `花费 $${AUTO_SCRATCH_MACHINE_CONFIG.price} 购买机器`;
  }

  return `花费 $${TRASH_CAN_PRICE} 购买垃圾桶`;
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

  if (tierId === 'triple-coin') {
    return 'coin';
  }

  if (tierId === 'triple-bag') {
    return 'bag';
  }

  if (tierId === 'triple-cash') {
    return 'cash';
  }

  if (tierId === 'triple-jackpot') {
    return 'jackpot';
  }

  if (tierId === 'risk-coin') {
    return 'coin';
  }

  if (tierId === 'risk-bag') {
    return 'bag';
  }

  if (tierId === 'risk-cash') {
    return 'cash';
  }

  if (tierId === 'risk-danger') {
    return 'danger';
  }

  if (tierId === 'push-layer-1') {
    return 'coin';
  }

  if (tierId === 'push-layer-2') {
    return 'bag';
  }

  if (tierId === 'push-layer-3') {
    return 'cash';
  }

  if (tierId === 'push-layer-4') {
    return 'jackpot';
  }

  if (tierId === 'push-bust') {
    return 'danger';
  }

  if (tierId === 'final-3' || tierId === 'final-4' || tierId === 'final-5') {
    return 'legend';
  }

  return 'blank';
}

function getScratchCardDisplay(cardType: ScratchCardType) {
  if (cardType === 'final-chance') {
    return {
      catalog: '终局票',
      title: '最后一刮',
      ticketTitle: 'FINAL',
      miniTitle: '终',
      ruleLabel: '刮开 5 格，3 个传说符号即可终局成功',
      winLabel: '本轮终局成功，准备荣耀结算。',
      loseLabel: '本轮已经到结算时刻。',
      cardClassName: 'final-chance',
      levelAriaLabel: '最后一刮结算进度',
    };
  }

  if (cardType === 'push-luck') {
    return {
      catalog: '高风险票',
      title: '步步加码',
      ticketTitle: 'PUSH',
      miniTitle: '加',
      ruleLabel: '逐层刮开，安全后可收手或继续加码',
      winLabel: '当前层安全，可以见好就收。',
      loseLabel: '爆雷归零，本张只能结算。',
      cardClassName: 'push-luck',
      levelAriaLabel: '步步加码等级进度',
    };
  }

  if (cardType === 'risk-peek') {
    return {
      catalog: '风险卡',
      title: '险中求财',
      ticketTitle: 'RISK',
      miniTitle: '险',
      ruleLabel: '预埋危险符号，刮满危险位本张归零',
      winLabel: '没有踩到危险，可以结算。',
      loseLabel: '危险已触发，本张 $0。',
      cardClassName: 'risk-peek',
      levelAriaLabel: '险中求财等级进度',
    };
  }

  if (cardType === 'triple-match') {
    return {
      catalog: '三连规则',
      title: '三连胜出',
      ticketTitle: 'TRIPLE',
      miniTitle: '三',
      ruleLabel: '刮出三连才获胜',
      winLabel: '刮出三连，可以结算。',
      loseLabel: '没有三连，本张 $0。',
      cardClassName: 'triple-match',
      levelAriaLabel: '三连胜出等级进度',
    };
  }

  return {
    catalog: '安全卡',
    title: '成双入对',
    ticketTitle: 'TWO$WIN',
    miniTitle: '双',
    ruleLabel: '刮出一对即可获胜',
    winLabel: '刮出一对，可以结算。',
    loseLabel: '没有成对，本张 $0。',
    cardClassName: 'basic-safe',
    levelAriaLabel: '成双入对等级进度',
  };
}

function getPersistedRevealedScratchSlotIndexes(card: ScratchCardState) {
  if (card.type === 'push-luck' && card.result.pushLuck) {
    return Array.from(
      { length: Math.max(0, card.result.pushLuck.highestRevealedLayer) },
      (_, index) => index,
    );
  }

  if (card.status === 'claimable') {
    return getScratchCardSlotIndexes(card.type);
  }

  return [];
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
  const [dragPreviewPositions, setDragPreviewPositions] = useState<{
    plates: Record<number, WorkPlateState['position']>;
    scratchCards: Record<number, ScratchCardState['position']>;
  }>({ plates: {}, scratchCards: {} });
  const [enteringPlateIds, setEnteringPlateIds] = useState<number[]>([]);
  const [enteringScratchCardIds, setEnteringScratchCardIds] = useState<number[]>([]);
  const [luckyScratchCardIds, setLuckyScratchCardIds] = useState<number[]>([]);
  const [scratchPhoneStep, setScratchPhoneStep] = useState(0);
  const [unlockToast, setUnlockToast] = useState<UnlockToast>(null);
  const [trashHoverPlateId, setTrashHoverPlateId] = useState<number | null>(null);
  const [trashHoverScratchCardId, setTrashHoverScratchCardId] = useState<number | null>(null);
  const [loanLedgerOpen, setLoanLedgerOpen] = useState(false);
  const [loanRepaymentFeedback, setLoanRepaymentFeedback] = useState<LoanRepaymentFeedback | null>(
    null,
  );
  const [displayedGold, setDisplayedGold] = useState(save.player.gold);
  const [goldRolling, setGoldRolling] = useState(false);
  const [goldEffectEvents, setGoldEffectEvents] = useState<GoldEffectEvent[]>([]);
  const [coinEffectPulse, setCoinEffectPulse] = useState<GoldEffectEvent | null>(null);
  const [autoScratchSettlementFeedback, setAutoScratchSettlementFeedback] =
    useState<AutoScratchSettlementFeedback | null>(null);
  const [autoScratchVisualHoldActive, setAutoScratchVisualHoldActive] = useState(false);
  const [revealedScratchSlots, setRevealedScratchSlots] = useState<number[]>([]);
  const [flashingScratchSlots, setFlashingScratchSlots] = useState<number[]>([]);
  const [settlementHighlightSlots, setSettlementHighlightSlots] = useState<number[]>([]);
  const [phoneMessageOpen, setPhoneMessageOpen] = useState(false);
  const [upgradeToolsPhoneStep, setUpgradeToolsPhoneStep] = useState(0);
  const [tripleMatchPhoneStep, setTripleMatchPhoneStep] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const trashCanRef = useRef<HTMLDivElement | null>(null);
  const cleaningPlateRef = useRef<HTMLDivElement | null>(null);
  const scratchCardRef = useRef<HTMLDivElement | null>(null);
  const platePointerRef = useRef<PlatePointerState | null>(null);
  const scratchCardPointerRef = useRef<ScratchCardPointerState | null>(null);
  const plateEnterTimerRefs = useRef<number[]>([]);
  const unlockToastTimerRef = useRef<number | null>(null);
  const loanRepaymentTimerRef = useRef<number | null>(null);
  const goldEffectTimerRefs = useRef<number[]>([]);
  const autoScratchPurchaseEffectTimerRef = useRef<number | null>(null);
  const pendingAutoScratchPurchaseEffectRef = useRef<PendingAutoScratchPurchaseEffect | null>(null);
  const autoScratchSettlementFeedbackIdRef = useRef(0);
  const autoScratchVisualHoldTimerRef = useRef<number | null>(null);
  const scratchSlotFlashTimerRefs = useRef<number[]>([]);
  const settlementHighlightTimerRef = useRef<number | null>(null);
  const goldRollFrameRef = useRef<number | null>(null);
  const goldEffectIdRef = useRef(0);
  const displayedGoldRef = useRef(save.player.gold);
  const revealedScratchSlotSetRef = useRef(new Set<number>());
  const previousTrashCanUnlockedRef = useRef(save.unlocks.trashCanUnlocked);
  const previousScratchModeUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, SCRATCH_MODE_MILESTONE_ID),
  );
  const previousUpgradeToolsUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, UPGRADE_TOOLS_MILESTONE_ID),
  );
  const previousTripleMatchUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, TRIPLE_MATCH_CARD_MILESTONE_ID),
  );
  const previousAutoScratchMachineMilestoneUnlockedRef = useRef(
    isUnlockMilestoneUnlocked(save, AUTO_SCRATCH_MACHINE_MILESTONE_ID),
  );
  const unlockToastReadyRef = useRef(false);
  const hydrationSyncAppliedRef = useRef(false);
  const trashCanOfferFocusedRef = useRef(false);
  const autoScratchMachineOfferFocusedRef = useRef(false);

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
  const trashCanUnlocked = save.unlocks.trashCanUnlocked;
  const trashCanPurchased = save.unlocks.trashCanPurchased;
  const trashCanAvailable = trashCanUnlocked && trashCanPurchased;
  const workRiskMessageDismissed = save.notices.workRiskMessageDismissed;
  const scratchMessageDismissed = save.notices.scratchMessageDismissed;
  const upgradeToolsMessageDismissed = save.notices.upgradeToolsMessageDismissed;
  const tripleMatchMessageDismissed = save.notices.tripleMatchMessageDismissed;
  const autoScratchMachineUnlocked = save.automation.autoScratchMachineUnlocked;
  const roundSettlementCompleted = save.roundSettlement.completed;
  const autoScratchMachineStatus = save.automation.autoScratchMachineStatus;
  const autoScratchMachineQueue = save.automation.autoScratchQueue;
  const autoScratchCurrentCard = save.automation.autoScratchCurrentCard;
  const autoScratchAutoBuyEnabled = save.automation.autoScratchAutoBuyEnabled;
  const autoScratchAllowedCardTypes = save.automation.autoScratchAllowedCardTypes;
  const autoScratchMinReserveGold = save.automation.autoScratchMinReserveGold;
  const autoScratchMachineBlockReason = getAutoScratchMachineBlockReason(save);
  const autoScratchAllowedBasicSafe = autoScratchAllowedCardTypes.includes('basic-safe');
  const autoScratchProcessingMs = AUTO_SCRATCH_MACHINE_CONFIG.base.processingSeconds * 1000;
  const autoScratchProgressRatio = autoScratchCurrentCard
    ? Math.min(1, save.automation.autoScratchProgressMs / autoScratchProcessingMs)
    : 0;
  const autoScratchTakeoverCards = [
    ...(autoScratchCurrentCard
      ? [
          {
            card: autoScratchCurrentCard,
            label: `处理中 ${Math.round(autoScratchProgressRatio * 100)}%`,
          },
        ]
      : []),
    ...autoScratchMachineQueue.map((card, index) => ({
      card,
      label: `队列 ${index + 1}`,
    })),
  ];
  const autoScratchTickDelayMs = (() => {
    if (
      !autoScratchMachineUnlocked ||
      autoScratchMachineStatus === 'paused' ||
      (autoScratchVisualHoldActive && !autoScratchCurrentCard)
    ) {
      return null;
    }

    if (autoScratchCurrentCard) {
      return Math.max(
        0,
        Math.min(
          AUTO_SCRATCH_TICK_MS,
          autoScratchProcessingMs - save.automation.autoScratchProgressMs,
        ),
      );
    }

    if (
      autoScratchMachineQueue.length > 0 ||
      (autoScratchMachineStatus === 'idle' && autoScratchAutoBuyEnabled) ||
      autoScratchMachineStatus === 'refilling' ||
      (autoScratchMachineStatus === 'blocked' &&
        autoScratchAutoBuyEnabled &&
        autoScratchAllowedBasicSafe &&
        save.player.gold - BASIC_SAFE_CARD_PRICE >= autoScratchMinReserveGold)
    ) {
      return 0;
    }

    return null;
  })();
  const autoScratchTickScheduleKey = `${autoScratchMachineStatus}:${autoScratchMachineQueue.length}:${autoScratchAutoBuyEnabled}:${autoScratchAllowedCardTypes.join(',')}:${autoScratchMinReserveGold}`;
  const scratchModeUnlocked = isUnlockMilestoneUnlocked(save, SCRATCH_MODE_MILESTONE_ID);
  const upgradeToolsUnlocked = isUnlockMilestoneUnlocked(save, UPGRADE_TOOLS_MILESTONE_ID);
  const tripleMatchUnlocked = isUnlockMilestoneUnlocked(save, TRIPLE_MATCH_CARD_MILESTONE_ID);
  const autoScratchMachineMilestoneUnlocked = isUnlockMilestoneUnlocked(
    save,
    AUTO_SCRATCH_MACHINE_MILESTONE_ID,
  );
  const scratchCardVisible = scratchModeUnlocked && scratchMessageDismissed;
  const upgradeToolsVisible = upgradeToolsUnlocked && upgradeToolsMessageDismissed;
  const autoScratchMachineProgress = getAutoScratchMachineUnlockProgress({
    gold: player.gold,
    milestoneUnlocked: autoScratchMachineMilestoneUnlocked,
  });
  const canPurchaseAutoScratchMachine = canBuyAutoScratchMachine({
    gold: player.gold,
    milestoneUnlocked: autoScratchMachineMilestoneUnlocked,
    alreadyUnlocked: autoScratchMachineUnlocked,
  });
  const basicSafeLevelProgress = getScratchCardLevelProgress(
    'basic-safe',
    save.scratchCards.basicSafe.cardsSettled,
  );
  const tripleMatchLevelProgress = getScratchCardLevelProgress(
    'triple-match',
    save.scratchCards.tripleMatch.cardsSettled,
  );
  const riskPeekLevelProgress = getScratchCardLevelProgress(
    'risk-peek',
    save.scratchCards.riskPeek.cardsSettled,
  );
  const pushLuckLevelProgress = getScratchCardLevelProgress(
    'push-luck',
    save.scratchCards.pushLuck.cardsSettled,
  );
  const finalChanceLevelProgress = getScratchCardLevelProgress(
    'final-chance',
    save.scratchCards.finalChance.cardsSettled,
  );
  const pushLuckUnlocked =
    autoScratchMachineUnlocked && isUnlockMilestoneUnlocked(save, PUSH_LUCK_CARD_MILESTONE_ID);
  const finalChanceUnlocked = canUnlockFinalChanceCard({
    autoScratchMachineUnlocked,
    pushLuckMilestoneUnlocked: isUnlockMilestoneUnlocked(save, PUSH_LUCK_CARD_MILESTONE_ID),
    pushLuckCardsSettled: save.scratchCards.pushLuck.cardsSettled,
  });
  const scratchCardCatalogItems = [
    {
      type: 'basic-safe' as const,
      visible: scratchModeUnlocked && scratchMessageDismissed,
      unlocked: scratchModeUnlocked && scratchMessageDismissed,
      price: BASIC_SAFE_CARD_PRICE,
      progress: basicSafeLevelProgress,
    },
    {
      type: 'triple-match' as const,
      visible: scratchModeUnlocked && scratchMessageDismissed,
      unlocked:
        isUnlockMilestoneUnlocked(save, TRIPLE_MATCH_CARD_MILESTONE_ID) &&
        save.notices.tripleMatchMessageDismissed,
      price: TRIPLE_MATCH_CARD_PRICE,
      progress: tripleMatchLevelProgress,
    },
    {
      type: 'risk-peek' as const,
      visible: scratchModeUnlocked && scratchMessageDismissed,
      unlocked: tripleMatchUnlocked && tripleMatchMessageDismissed,
      price: RISK_PEEK_CARD_PRICE,
      progress: riskPeekLevelProgress,
    },
    {
      type: 'push-luck' as const,
      visible: pushLuckUnlocked,
      unlocked: pushLuckUnlocked,
      price: PUSH_LUCK_CARD_PRICE,
      progress: pushLuckLevelProgress,
    },
    {
      type: 'final-chance' as const,
      visible: finalChanceUnlocked && !roundSettlementCompleted,
      unlocked: finalChanceUnlocked && !roundSettlementCompleted,
      price: FINAL_CHANCE_CARD_PRICE,
      progress: finalChanceLevelProgress,
    },
  ];
  const scratchCardCatalogItemByType = new Map(
    scratchCardCatalogItems.map((item) => [item.type, item]),
  );
  const autoScratchTicketFilterItems = scratchCardCatalogItems
    .filter((item) => item.visible && item.unlocked)
    .map((item) => {
      const display = getScratchCardDisplay(item.type);

      return {
        type: item.type,
        title: display.title,
        miniTitle: display.miniTitle,
        enabled: item.type === 'basic-safe' && autoScratchAllowedBasicSafe,
        configurable: item.type === 'basic-safe',
        unavailableLabel:
          item.type === 'triple-match'
            ? '需要机器力量'
            : item.type === 'risk-peek'
              ? '风险票手动'
              : item.type === 'push-luck'
                ? '高风险手动'
                : item.type === 'final-chance'
                  ? '终局手动'
                  : '已关闭',
      };
    });
  const autoScratchMachineDetail = (() => {
    if (autoScratchCurrentCard) {
      const currentCardTitle = getScratchCardDisplay(autoScratchCurrentCard.type).title;
      const occupiedSlots = autoScratchMachineQueue.length + (autoScratchCurrentCard ? 1 : 0);

      return occupiedSlots >= AUTO_SCRATCH_MACHINE_CONFIG.base.queueCapacity
        ? `正在处理${currentCardTitle}，队列已满`
        : `正在处理${currentCardTitle}`;
    }

    if (autoScratchMachineQueue.length > 0) {
      return `队列中还有 ${autoScratchMachineQueue.length} 张稳定票`;
    }

    if (autoScratchMachineStatus === 'paused') {
      return '已暂停，点击继续后接着处理';
    }

    if (autoScratchMachineBlockReason === 'reserve') {
      return `${AUTO_SCRATCH_MACHINE_BLOCK_REASON_LABELS.reserve} $${autoScratchMinReserveGold}`;
    }

    return AUTO_SCRATCH_MACHINE_BLOCK_REASON_LABELS[autoScratchMachineBlockReason];
  })();
  const activeScratchCardPrizePool = useMemo(
    () =>
      getScratchCardPrizePoolForLevel(
        activeScratchCard?.type ?? 'basic-safe',
        activeScratchCard?.level ?? basicSafeLevelProgress.level,
      ),
    [activeScratchCard?.level, activeScratchCard?.type, basicSafeLevelProgress.level],
  );
  const activeScratchPrizeRows =
    activeScratchCard?.type === 'push-luck' || activeScratchCard?.type === 'final-chance'
      ? activeScratchCardPrizePool.filter((tier) => tier.payout > 0)
      : activeScratchCardPrizePool.filter(
          (tier) => tier.displayProbability !== null && tier.payout > 0,
        );
  const activeFinalChancePrizeRows =
    activeScratchCard?.type === 'final-chance'
      ? activeScratchCardPrizePool.filter((tier) => tier.displayProbability !== null)
      : [];
  const activeScratchCardDisplay = getScratchCardDisplay(activeScratchCard?.type ?? 'basic-safe');
  const activeScratchCardDiscardCost = activeScratchCard
    ? getEffectiveScratchCardDiscardCost(player.gold, activeScratchCard)
    : 0;
  const activeScratchCardBaseDiscardCost = activeScratchCard
    ? getScratchCardDiscardCost(activeScratchCard.price)
    : 0;
  const activeScratchCardLevelProgress =
    activeScratchCard?.type === 'triple-match'
      ? tripleMatchLevelProgress
      : activeScratchCard?.type === 'risk-peek'
        ? riskPeekLevelProgress
        : activeScratchCard?.type === 'push-luck'
          ? pushLuckLevelProgress
          : activeScratchCard?.type === 'final-chance'
            ? finalChanceLevelProgress
            : basicSafeLevelProgress;

  const nextUnlockMilestone = getNextUnlockMilestone(player.proficiency);
  const finalUnlockMilestone =
    scratchLegendConfig.progression.proficiencyMilestones[
      scratchLegendConfig.progression.proficiencyMilestones.length - 1
    ];
  const unlockProgressTarget =
    nextUnlockMilestone?.requiredProficiency ?? finalUnlockMilestone.requiredProficiency;
  const unlockProgressCurrent = getUnlockMilestoneCurrentValue(
    player.proficiency,
    nextUnlockMilestone,
  );
  const scratchUnlockProgress = getUnlockMilestoneProgress(player.proficiency, nextUnlockMilestone);
  const stageGoalProgress = getStageGoalProgress({
    nextUnlockMilestone,
    unlockProgressCurrent,
    unlockProgressTarget,
    unlockProgressRatio: scratchUnlockProgress,
    autoScratchMachineUnlocked,
    autoScratchMachineProgress,
  });
  const workLevel = player.workLevel;
  const workLevelProgress = getWorkLevelProgress(player.plateCleaned);
  const previewRewardAmount = getWorkRewardAmountForLevel(workLevel);
  const brokenPlateEnabled = isBrokenPlateEnabled(workLevel);
  const workBrokenPlatePenalty = getWorkBrokenPlatePenaltyForLevel(workLevel);
  const scratchRadiusToolLevel = save.upgradeTools['scratch-radius']?.level ?? 0;
  const cleaningBrushRadius = getCleaningBrushRadius(scratchRadiusToolLevel, activeLoans);
  const workSafeRewardPercent = `${Math.round(
    (brokenPlateEnabled ? WORK_SAFE_REWARD_CHANCE : 1) * 100,
  )}%`;
  const workBrokenPlatePercent = `${Math.round(WORK_BROKEN_PLATE_CHANCE * 100)}%`;
  const scratchLuckToolLevel = save.upgradeTools['scratch-luck']?.level ?? 0;
  const scratchLuckEffectLabel = getScratchLuckEffectLabel(scratchLuckToolLevel);
  const canAffordWork = canAffordWorkPlate(player.gold);
  const canStartWork = !roundSettlementCompleted && canStartWorkFromPhase(phase, player.gold);
  const canBuyBasicSafeCard =
    scratchCardVisible &&
    !roundSettlementCompleted &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyBasicSafeScratchCard(player);
  const canBuyTripleMatchCard =
    tripleMatchUnlocked &&
    tripleMatchMessageDismissed &&
    !roundSettlementCompleted &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyScratchCard('triple-match', player);
  const canBuyRiskPeekCard =
    tripleMatchUnlocked &&
    tripleMatchMessageDismissed &&
    !roundSettlementCompleted &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyScratchCard('risk-peek', player);
  const canBuyPushLuckCard =
    pushLuckUnlocked &&
    !roundSettlementCompleted &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyScratchCard('push-luck', player);
  const canBuyFinalChanceCard =
    finalChanceUnlocked &&
    !roundSettlementCompleted &&
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canBuyScratchCard('final-chance', player);
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
      : getOutcomeAmountLabel(true, previewRewardAmount);
  const workBrokenOutcomeLabel =
    workOutcomeRevealed && activeReward.isBroken
      ? getOutcomeAmountLabel(true, activeReward.total)
      : getOutcomeAmountLabel(true, -workBrokenPlatePenalty);
  const workRiskNoticeVisible = shouldShowWorkRiskNotice(
    save.notices.workRiskNoticeTriggered,
    workRiskMessageDismissed,
  );
  const scratchUnlockNoticeVisible = scratchModeUnlocked && !scratchMessageDismissed;
  const upgradeToolsUnlockNoticeVisible = shouldShowUpgradeToolsUnlockNotice(
    player.proficiency,
    upgradeToolsMessageDismissed,
  );
  const tripleMatchUnlockNoticeVisible = shouldShowTripleMatchUnlockNotice(
    player.proficiency,
    tripleMatchMessageDismissed,
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
      : tripleMatchUnlockNoticeVisible
        ? 'triple-match'
        : loanOfferNoticeVisible
          ? 'loan'
          : workRiskNoticeVisible
            ? 'work-risk'
            : null;
  const phoneNoticePending = phoneNoticeType !== null;
  const phoneNoticeVisible = phoneNoticePending && phoneMessageOpen;

  const statusLabel = useMemo(() => {
    if (roundSettlementCompleted) {
      return '本轮结算';
    }

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
  }, [
    activeScratchCard?.status,
    phase,
    plates.length,
    roundSettlementCompleted,
    tableScratchCards.length,
  ]);

  const showTrashCanUnlockToast = useCallback(() => {
    previousTrashCanUnlockedRef.current = true;
    trashCanOfferFocusedRef.current = true;

    if (unlockToastTimerRef.current) {
      window.clearTimeout(unlockToastTimerRef.current);
    }

    setUnlockToast('trash');
    unlockToastTimerRef.current = window.setTimeout(() => {
      setUnlockToast(null);
      unlockToastTimerRef.current = null;
    }, UNLOCK_TOAST_DURATION_MS);
  }, []);

  const showAutoScratchMachineUnlockToast = useCallback(() => {
    previousAutoScratchMachineMilestoneUnlockedRef.current = true;
    autoScratchMachineOfferFocusedRef.current = true;

    if (unlockToastTimerRef.current) {
      window.clearTimeout(unlockToastTimerRef.current);
    }

    setUnlockToast('auto-scratcher');
    unlockToastTimerRef.current = window.setTimeout(() => {
      setUnlockToast(null);
      unlockToastTimerRef.current = null;
    }, UNLOCK_TOAST_DURATION_MS);
  }, []);

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

      for (const timer of goldEffectTimerRefs.current) {
        window.clearTimeout(timer);
      }

      if (autoScratchPurchaseEffectTimerRef.current) {
        window.clearTimeout(autoScratchPurchaseEffectTimerRef.current);
      }

      if (autoScratchVisualHoldTimerRef.current) {
        window.clearTimeout(autoScratchVisualHoldTimerRef.current);
      }

      for (const timer of scratchSlotFlashTimerRefs.current) {
        window.clearTimeout(timer);
      }

      if (settlementHighlightTimerRef.current) {
        window.clearTimeout(settlementHighlightTimerRef.current);
      }

      if (goldRollFrameRef.current !== null) {
        window.cancelAnimationFrame(goldRollFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || hydrationSyncAppliedRef.current) {
      return;
    }

    hydrationSyncAppliedRef.current = true;
    updateSave((current) => current);
  }, [hasHydrated, updateSave]);

  useEffect(() => {
    const nextGold = player.gold;
    const fromGold = displayedGoldRef.current;

    if (goldRollFrameRef.current !== null) {
      window.cancelAnimationFrame(goldRollFrameRef.current);
      goldRollFrameRef.current = null;
    }

    if (nextGold <= fromGold) {
      displayedGoldRef.current = nextGold;
      setDisplayedGold(nextGold);
      setGoldRolling(false);
      return;
    }

    const startedAt = window.performance.now();
    setGoldRolling(true);

    function updateGoldRoll(now: number) {
      const progress = (now - startedAt) / GOLD_ROLL_DURATION_MS;
      const nextDisplayValue = getGoldDisplayRollValue(fromGold, nextGold, progress);

      displayedGoldRef.current = nextDisplayValue;
      setDisplayedGold(nextDisplayValue);

      if (progress < 1) {
        goldRollFrameRef.current = window.requestAnimationFrame(updateGoldRoll);
        return;
      }

      displayedGoldRef.current = nextGold;
      setDisplayedGold(nextGold);
      setGoldRolling(false);
      goldRollFrameRef.current = null;
    }

    goldRollFrameRef.current = window.requestAnimationFrame(updateGoldRoll);
  }, [player.gold]);

  useEffect(() => {
    if (!hasHydrated || unlockToastReadyRef.current) {
      return;
    }

    previousTrashCanUnlockedRef.current = trashCanUnlocked;
    previousScratchModeUnlockedRef.current = scratchModeUnlocked;
    previousUpgradeToolsUnlockedRef.current = upgradeToolsUnlocked;
    previousTripleMatchUnlockedRef.current = tripleMatchUnlocked;
    previousAutoScratchMachineMilestoneUnlockedRef.current = autoScratchMachineMilestoneUnlocked;
    unlockToastReadyRef.current = true;
  }, [
    autoScratchMachineMilestoneUnlocked,
    hasHydrated,
    scratchModeUnlocked,
    trashCanUnlocked,
    tripleMatchUnlocked,
    upgradeToolsUnlocked,
  ]);

  useEffect(() => {
    previousScratchModeUnlockedRef.current = scratchModeUnlocked;
  }, [scratchModeUnlocked]);

  useEffect(() => {
    previousUpgradeToolsUnlockedRef.current = upgradeToolsUnlocked;
  }, [upgradeToolsUnlocked]);

  useEffect(() => {
    previousTripleMatchUnlockedRef.current = tripleMatchUnlocked;
  }, [tripleMatchUnlocked]);

  useEffect(() => {
    if (!unlockToastReadyRef.current) {
      return;
    }

    if (trashCanUnlocked && !previousTrashCanUnlockedRef.current) {
      showTrashCanUnlockToast();
    }

    previousTrashCanUnlockedRef.current = trashCanUnlocked;
  }, [showTrashCanUnlockToast, trashCanUnlocked]);

  useEffect(() => {
    if (!hasHydrated || !trashCanUnlocked || trashCanPurchased || trashCanOfferFocusedRef.current) {
      return;
    }

    trashCanOfferFocusedRef.current = true;
    showTrashCanUnlockToast();
  }, [hasHydrated, showTrashCanUnlockToast, trashCanPurchased, trashCanUnlocked]);

  useEffect(() => {
    if (!unlockToastReadyRef.current) {
      return;
    }

    if (
      autoScratchMachineMilestoneUnlocked &&
      !previousAutoScratchMachineMilestoneUnlockedRef.current
    ) {
      showAutoScratchMachineUnlockToast();
    }

    previousAutoScratchMachineMilestoneUnlockedRef.current = autoScratchMachineMilestoneUnlocked;
  }, [autoScratchMachineMilestoneUnlocked, showAutoScratchMachineUnlockToast]);

  useEffect(() => {
    if (!hasHydrated || !autoScratchMachineMilestoneUnlocked || autoScratchMachineUnlocked) {
      return;
    }

    autoScratchMachineOfferFocusedRef.current = true;
    showAutoScratchMachineUnlockToast();
  }, [
    autoScratchMachineMilestoneUnlocked,
    autoScratchMachineUnlocked,
    hasHydrated,
    showAutoScratchMachineUnlockToast,
  ]);

  useEffect(() => {
    if (activeLoans.length === 0 && !loanRepaymentFeedback) {
      setLoanLedgerOpen(false);
    }
  }, [activeLoans.length, loanRepaymentFeedback]);

  useEffect(() => {
    if (!phoneNoticePending) {
      setPhoneMessageOpen(false);
      setUpgradeToolsPhoneStep(0);
      setTripleMatchPhoneStep(0);
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

  const triggerGoldEffect = useCallback(
    (previousGold: number, nextGold: number, source: GoldEffectSource) => {
      const effect = getGoldChangeEffect(previousGold, nextGold, source);

      if (!effect) {
        return;
      }

      const event = {
        ...effect,
        id: goldEffectIdRef.current + 1,
        source,
      };
      goldEffectIdRef.current = event.id;
      setCoinEffectPulse(event);
      setGoldEffectEvents((current) => [...current.slice(-(GOLD_EFFECT_MAX_EVENTS - 1)), event]);

      const removeTimer = window.setTimeout(() => {
        setGoldEffectEvents((current) => current.filter((item) => item.id !== event.id));
      }, GOLD_EFFECT_DURATION_MS);
      const pulseTimer = window.setTimeout(() => {
        setCoinEffectPulse((current) => (current?.id === event.id ? null : current));
      }, GOLD_EFFECT_DURATION_MS);

      goldEffectTimerRefs.current.push(removeTimer, pulseTimer);
    },
    [],
  );

  const flushAutoScratchPurchaseGoldEffect = useCallback(() => {
    const pendingEffect = pendingAutoScratchPurchaseEffectRef.current;
    pendingAutoScratchPurchaseEffectRef.current = null;
    autoScratchPurchaseEffectTimerRef.current = null;

    if (!pendingEffect) {
      return;
    }

    triggerGoldEffect(pendingEffect.previousGold, pendingEffect.nextGold, 'scratch-card-purchase');
  }, [triggerGoldEffect]);

  const queueAutoScratchPurchaseGoldEffect = useCallback(
    (previousGold: number, nextGold: number) => {
      if (nextGold >= previousGold) {
        return;
      }

      const pendingEffect = pendingAutoScratchPurchaseEffectRef.current;
      pendingAutoScratchPurchaseEffectRef.current = pendingEffect
        ? {
            previousGold: pendingEffect.previousGold,
            nextGold,
          }
        : {
            previousGold,
            nextGold,
          };

      if (autoScratchPurchaseEffectTimerRef.current) {
        window.clearTimeout(autoScratchPurchaseEffectTimerRef.current);
      }

      autoScratchPurchaseEffectTimerRef.current = window.setTimeout(
        flushAutoScratchPurchaseGoldEffect,
        AUTO_SCRATCH_PURCHASE_EFFECT_WINDOW_MS,
      );
    },
    [flushAutoScratchPurchaseGoldEffect],
  );

  const showAutoScratchSettlementFeedback = useCallback((card: ScratchCardState) => {
    autoScratchSettlementFeedbackIdRef.current += 1;
    const display = getScratchCardDisplay(card.type);

    setAutoScratchSettlementFeedback({
      id: autoScratchSettlementFeedbackIdRef.current,
      title: display.title,
      label: card.result.label,
      payout: card.result.isWinning && !card.result.penaltyTriggered ? card.result.payout : 0,
      isWinning: card.result.isWinning && !card.result.penaltyTriggered,
    });
  }, []);

  const holdAutoScratchNextVisualBeat = useCallback(() => {
    if (autoScratchVisualHoldTimerRef.current) {
      window.clearTimeout(autoScratchVisualHoldTimerRef.current);
    }

    setAutoScratchVisualHoldActive(true);
    autoScratchVisualHoldTimerRef.current = window.setTimeout(() => {
      setAutoScratchVisualHoldActive(false);
      autoScratchVisualHoldTimerRef.current = null;
    }, AUTO_SCRATCH_AFTER_SETTLEMENT_VISUAL_HOLD_MS);
  }, []);

  useEffect(() => {
    if (!autoScratchMachineUnlocked || autoScratchTickDelayMs === null) {
      return;
    }

    const scheduleKey = autoScratchTickScheduleKey;
    const elapsedMs = autoScratchCurrentCard
      ? Math.max(
          0,
          Math.min(
            AUTO_SCRATCH_TICK_MS,
            autoScratchProcessingMs - save.automation.autoScratchProgressMs,
          ),
        )
      : 0;

    const timer = window.setTimeout(() => {
      if (scheduleKey !== autoScratchTickScheduleKey) {
        return;
      }

      const goldEffects: {
        previousGold: number;
        nextGold: number;
        source: GoldEffectSource;
      }[] = [];
      const completedCards: ScratchCardState[] = [];

      updateSave((current) => {
        const nextSave = advanceAutoScratchMachineSave(current, elapsedMs);
        const completedCard = current.automation.autoScratchCurrentCard;

        if (completedCard && nextSave.player.cardsScratched > current.player.cardsScratched) {
          completedCards.push(completedCard);
        }

        if (nextSave.player.gold !== current.player.gold) {
          goldEffects.push({
            previousGold: current.player.gold,
            nextGold: nextSave.player.gold,
            source:
              nextSave.player.gold > current.player.gold
                ? 'scratch-prize'
                : 'scratch-card-purchase',
          });
        }

        return nextSave;
      });

      const goldEffect = goldEffects[0];
      const completedCard = completedCards[0];

      if (completedCard) {
        showAutoScratchSettlementFeedback(completedCard);
        holdAutoScratchNextVisualBeat();
      }

      if (goldEffect) {
        if (goldEffect.source === 'scratch-card-purchase') {
          queueAutoScratchPurchaseGoldEffect(goldEffect.previousGold, goldEffect.nextGold);
        } else {
          triggerGoldEffect(goldEffect.previousGold, goldEffect.nextGold, goldEffect.source);
        }
      }
    }, autoScratchTickDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    autoScratchCurrentCard,
    autoScratchMachineUnlocked,
    autoScratchProcessingMs,
    autoScratchTickDelayMs,
    autoScratchTickScheduleKey,
    queueAutoScratchPurchaseGoldEffect,
    holdAutoScratchNextVisualBeat,
    save.automation.autoScratchProgressMs,
    showAutoScratchSettlementFeedback,
    triggerGoldEffect,
    updateSave,
  ]);

  function resetScratchRevealEffects() {
    if (settlementHighlightTimerRef.current) {
      window.clearTimeout(settlementHighlightTimerRef.current);
      settlementHighlightTimerRef.current = null;
    }

    revealedScratchSlotSetRef.current = new Set();
    setRevealedScratchSlots([]);
    setFlashingScratchSlots([]);
    setSettlementHighlightSlots([]);
  }

  function revealScratchSlots(slotIndexes: readonly number[]) {
    const nextSlotIndexes: number[] = [];

    for (const slotIndex of slotIndexes) {
      if (revealedScratchSlotSetRef.current.has(slotIndex)) {
        continue;
      }

      revealedScratchSlotSetRef.current.add(slotIndex);
      nextSlotIndexes.push(slotIndex);
    }

    if (nextSlotIndexes.length === 0) {
      return [...revealedScratchSlotSetRef.current];
    }

    setRevealedScratchSlots((current) => [...new Set([...current, ...nextSlotIndexes])]);
    setFlashingScratchSlots((current) => [...new Set([...current, ...nextSlotIndexes])]);

    for (const slotIndex of nextSlotIndexes) {
      const timer = window.setTimeout(() => {
        setFlashingScratchSlots((current) => current.filter((item) => item !== slotIndex));
      }, SCRATCH_SLOT_FLASH_DURATION_MS);
      scratchSlotFlashTimerRefs.current.push(timer);
    }

    return [...revealedScratchSlotSetRef.current];
  }

  function revealScratchSlot(slotIndex: number) {
    revealScratchSlots([slotIndex]);

    if (!activeScratchCard) {
      return;
    }

    if (activeScratchCard.type === 'push-luck') {
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
              card.id === activeCardId ? revealPushLuckLayer(card, slotIndex + 1) : card,
            ),
          },
        };
      });
      return;
    }

    if (!shouldTriggerScratchCardPenalty(activeScratchCard, slotIndex)) {
      return;
    }

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
            card.id === activeCardId ? markScratchCardPenaltyTriggered(card) : card,
          ),
        },
      };
    });
  }

  function markTriggeredPenaltiesForRevealedSlots(
    card: ScratchCardState,
    slotIndexes: readonly number[],
  ) {
    return slotIndexes.some((slotIndex) => shouldTriggerScratchCardPenalty(card, slotIndex))
      ? markScratchCardPenaltyTriggered(card)
      : card;
  }

  function scheduleSettlementHighlight(
    card: ScratchCardState,
    revealedSlotIndexes: readonly number[],
  ) {
    if (settlementHighlightTimerRef.current) {
      window.clearTimeout(settlementHighlightTimerRef.current);
      settlementHighlightTimerRef.current = null;
    }

    setSettlementHighlightSlots([]);

    if (!card.result.isWinning) {
      return;
    }

    const highlightDelay = getScratchCardSettlementHighlightDelayMs({
      cardType: card.type,
      revealedSlotIndexes,
      revealFlashDurationMs: SCRATCH_SLOT_FLASH_DURATION_MS,
      settleDelayMs: SCRATCH_SETTLEMENT_HIGHLIGHT_DELAY_MS,
    });

    if (highlightDelay === null) {
      return;
    }

    const winningSlotIndexes = getWinningScratchSymbolIndexes(
      card.result.symbols,
      Number(getScratchCardConfig(card.type).matchRule.requiredMatches),
    );

    settlementHighlightTimerRef.current = window.setTimeout(() => {
      setSettlementHighlightSlots(winningSlotIndexes);
      settlementHighlightTimerRef.current = null;
    }, highlightDelay);
  }

  function getPlatePositionFromPointer(clientX: number, clientY: number, offsetX = 0, offsetY = 0) {
    const table = tableRef.current;

    if (!table) {
      return null;
    }

    const bounds = table.getBoundingClientRect();
    return getBoundedPlatePosition(
      {
        clientX: clientX - offsetX,
        clientY: clientY - offsetY,
      },
      bounds,
      DESKTOP_PLATE_SIZE,
    );
  }

  function previewPlatePositionFromPointer(
    plateId: number,
    clientX: number,
    clientY: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const position = getPlatePositionFromPointer(clientX, clientY, offsetX, offsetY);

    if (!position) {
      return null;
    }

    setDragPreviewPositions((current) => ({
      ...current,
      plates: {
        ...current.plates,
        [plateId]: position,
      },
    }));

    return position;
  }

  function getScratchCardPositionFromPointer(
    clientX: number,
    clientY: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const table = tableRef.current;

    if (!table) {
      return null;
    }

    const bounds = table.getBoundingClientRect();
    return getBoundedDesktopPosition(
      {
        clientX: clientX - offsetX,
        clientY: clientY - offsetY,
      },
      bounds,
      TABLETOP_SCRATCH_CARD_SIZE.width,
      TABLETOP_SCRATCH_CARD_SIZE.height,
    );
  }

  function previewScratchCardPositionFromPointer(
    cardId: number,
    clientX: number,
    clientY: number,
    offsetX = 0,
    offsetY = 0,
  ) {
    const position = getScratchCardPositionFromPointer(clientX, clientY, offsetX, offsetY);

    if (!position) {
      return null;
    }

    setDragPreviewPositions((current) => ({
      ...current,
      scratchCards: {
        ...current.scratchCards,
        [cardId]: position,
      },
    }));

    return position;
  }

  function commitPlatePosition(plateId: number, position: WorkPlateState['position'] | null) {
    if (!position) {
      return;
    }

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

  function commitScratchCardPosition(
    cardId: number,
    position: ScratchCardState['position'] | null,
  ) {
    if (!position) {
      return;
    }

    updateSave((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        scratchCards: current.workspace.scratchCards.map((card) =>
          card.id === cardId ? { ...card, position } : card,
        ),
      },
    }));
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
    setDragPreviewPositions((current) => ({ ...current, plates: {} }));
  }

  function resetScratchCardPointer() {
    if (scratchCardPointerRef.current?.holdTimer) {
      clearTimeout(scratchCardPointerRef.current.holdTimer);
    }

    scratchCardPointerRef.current = null;
    setDraggingScratchCardId(null);
    setLiftedScratchCardId(null);
    setTrashHoverScratchCardId(null);
    setDragPreviewPositions((current) => ({ ...current, scratchCards: {} }));
  }

  function startPlateDrag(pointerState: PlatePointerState) {
    pointerState.dragging = true;
    setDraggingPlateId(pointerState.plateId);
    setLiftedPlateId(pointerState.plateId);
    previewPlatePositionFromPointer(
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
    previewScratchCardPositionFromPointer(
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

    triggerGoldEffect(player.gold, goldAfterCost, 'work-cost');
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
            isCleaned: false,
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

  function buyScratchCard(cardType: ScratchCardType) {
    const buyable =
      cardType === 'triple-match'
        ? canBuyTripleMatchCard
        : cardType === 'risk-peek'
          ? canBuyRiskPeekCard
          : cardType === 'push-luck'
            ? canBuyPushLuckCard
            : cardType === 'final-chance'
              ? canBuyFinalChanceCard
              : canBuyBasicSafeCard;

    if (!buyable) {
      return;
    }

    const scratchCardId = save.workspace.nextScratchCardId;
    const progress =
      cardType === 'triple-match'
        ? tripleMatchLevelProgress
        : cardType === 'risk-peek'
          ? riskPeekLevelProgress
          : cardType === 'push-luck'
            ? pushLuckLevelProgress
            : cardType === 'final-chance'
              ? finalChanceLevelProgress
              : basicSafeLevelProgress;
    const scratchCard = createScratchCard(cardType, {
      id: scratchCardId,
      level: progress.level,
      luckLevel: scratchLuckToolLevel,
      forcedTierId:
        cardType === 'basic-safe' && shouldForceWrongScratchCardForLoan(activeLoans, scratchCardId)
          ? 'no-pair'
          : undefined,
    });
    const scratchCardConfig = getScratchCardConfig(cardType);

    triggerGoldEffect(player.gold, player.gold - scratchCardConfig.price, 'scratch-card-purchase');
    setScratchProgress(0);
    updateSave((current) => ({
      ...current,
      player: {
        ...current.player,
        gold: current.player.gold - scratchCardConfig.price,
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

    if (
      scratchLuckToolLevel > 0 &&
      cardType !== 'risk-peek' &&
      cardType !== 'push-luck' &&
      cardType !== 'final-chance'
    ) {
      setLuckyScratchCardIds((current) => [...current, scratchCardId]);
      const luckyTimer = window.setTimeout(() => {
        setLuckyScratchCardIds((current) => current.filter((id) => id !== scratchCardId));
      }, LUCKY_CARD_EFFECT_MS);
      plateEnterTimerRefs.current.push(luckyTimer);
    }
  }

  function openScratchCard(cardId: number) {
    const selectedCard = tableScratchCards.find((card) => card.id === cardId);

    if (phase !== 'scratchCardSpawned' || !selectedCard) {
      return;
    }

    resetScratchRevealEffects();

    const revealedSlotIndexes = getPersistedRevealedScratchSlotIndexes(selectedCard);

    if (revealedSlotIndexes.length > 0) {
      revealedScratchSlotSetRef.current = new Set(revealedSlotIndexes);
      setRevealedScratchSlots(revealedSlotIndexes);
    }

    if (selectedCard.status === 'claimable') {
      scheduleSettlementHighlight(selectedCard, revealedSlotIndexes);
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

    resetScratchRevealEffects();
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
      const selectedPlate = plates.find((plate) => plate.id === plateId);

      resetPlatePointer();
      setCleanProgress(selectedPlate?.isCleaned ? 1 : 0);
      setCleaningStartedAt(selectedPlate?.isCleaned ? null : Date.now());
      updateSave((current) => ({
        ...current,
        workspace: {
          ...current.workspace,
          activePlateId: plateId,
          phase: selectedPlate?.isCleaned ? 'claimable' : 'cleaning',
        },
      }));
    }
  }

  function closeCleaningView() {
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

  function recordActivePlateCleanPoints(points: readonly ScratchSurfacePoint[]) {
    if (points.length === 0) {
      return;
    }

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
              ? { ...plate, cleanPoints: [...plate.cleanPoints, ...points] }
              : plate,
          ),
        },
      };
    });
  }

  function recordActiveScratchPoints(points: readonly ScratchSurfacePoint[]) {
    if (points.length === 0) {
      return;
    }

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
              ? { ...card, scratchPoints: [...card.scratchPoints, ...points] }
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
    previewPlatePositionFromPointer(
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

    if (wasDragged) {
      commitPlatePosition(
        pointerState.plateId,
        getPlatePositionFromPointer(
          event.clientX,
          event.clientY,
          pointerState.offsetX,
          pointerState.offsetY,
        ),
      );
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
    previewScratchCardPositionFromPointer(
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
      resetScratchRevealEffects();
      resetScratchCardPointer();
      return;
    }

    if (wasDragged) {
      commitScratchCardPosition(
        pointerState.cardId,
        getScratchCardPositionFromPointer(
          event.clientX,
          event.clientY,
          pointerState.offsetX,
          pointerState.offsetY,
        ),
      );
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
      updateSave((current) => {
        const activeId = current.workspace.activePlateId;
        const activePlateExists = current.workspace.plates.some((plate) => plate.id === activeId);

        if (current.workspace.phase !== 'cleaning' || !activeId || !activePlateExists) {
          return current;
        }

        return {
          ...current,
          workspace: {
            ...current.workspace,
            plates: current.workspace.plates.map((plate) =>
              plate.id === activeId ? { ...plate, isCleaned: true } : plate,
            ),
            phase: 'claimable',
          },
        };
      });
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

    const nextGold = Math.max(0, player.gold + claimedPlate.reward.total);
    const earnedGold = Math.max(0, claimedPlate.reward.total);
    const nextProficiency = advanceSegmentedProficiency(player.proficiency, earnedGold);
    const shouldShowTrashCanUnlock =
      !trashCanUnlocked && shouldUnlockTrashCan(nextProficiency, trashCanUnlocked);
    const shouldShowAutoScratchMachineUnlock =
      !autoScratchMachineMilestoneUnlocked &&
      nextProficiency >= getUnlockMilestoneThreshold(AUTO_SCRATCH_MACHINE_MILESTONE_ID);

    triggerGoldEffect(
      player.gold,
      nextGold,
      claimedPlate.reward.total < 0 ? 'broken-plate' : 'work-reward',
    );
    updateSave((current) => {
      const remainingPlates = current.workspace.plates.filter(
        (plate) => plate.id !== claimedPlate.id,
      );

      return {
        ...current,
        player: {
          ...current.player,
          gold: Math.max(0, current.player.gold + claimedPlate.reward.total),
          lifetimeGoldEarned: current.player.lifetimeGoldEarned + earnedGold,
          proficiency: advanceSegmentedProficiency(current.player.proficiency, earnedGold),
          plateCleaned: current.player.plateCleaned + 1,
        },
        notices: claimedPlate.reward.isBroken
          ? {
              ...current.notices,
              workRiskNoticeTriggered: true,
            }
          : current.notices,
        workspace: {
          ...current.workspace,
          activePlateId: null,
          plates: remainingPlates,
          phase: getDesktopPhase(remainingPlates.length, current.workspace.scratchCards.length),
        },
      };
    });
    if (shouldShowTrashCanUnlock) {
      showTrashCanUnlockToast();
    }
    if (shouldShowAutoScratchMachineUnlock) {
      showAutoScratchMachineUnlockToast();
    }
    setCleanProgress(0);
  }

  function completeScratchCard() {
    if (activeScratchCard?.type === 'push-luck') {
      return;
    }

    setScratchProgress(1);

    if (activeScratchCard) {
      const revealedSlotIndexes = revealScratchSlots(
        getScratchCardSlotIndexes(activeScratchCard.type),
      );
      scheduleSettlementHighlight(activeScratchCard, revealedSlotIndexes);
    }

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
            card.id === activeCardId
              ? {
                  ...markTriggeredPenaltiesForRevealedSlots(
                    card,
                    getScratchCardSlotIndexes(card.type),
                  ),
                  status: 'claimable',
                }
              : card,
          ),
        },
      };
    });
  }

  function claimScratchCardPrize() {
    if (!activeScratchCard || activeScratchCard.status !== 'claimable') {
      return;
    }

    if (activeScratchCard.type === 'final-chance') {
      updateSave((current) => settleFinalChanceScratchCardSave(current));
      resetScratchRevealEffects();
      setScratchProgress(0);
      return;
    }

    const cardToSettle =
      activeScratchCard.type === 'push-luck'
        ? cashOutPushLuckScratchCard(activeScratchCard)
        : activeScratchCard;
    const payout = cardToSettle.result.isWinning ? cardToSettle.result.payout : 0;
    const settledPlayer = settleScratchCard(player, cardToSettle);
    const shouldShowAutoScratchMachineUnlock =
      !autoScratchMachineMilestoneUnlocked &&
      settledPlayer.proficiency >= getUnlockMilestoneThreshold(AUTO_SCRATCH_MACHINE_MILESTONE_ID);

    if (payout > 0) {
      triggerGoldEffect(player.gold, player.gold + payout, 'scratch-prize');
    } else if (settledPlayer.gold < player.gold) {
      triggerGoldEffect(player.gold, settledPlayer.gold, 'broken-plate');
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
        player: settleScratchCard(
          current.player,
          currentCard.type === 'push-luck' ? cashOutPushLuckScratchCard(currentCard) : currentCard,
        ),
        scratchCards: {
          ...current.scratchCards,
          [getScratchCardSettlementProgressKey(currentCard.type)]:
            advanceBasicSafeScratchCardProgress(
              current.scratchCards[getScratchCardSettlementProgressKey(currentCard.type)],
            ),
        },
        workspace: {
          ...current.workspace,
          scratchCards: remainingScratchCards,
          activeScratchCardId: null,
          phase: getDesktopPhase(current.workspace.plates.length, remainingScratchCards.length),
        },
      };
    });
    if (shouldShowAutoScratchMachineUnlock) {
      showAutoScratchMachineUnlockToast();
    }
    resetScratchRevealEffects();
    setScratchProgress(0);
  }

  function continuePushLuckCard() {
    if (
      !activeScratchCard ||
      activeScratchCard.type !== 'push-luck' ||
      !activeScratchCard.result.canContinue
    ) {
      return;
    }

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
            card.id === activeCardId ? continuePushLuckScratchCard(card) : card,
          ),
        },
      };
    });
  }

  function discardActiveScratchCard() {
    if (!activeScratchCard || activeScratchCard.status !== 'scratching') {
      return;
    }

    const discardCost = getEffectiveScratchCardDiscardCost(player.gold, activeScratchCard);

    if (discardCost > 0) {
      triggerGoldEffect(player.gold, player.gold - discardCost, 'scratch-card-purchase');
    }

    updateSave((current) => {
      const currentCard = getActiveScratchCard(current);

      if (!currentCard || !currentCard.result.canDiscard || currentCard.result.penaltyTriggered) {
        return current;
      }

      const effectiveDiscardCost = getEffectiveScratchCardDiscardCost(
        current.player.gold,
        currentCard,
      );
      const remainingScratchCards = current.workspace.scratchCards.filter(
        (card) => card.id !== currentCard.id,
      );

      return {
        ...current,
        player: {
          ...current.player,
          gold: Math.max(0, current.player.gold - effectiveDiscardCost),
        },
        workspace: {
          ...current.workspace,
          scratchCards: remainingScratchCards,
          activeScratchCardId: null,
          phase: getDesktopPhase(current.workspace.plates.length, remainingScratchCards.length),
        },
      };
    });
    resetScratchRevealEffects();
    setScratchProgress(0);
  }

  function signEmergencyLoan() {
    if (!loanOfferNoticeVisible) {
      return;
    }

    triggerGoldEffect(player.gold, player.gold + LOAN_PRINCIPAL, 'loan-sign');
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

    triggerGoldEffect(player.gold, player.gold - TRASH_CAN_PRICE, 'upgrade-purchase');
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

  function buyAutoScratchMachine() {
    if (!canPurchaseAutoScratchMachine) {
      return;
    }

    triggerGoldEffect(
      player.gold,
      player.gold - AUTO_SCRATCH_MACHINE_CONFIG.price,
      'upgrade-purchase',
    );

    updateSave((current) => {
      const currentAutoMachineMilestoneUnlocked = isUnlockMilestoneUnlocked(
        current,
        AUTO_SCRATCH_MACHINE_CONFIG.unlock.requiredMilestoneId,
      );

      if (
        !canBuyAutoScratchMachine({
          gold: current.player.gold,
          milestoneUnlocked: currentAutoMachineMilestoneUnlocked,
          alreadyUnlocked: current.automation.autoScratchMachineUnlocked,
        })
      ) {
        return current;
      }

      return {
        ...current,
        player: {
          ...current.player,
          gold: current.player.gold - AUTO_SCRATCH_MACHINE_CONFIG.price,
        },
        automation: {
          ...current.automation,
          autoScratchMachineUnlocked: true,
          autoScratchMachineStatus: 'idle',
          autoScratchAutoBuyEnabled: true,
          autoScratchAllowedCardTypes: [AUTO_SCRATCH_MACHINE_CONFIG.base.defaultCardType],
          autoScratchMinReserveGold: 0,
        },
      };
    });
  }

  function toggleAutoScratchMachinePaused() {
    if (!autoScratchMachineUnlocked) {
      return;
    }

    updateSave((current) => {
      if (!current.automation.autoScratchMachineUnlocked) {
        return current;
      }

      const currentlyPaused = current.automation.autoScratchMachineStatus === 'paused';

      return {
        ...current,
        automation: {
          ...current.automation,
          autoScratchMachineStatus: currentlyPaused
            ? current.automation.autoScratchCurrentCard
              ? 'processing'
              : 'idle'
            : 'paused',
        },
      };
    });
  }

  function toggleAutoScratchMachineAutoBuy() {
    if (!autoScratchMachineUnlocked) {
      return;
    }

    updateSave((current) => {
      if (!current.automation.autoScratchMachineUnlocked) {
        return current;
      }

      const nextAutoBuyEnabled = !current.automation.autoScratchAutoBuyEnabled;
      const nextStatus = (() => {
        if (current.automation.autoScratchMachineStatus === 'paused') {
          return 'paused';
        }

        if (current.automation.autoScratchCurrentCard) {
          return 'processing';
        }

        if (current.automation.autoScratchQueue.length > 0) {
          return 'idle';
        }

        if (!nextAutoBuyEnabled) {
          return 'idle';
        }

        return current.automation.autoScratchMachineStatus === 'blocked'
          ? 'idle'
          : current.automation.autoScratchMachineStatus;
      })();

      return {
        ...current,
        automation: {
          ...current.automation,
          autoScratchAutoBuyEnabled: nextAutoBuyEnabled,
          autoScratchMachineStatus: nextStatus,
        },
      };
    });
  }

  function toggleAutoScratchMachineAllowedCardType(cardType: ScratchCardType) {
    if (!autoScratchMachineUnlocked || cardType !== 'basic-safe') {
      return;
    }

    updateSave((current) => {
      if (!current.automation.autoScratchMachineUnlocked) {
        return current;
      }

      const currentAllowedTypes = current.automation.autoScratchAllowedCardTypes;
      const nextAllowedTypes = currentAllowedTypes.includes(cardType)
        ? currentAllowedTypes.filter((allowedCardType) => allowedCardType !== cardType)
        : [cardType];
      const hasMachineWork =
        current.automation.autoScratchCurrentCard !== null ||
        current.automation.autoScratchQueue.length > 0;
      const nextStatus = (() => {
        if (current.automation.autoScratchMachineStatus === 'paused') {
          return 'paused';
        }

        if (current.automation.autoScratchCurrentCard) {
          return 'processing';
        }

        if (hasMachineWork) {
          return 'idle';
        }

        if (current.automation.autoScratchAutoBuyEnabled && nextAllowedTypes.length === 0) {
          return 'blocked';
        }

        return current.automation.autoScratchMachineStatus === 'blocked'
          ? 'idle'
          : current.automation.autoScratchMachineStatus;
      })();

      return {
        ...current,
        automation: {
          ...current.automation,
          autoScratchAllowedCardTypes: nextAllowedTypes,
          autoScratchMachineStatus: nextStatus,
        },
      };
    });
  }

  function takeOverAutoScratchCard(cardId: number) {
    if (!autoScratchMachineUnlocked) {
      return;
    }

    let didTakeOver = false;

    updateSave((current) => {
      const nextSave = takeOverAutoScratchMachineCard(current, cardId);
      didTakeOver = nextSave !== current;

      return nextSave;
    });

    if (!didTakeOver) {
      return;
    }

    setScratchProgress(0);
    setEnteringScratchCardIds((current) => [...current, cardId]);
    const enterTimer = window.setTimeout(() => {
      setEnteringScratchCardIds((current) => current.filter((id) => id !== cardId));
    }, PLATE_ENTER_ANIMATION_MS);
    plateEnterTimerRefs.current.push(enterTimer);
  }

  function setAutoScratchMachineReserveGold(value: number) {
    if (!autoScratchMachineUnlocked) {
      return;
    }

    const reserveGold = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

    updateSave((current) => {
      if (!current.automation.autoScratchMachineUnlocked) {
        return current;
      }

      const canBuyWithReserve =
        current.automation.autoScratchAutoBuyEnabled &&
        current.automation.autoScratchAllowedCardTypes.includes('basic-safe') &&
        current.player.gold - BASIC_SAFE_CARD_PRICE >= reserveGold;
      const nextStatus =
        current.automation.autoScratchMachineStatus === 'blocked' && canBuyWithReserve
          ? 'idle'
          : current.automation.autoScratchMachineStatus;

      return {
        ...current,
        automation: {
          ...current.automation,
          autoScratchMinReserveGold: reserveGold,
          autoScratchMachineStatus: nextStatus,
        },
      };
    });
  }

  function buyUpgradeTool(tool: UpgradeToolConfig) {
    if (!upgradeToolsVisible) {
      return;
    }

    const toolState = save.upgradeTools[tool.id];
    const currentPrice = toolState ? getUpgradeToolPrice(tool, toolState.level) : tool.price;

    if (toolState && canBuyUpgradeTool(player.gold, tool, toolState)) {
      triggerGoldEffect(player.gold, player.gold - currentPrice, 'upgrade-purchase');
    }

    updateSave((current) => {
      const currentToolState = current.upgradeTools[tool.id];

      if (!currentToolState || !canBuyUpgradeTool(current.player.gold, tool, currentToolState)) {
        return current;
      }

      const price = getUpgradeToolPrice(tool, currentToolState.level);

      return {
        ...current,
        player: {
          ...current.player,
          gold: current.player.gold - price,
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

    triggerGoldEffect(player.gold, repayLoan(player.gold, repaidLoan), 'loan-repayment');
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
    }, UNLOCK_TOAST_DURATION_MS);
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
    }, UNLOCK_TOAST_DURATION_MS);
  }

  function advanceTripleMatchUnlockPhone() {
    if (tripleMatchPhoneStep < TRIPLE_MATCH_PHONE_LINES.length - 1) {
      setTripleMatchPhoneStep((current) => current + 1);
      return;
    }

    updateSave((current) => ({
      ...current,
      notices: {
        ...current.notices,
        tripleMatchMessageDismissed: true,
      },
    }));

    if (unlockToastTimerRef.current) {
      window.clearTimeout(unlockToastTimerRef.current);
    }

    setUnlockToast('triple-match');
    unlockToastTimerRef.current = window.setTimeout(() => {
      setUnlockToast(null);
      unlockToastTimerRef.current = null;
    }, UNLOCK_TOAST_DURATION_MS);
  }

  return (
    <main className="scratch-shell select-none">
      <section className="game-frame" aria-label="刮出传说游戏界面">
        <aside className="left-panel">
          <div
            className={`coin-board ${
              coinEffectPulse
                ? `coin-board-${coinEffectPulse.direction} ${coinEffectPulse.intensity}`
                : ''
            }`}
          >
            <div className={`coin-row ${goldRolling ? 'rolling' : ''}`}>
              <span className="coin-icon" aria-hidden="true" />
              <strong>{displayedGold}</strong>
            </div>
            {goldEffectEvents.length > 0 && (
              <div className="gold-effect-layer" aria-hidden="true">
                {goldEffectEvents.map((event) => (
                  <span
                    className={`gold-float ${event.direction} ${event.intensity}`}
                    key={event.id}
                  >
                    {event.direction === 'increase' ? '+' : '-'}${event.amount}
                    {Array.from({ length: event.particleCount }).map((_, index) => (
                      <i
                        key={`${event.id}-${index}`}
                        style={
                          {
                            '--particle-index': index,
                          } as CSSProperties
                        }
                      />
                    ))}
                  </span>
                ))}
              </div>
            )}
            <div className="ticket-progress">
              <span>{stageGoalProgress.displayText}</span>
              <div className="progress-track">
                <div
                  className="progress-fill amber"
                  style={{ width: `${stageGoalProgress.ratio * 100}%` }}
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

          <div className="sidebar-scroll-area">
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
                    <em className={canAffordWork ? 'affordable' : 'unaffordable'}>
                      ${WORK_PLATE_COST}
                    </em>
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
                  <div className="scratch-card-album-list">
                    {SCRATCH_CARD_ALBUMS_CONFIG.filter((album) => album.slots.length > 0).map(
                      (album) => (
                        <section className="scratch-card-album" key={album.id}>
                          <div className="scratch-card-album-slots">
                            {album.slots.map((slot) => {
                              const item = slot.cardType
                                ? scratchCardCatalogItemByType.get(slot.cardType)
                                : null;

                              if (!slot.cardType || !item || !item.visible || !item.unlocked) {
                                return null;
                              }

                              const display = getScratchCardDisplay(item.type);
                              const prizePool = getScratchCardPrizePoolForLevel(
                                item.type,
                                item.progress.level,
                              );
                              const firstPrize =
                                prizePool.find((tier) => tier.payout > 0)?.payout ?? 0;
                              const buyable =
                                item.type === 'triple-match'
                                  ? canBuyTripleMatchCard
                                  : item.type === 'risk-peek'
                                    ? canBuyRiskPeekCard
                                    : item.type === 'push-luck'
                                      ? canBuyPushLuckCard
                                      : item.type === 'final-chance'
                                        ? canBuyFinalChanceCard
                                        : canBuyBasicSafeCard;

                              return (
                                <button
                                  className={`scratch-shop-card ${item.type} ${buyable ? '' : 'locked'}`}
                                  type="button"
                                  onClick={() => buyScratchCard(item.type)}
                                  disabled={!buyable}
                                  key={slot.id}
                                >
                                  <span className="scratch-ticket-icon">
                                    <span>{display.miniTitle}</span>
                                  </span>
                                  <span className="scratch-shop-copy">
                                    <small>{slot.roleLabel}</small>
                                    <strong>{display.title}</strong>
                                    <em>${item.price}</em>
                                    <small>小奖 ${firstPrize}</small>
                                  </span>
                                  <span className="scratch-shop-meta">
                                    <span className="scratch-level-badge">
                                      等级 {item.progress.level}
                                    </span>
                                    <span
                                      className="scratch-level-meter"
                                      role="progressbar"
                                      aria-label={display.levelAriaLabel}
                                      aria-valuemin={0}
                                      aria-valuemax={item.progress.target}
                                      aria-valuenow={item.progress.current}
                                    >
                                      <span
                                        style={{
                                          width: `${Math.max(10, item.progress.ratio * 100)}%`,
                                        }}
                                      />
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                )}
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
                  <article
                    className={`tool-card available buyable ${
                      canPurchaseTrashCan ? '' : 'insufficient'
                    }`}
                  >
                    <span className="tool-icon trash-preview" />
                    <div>
                      <strong>垃圾桶</strong>
                      <span>购买资格已解锁，花费 ${TRASH_CAN_PRICE} 后才会拥有垃圾桶。</span>
                    </div>
                    <em>
                      {canPurchaseTrashCan
                        ? `$${TRASH_CAN_PRICE}`
                        : `还差 $${TRASH_CAN_PRICE - player.gold}`}
                    </em>
                    <ShopPurchaseButton
                      price={TRASH_CAN_PRICE}
                      onClick={buyTrashCan}
                      disabled={!canPurchaseTrashCan}
                    />
                  </article>
                ) : (
                  <div className="tool-card locked placeholder">
                    <span className="tool-lock">锁</span>
                    <div>
                      <strong>垃圾桶</strong>
                      <span>熟练度达到 {TRASH_CAN_UNLOCK_AFTER_PLATES} 后解锁购买资格。</span>
                    </div>
                  </div>
                )}
                {(autoScratchMachineMilestoneUnlocked || autoScratchMachineUnlocked) && (
                  <AutoScratchMachineTargetCard
                    progress={autoScratchMachineProgress}
                    unlocked={autoScratchMachineUnlocked}
                    canBuy={canPurchaseAutoScratchMachine}
                    onBuy={buyAutoScratchMachine}
                  />
                )}
                {autoScratchMachineUnlocked && (
                  <div className={`automation-stage-five-entry ${autoScratchMachineStatus}`}>
                    <strong>{AUTO_SCRATCH_MACHINE_STATUS_LABELS[autoScratchMachineStatus]}</strong>
                    <span>{autoScratchMachineDetail}</span>
                    <div className="automation-mini-meter" aria-hidden="true">
                      <span style={{ width: `${Math.round(autoScratchProgressRatio * 100)}%` }} />
                    </div>
                    {autoScratchTakeoverCards.length > 0 && (
                      <div className="automation-takeover-list">
                        {autoScratchTakeoverCards.map(({ card, label }) => {
                          const display = getScratchCardDisplay(card.type);

                          return (
                            <button
                              className="automation-takeover-card"
                              key={card.id}
                              type="button"
                              onClick={() => takeOverAutoScratchCard(card.id)}
                            >
                              <span>{label}</span>
                              <strong>{display.miniTitle}</strong>
                              <em>接管</em>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {autoScratchSettlementFeedback && (
                      <div
                        className={`automation-settlement-feedback ${
                          autoScratchSettlementFeedback.isWinning ? 'winning' : 'blank'
                        }`}
                      >
                        <span>上次结算</span>
                        <strong>{autoScratchSettlementFeedback.label}</strong>
                        <em>
                          {autoScratchSettlementFeedback.payout > 0
                            ? `+$${autoScratchSettlementFeedback.payout}`
                            : '$0'}
                        </em>
                      </div>
                    )}
                    <div className="automation-controls">
                      <button
                        className="automation-control-button"
                        type="button"
                        onClick={toggleAutoScratchMachinePaused}
                      >
                        {autoScratchMachineStatus === 'paused' ? '继续' : '暂停'}
                      </button>
                      <label className="automation-switch">
                        <input
                          type="checkbox"
                          checked={autoScratchAutoBuyEnabled}
                          onChange={toggleAutoScratchMachineAutoBuy}
                        />
                        <span aria-hidden="true" />
                        <em>自动购买</em>
                      </label>
                    </div>
                    <div className="automation-reserve-control">
                      <span>保留金币</span>
                      <div className="automation-reserve-options">
                        {AUTO_SCRATCH_RESERVE_OPTIONS.map((reserveGold) => (
                          <button
                            className={reserveGold === autoScratchMinReserveGold ? 'active' : ''}
                            key={reserveGold}
                            type="button"
                            onClick={() => setAutoScratchMachineReserveGold(reserveGold)}
                          >
                            ${reserveGold}
                          </button>
                        ))}
                      </div>
                      <div className="automation-reserve-input">
                        <span aria-hidden="true">$</span>
                        <input
                          aria-label="自动刮刮机最低保留金币"
                          inputMode="numeric"
                          min={0}
                          step={10}
                          type="number"
                          value={autoScratchMinReserveGold}
                          onChange={(event) =>
                            setAutoScratchMachineReserveGold(Number(event.currentTarget.value))
                          }
                        />
                        <div className="automation-reserve-stepper">
                          <button
                            aria-label="增加保留金币"
                            type="button"
                            onClick={() =>
                              setAutoScratchMachineReserveGold(autoScratchMinReserveGold + 10)
                            }
                          >
                            +
                          </button>
                          <button
                            aria-label="减少保留金币"
                            type="button"
                            disabled={autoScratchMinReserveGold <= 0}
                            onClick={() =>
                              setAutoScratchMachineReserveGold(autoScratchMinReserveGold - 10)
                            }
                          >
                            -
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="automation-filter-control">
                      <span>允许票种</span>
                      <div className="automation-ticket-filter-list">
                        {autoScratchTicketFilterItems.map((item) =>
                          item.configurable ? (
                            <label
                              className={`automation-ticket-filter ${
                                item.enabled ? 'enabled' : ''
                              }`}
                              key={item.type}
                            >
                              <input
                                type="checkbox"
                                checked={item.enabled}
                                onChange={() => toggleAutoScratchMachineAllowedCardType(item.type)}
                              />
                              <span>{item.miniTitle}</span>
                              <strong>{item.title}</strong>
                              <em>{item.enabled ? '机器可补票' : item.unavailableLabel}</em>
                            </label>
                          ) : (
                            <div className="automation-ticket-filter locked" key={item.type}>
                              <span>{item.miniTitle}</span>
                              <strong>{item.title}</strong>
                              <em>{item.unavailableLabel}</em>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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

          <div className="wood-table">
            <div className="table-surface" aria-hidden="true" />
            <div className="table-furniture" aria-hidden="true">
              <span className="table-apron" />
              <span className="table-leg left" />
              <span className="table-leg right" />
            </div>

            <div className="table-playfield" ref={tableRef}>
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

              {autoScratchMachineUnlocked && (
                <AutoScratchMachineTableUnit
                  status={autoScratchMachineStatus}
                  currentCard={autoScratchCurrentCard}
                  queue={autoScratchMachineQueue}
                  progressRatio={autoScratchProgressRatio}
                  capacity={AUTO_SCRATCH_MACHINE_CONFIG.base.queueCapacity}
                />
              )}

              {roundSettlementCompleted && (
                <div className="round-settlement-card">
                  <span className="round-settlement-icon" aria-hidden="true" />
                  <strong>
                    {save.roundSettlement.result === 'failure'
                      ? '本轮已到结算时刻'
                      : '本轮终局成功'}
                  </strong>
                  <em>{save.roundSettlement.legendCount} 个传说符号</em>
                  <b>荣耀预览 {save.roundSettlement.gloryPreview}</b>
                  <small>等待荣耀结算</small>
                </div>
              )}

              {phase === 'idle' && !roundSettlementCompleted && (
                <div className="idle-hint">
                  <strong>刮个不停</strong>
                  <span>先赚启动金，再去买第一张刮刮卡。</span>
                </div>
              )}

              {(phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
                plates.map((plate, index) => {
                  const previewPosition = dragPreviewPositions.plates[plate.id] ?? plate.position;

                  return (
                    <button
                      className={`small-dirty-plate ${
                        enteringPlateIds.includes(plate.id) ? 'entering' : ''
                      } ${plate.isCleaned ? 'cleaned' : ''} ${
                        plate.reward.isBroken ? 'broken-risk' : ''
                      } ${liftedPlateId === plate.id ? 'lifted' : ''} ${
                        draggingPlateId === plate.id ? 'dragging' : ''
                      }`}
                      type="button"
                      key={plate.id}
                      style={{
                        left: `${previewPosition.xPercent}%`,
                        top: `${previewPosition.yPercent}%`,
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
                  );
                })}

              {phase === 'scratchCardSpawned' &&
                tableScratchCards.map((scratchCard, index) => {
                  const display = getScratchCardDisplay(scratchCard.type);
                  const previewPosition =
                    dragPreviewPositions.scratchCards[scratchCard.id] ?? scratchCard.position;

                  return (
                    <button
                      className={`tabletop-scratch-card ${display.cardClassName} ${
                        enteringScratchCardIds.includes(scratchCard.id) ? 'entering' : ''
                      } ${luckyScratchCardIds.includes(scratchCard.id) ? 'lucky-active' : ''} ${
                        scratchCard.type !== 'risk-peek' &&
                        scratchCard.type !== 'push-luck' &&
                        scratchCard.type !== 'final-chance' &&
                        scratchLuckToolLevel > 0
                          ? 'luck-boosted'
                          : ''
                      } ${liftedScratchCardId === scratchCard.id ? 'lifted' : ''} ${
                        draggingScratchCardId === scratchCard.id ? 'dragging' : ''
                      }`}
                      type="button"
                      key={scratchCard.id}
                      style={{
                        left: `${previewPosition.xPercent}%`,
                        top: `${previewPosition.yPercent}%`,
                        zIndex: draggingScratchCardId === scratchCard.id ? 6 : 3 + index,
                      }}
                      onPointerDown={(event) => handleScratchCardPointerDown(event, scratchCard)}
                      onPointerMove={handleScratchCardPointerMove}
                      onPointerUp={handleScratchCardPointerUp}
                      onPointerCancel={resetScratchCardPointer}
                      aria-label={`打开第 ${index + 1} 张${display.title}刮刮卡`}
                      aria-grabbed={draggingScratchCardId === scratchCard.id}
                    >
                      <span className="tabletop-ticket-title">{display.ticketTitle}</span>
                      <span className="tabletop-ticket-art" aria-hidden="true">
                        {scratchCard.type === 'push-luck' ? (
                          <>
                            <span className="tabletop-push-step step-1" />
                            <span className="tabletop-push-step step-2" />
                            <span className="tabletop-push-step step-3" />
                            <span className="tabletop-push-step step-4" />
                            <span className="tabletop-push-bust" />
                          </>
                        ) : scratchCard.type === 'final-chance' ? (
                          <>
                            <span className="tabletop-finale-star star-1" />
                            <span className="tabletop-finale-star star-2" />
                            <span className="tabletop-finale-star star-3" />
                            <span className="tabletop-finale-ribbon" />
                          </>
                        ) : (
                          <>
                            <span className="tabletop-art-sky" />
                            <span className="tabletop-art-mountain tall" />
                            <span className="tabletop-art-mountain low" />
                            <span className="tabletop-art-sun" />
                          </>
                        )}
                      </span>
                      <span className="tabletop-ticket-slots">
                        {scratchCard.type === 'triple-match'
                          ? '5格'
                          : scratchCard.type === 'risk-peek'
                            ? '6格'
                            : scratchCard.type === 'push-luck'
                              ? '4层'
                              : scratchCard.type === 'final-chance'
                                ? '5格'
                                : '3格'}
                      </span>
                      {luckyScratchCardIds.includes(scratchCard.id) && (
                        <span className="tabletop-luck-burst">幸运生效</span>
                      )}
                    </button>
                  );
                })}

              {phase === 'scratchingCard' && activeScratchCard && (
                <div className="scratch-card-view" onPointerDown={handleScratchCardViewPointerDown}>
                  <div
                    className={`scratch-card ${activeScratchCardDisplay.cardClassName} ${
                      activeScratchCard.status === 'claimable' ? 'revealed' : 'concealed'
                    } ${activeScratchCard.result.tierId}`}
                    ref={scratchCardRef}
                  >
                    <div className="scratch-card-header">
                      <span>{activeScratchCardDisplay.ticketTitle}</span>
                      <strong>
                        {activeScratchCard.type === 'final-chance'
                          ? activeScratchCardDisplay.title
                          : `${activeScratchCardDisplay.title} 等级 ${activeScratchCard.level}`}
                      </strong>
                    </div>
                    <div className="scratch-card-picture" aria-hidden="true">
                      {activeScratchCard.type === 'push-luck' ? (
                        <>
                          <span className="push-route-line" />
                          <span className="push-route-step step-1">1</span>
                          <span className="push-route-step step-2">2</span>
                          <span className="push-route-step step-3">3</span>
                          <span className="push-route-step step-4">4</span>
                          <span className="push-route-label">CASH OUT OR PUSH</span>
                        </>
                      ) : activeScratchCard.type === 'final-chance' ? (
                        <>
                          <span className="finale-route-star star-1">★</span>
                          <span className="finale-route-star star-2">★</span>
                          <span className="finale-route-star star-3">★</span>
                          <span className="finale-route-label">LAST SCRATCH</span>
                        </>
                      ) : (
                        <>
                          <span className="mountain tall" />
                          <span className="mountain low" />
                          <span className="sun" />
                        </>
                      )}
                    </div>
                    <div className="scratch-result-area">
                      <fieldset className="scratch-result-grid" aria-label="刮刮卡结果区">
                        {activeScratchCard.result.symbols.map((symbol, index) => (
                          <span
                            className={`scratch-result-slot ${symbol} ${
                              revealedScratchSlots.includes(index) ? 'slot-revealed' : ''
                            } ${flashingScratchSlots.includes(index) ? 'slot-flash' : ''} ${
                              settlementHighlightSlots.includes(index) ? 'slot-winning' : ''
                            } ${
                              activeScratchCard.status === 'claimable' &&
                              settlementHighlightSlots.length > 0 &&
                              !settlementHighlightSlots.includes(index)
                                ? 'slot-muted'
                                : ''
                            } ${
                              activeScratchCard.type === 'push-luck' &&
                              !revealedScratchSlots.includes(index)
                                ? 'slot-concealed'
                                : ''
                            }`}
                            data-layer={index + 1}
                            key={`${symbol}-${index}`}
                          >
                            {activeScratchCard.type !== 'push-luck' ||
                            revealedScratchSlots.includes(index) ? (
                              <ScratchSymbolIcon symbol={symbol} />
                            ) : (
                              <span className="push-layer-label">第 {index + 1} 层</span>
                            )}
                            <small>
                              {activeScratchCard.type === 'push-luck' &&
                              !revealedScratchSlots.includes(index)
                                ? '未揭露'
                                : SCRATCH_SYMBOL_LABELS[symbol]}
                            </small>
                          </span>
                        ))}
                      </fieldset>
                      <ScratchCardCanvas
                        key={activeScratchCard.id}
                        active={activeScratchCard.status === 'scratching'}
                        visible={shouldShowScratchCover(
                          activeScratchCard.type === 'push-luck' &&
                            activeScratchCard.result.pushLuck?.bustedLayer === null &&
                            activeScratchCard.result.pushLuck?.cashedOutLayer === null
                            ? 'scratching'
                            : activeScratchCard.status,
                          scratchProgress,
                          activeScratchCard.type,
                        )}
                        cardType={activeScratchCard.type}
                        scratchPoints={activeScratchCard.scratchPoints}
                        revealedSlotIndexes={getPersistedRevealedScratchSlotIndexes(
                          activeScratchCard,
                        )}
                        brushRadius={getScratchCardBrushRadius(
                          activeScratchCard.type,
                          scratchRadiusToolLevel,
                          activeLoans,
                        )}
                        stepDistance={getScratchCardStepDistance(activeScratchCard.type)}
                        enabledSlotIndexes={
                          activeScratchCard.type === 'push-luck'
                            ? [(activeScratchCard.result.pushLuck?.currentLayer ?? 1) - 1]
                            : undefined
                        }
                        onProgressChange={setScratchProgress}
                        onRevealSlotsSync={(slotIndexes) => {
                          revealedScratchSlotSetRef.current = new Set(slotIndexes);
                          setRevealedScratchSlots([...slotIndexes]);

                          if (
                            activeScratchCard?.type === 'push-luck' &&
                            slotIndexes.includes(
                              (activeScratchCard.result.pushLuck?.currentLayer ?? 1) - 1,
                            )
                          ) {
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
                                    card.id === activeCardId
                                      ? revealPushLuckLayer(
                                          card,
                                          activeScratchCard.result.pushLuck?.currentLayer ?? 1,
                                        )
                                      : card,
                                  ),
                                },
                              };
                            });
                            return;
                          }

                          if (
                            activeScratchCard &&
                            slotIndexes.some((slotIndex) =>
                              shouldTriggerScratchCardPenalty(activeScratchCard, slotIndex),
                            )
                          ) {
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
                                    card.id === activeCardId
                                      ? markScratchCardPenaltyTriggered(card)
                                      : card,
                                  ),
                                },
                              };
                            });
                          }
                        }}
                        onRevealSlot={revealScratchSlot}
                        onScratchPointsFlush={recordActiveScratchPoints}
                        onComplete={completeScratchCard}
                      />
                    </div>
                  </div>
                  <div className="scratch-info-card" data-scratch-control="true">
                    <div className="scratch-info-title">
                      <strong>{activeScratchCardDisplay.title}</strong>
                      <em>
                        {activeScratchCard.type === 'final-chance'
                          ? '本轮终局'
                          : `等级 ${activeScratchCard.level}`}
                      </em>
                    </div>
                    <span>
                      {activeScratchCard.type === 'final-chance' &&
                      activeScratchCard.status === 'claimable'
                        ? activeScratchCard.result.isWinning
                          ? activeScratchCardDisplay.winLabel
                          : activeScratchCardDisplay.loseLabel
                        : activeScratchCard.type === 'push-luck' &&
                            activeScratchCard.result.penaltyTriggered
                          ? `爆雷归零，手续费 $${getPushLuckBustPenalty(player.gold, activeScratchCard)}。`
                          : activeScratchCard.result.penaltyTriggered
                            ? '危险位已完全揭露，本张收益归零。'
                            : activeScratchCard.status === 'claimable'
                              ? activeScratchCard.result.isWinning
                                ? activeScratchCardDisplay.winLabel
                                : activeScratchCardDisplay.loseLabel
                              : activeScratchCard.type === 'push-luck'
                                ? `刮开第 ${
                                    activeScratchCard.result.pushLuck
                                      ? activeScratchCard.result.pushLuck.currentLayer
                                      : 1
                                  } 层`
                                : `拖动刮开，已揭露 ${Math.round(scratchProgress * 100)}%`}
                    </span>
                    <div className="scratch-rule-row">
                      <em>规则</em>
                      <b>{activeScratchCardDisplay.ruleLabel}</b>
                    </div>
                    {activeScratchPrizeRows.map((tier) => (
                      <div className="scratch-rule-row" key={tier.id}>
                        <em className="scratch-rule-symbol">
                          <ScratchSymbolIcon symbol={getPrizeTierSymbol(tier.id)} />
                          {tier.label.replace('成对', '')}
                        </em>
                        <b>
                          {activeScratchCard.type === 'push-luck'
                            ? `$${tier.payout}`
                            : `${Math.round((tier.displayProbability ?? tier.probability) * 100)}% / $${tier.payout}`}
                        </b>
                      </div>
                    ))}
                    {activeFinalChancePrizeRows.map((tier) => {
                      const legendCount = Number(String(tier.id).replace('final-', ''));
                      const gloryPreview =
                        scratchLegendConfig.scratchCards.finalChance.finalRule
                          .gloryPreviewByLegendCount[legendCount] ?? 1;

                      return (
                        <div className="scratch-rule-row" key={tier.id}>
                          <em className="scratch-rule-symbol">
                            <ScratchSymbolIcon symbol={legendCount >= 3 ? 'legend' : 'blank'} />
                            {legendCount} 传说
                          </em>
                          <b>
                            {Math.round((tier.displayProbability ?? tier.probability) * 100)}% /
                            荣耀 {gloryPreview}
                          </b>
                        </div>
                      );
                    })}
                    <div className="scratch-card-level-line">
                      <em>等级进度</em>
                      <span
                        className="scratch-level-meter"
                        role="progressbar"
                        aria-label={`${activeScratchCardDisplay.title}等级进度`}
                        aria-valuemin={0}
                        aria-valuemax={activeScratchCardLevelProgress.target}
                        aria-valuenow={activeScratchCardLevelProgress.current}
                      >
                        <span
                          style={{
                            width: `${Math.max(10, activeScratchCardLevelProgress.ratio * 100)}%`,
                          }}
                        />
                      </span>
                    </div>
                    {activeScratchCard.result.canDiscard &&
                      activeScratchCard.status === 'scratching' && (
                        <button
                          className="scratch-discard-button"
                          type="button"
                          onClick={discardActiveScratchCard}
                          disabled={activeScratchCard.result.penaltyTriggered}
                        >
                          弃卡 ${activeScratchCardDiscardCost}
                          {activeScratchCardDiscardCost < activeScratchCardBaseDiscardCost
                            ? ' 封顶保护'
                            : ''}
                        </button>
                      )}
                    {activeScratchCard.type === 'push-luck' &&
                      activeScratchCard.result.canContinue &&
                      !activeScratchCard.result.penaltyTriggered && (
                        <button
                          className="scratch-discard-button"
                          type="button"
                          onClick={continuePushLuckCard}
                        >
                          继续加码
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={claimScratchCardPrize}
                      disabled={activeScratchCard.status !== 'claimable'}
                    >
                      {activeScratchCard.type === 'final-chance'
                        ? `进入荣耀结算 ${
                            activeScratchCard.result.finalChance
                              ? activeScratchCard.result.finalChance.gloryPreview
                              : 0
                          }`
                        : activeScratchCard.type === 'push-luck' &&
                            activeScratchCard.result.canCashOut
                          ? `见好就收 $${activeScratchCard.result.payout}`
                          : getOutcomeAmountLabel(
                              activeScratchCard.status === 'claimable',
                              activeScratchCard.result.isWinning
                                ? activeScratchCard.result.payout
                                : 0,
                            )}
                    </button>
                  </div>
                </div>
              )}

              {trashCanAvailable && (
                <div
                  ref={trashCanRef}
                  className={`trash-can ${autoScratchMachineUnlocked ? 'with-auto-machine' : ''} ${
                    trashHoverPlateId || trashHoverScratchCardId ? 'open' : ''
                  }`}
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
                  <strong>{getUnlockToastTitle(unlockToast)}</strong>
                  <span>{getUnlockToastDetail(unlockToast)}</span>
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
                        {scratchPhoneStep < SCRATCH_PHONE_LINES.length - 1 ? '继续听' : '查看'}
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
                  ) : phoneNoticeType === 'triple-match' ? (
                    <>
                      <strong>电话提醒</strong>
                      <span>{TRIPLE_MATCH_PHONE_LINES[tripleMatchPhoneStep]}</span>
                      <button type="button" onClick={advanceTripleMatchUnlockPhone}>
                        {tripleMatchPhoneStep < TRIPLE_MATCH_PHONE_LINES.length - 1
                          ? '继续听'
                          : '上架新卡'}
                      </button>
                    </>
                  ) : (
                    <>
                      <strong>电话提醒</strong>
                      <span>
                        {getWorkRiskPhoneCopy(
                          scratchLegendConfig.notifications.phone.brokenPlateNoticeLevel,
                          workBrokenPlatePercent,
                        )}
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
            </div>

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
                    } ${
                      phase === 'claimable' && !activeReward.isBroken && activeReward.total > 0
                        ? 'success'
                        : ''
                    }`}
                    key={activePlate?.seed ?? activePlateId ?? 'cleaning'}
                    ref={cleaningPlateRef}
                  >
                    <div className="plate-rim" />
                    <CleaningCanvas
                      key={activePlateId ?? 'cleaning'}
                      active={phase === 'cleaning'}
                      completed={activePlate?.isCleaned ?? false}
                      cleanPoints={activePlate?.cleanPoints ?? []}
                      brushRadius={cleaningBrushRadius}
                      onProgressChange={setCleanProgress}
                      onCleanPointsFlush={recordActivePlateCleanPoints}
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
                    {workOutcomeRevealed ? workClaimAmountLabel : '结算'}
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
                <small>工具</small>
                <strong>升级工具</strong>
                <span>把刮卡手感和中奖路线变顺手。</span>
              </header>
              <div className="upgrade-tool-list">
                {UPGRADE_TOOLS_CONFIG.map((tool) => {
                  const toolState = save.upgradeTools[tool.id];
                  const toolLevel = toolState?.level ?? tool.level;
                  const buyable = canBuyUpgradeTool(player.gold, tool, { level: toolLevel });
                  const toolPrice = getUpgradeToolPrice(tool, toolLevel);

                  return (
                    <article className="upgrade-tool-card" key={tool.id}>
                      <UpgradeToolIcon toolId={tool.id} />
                      <div>
                        <strong>{tool.label}</strong>
                        <span>{tool.description}</span>
                        <small>{tool.effectLabel}</small>
                        {tool.id === 'scratch-luck' && (
                          <small className="upgrade-tool-current-effect">
                            {scratchLuckEffectLabel}
                          </small>
                        )}
                      </div>
                      <div className="upgrade-tool-meta">
                        <em>
                          {tool.id === 'copper-coin' ? '力量' : '等级'} {toolLevel}
                        </em>
                        <ShopPurchaseButton
                          price={toolPrice}
                          onClick={() => buyUpgradeTool(tool)}
                          disabled={!buyable}
                        />
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
