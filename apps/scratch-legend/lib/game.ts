import { scratchLegendConfig } from './game-config';

export const UNLOCK_MILESTONES = scratchLegendConfig.progression.proficiencyMilestones;
export const TRASH_CAN_MILESTONE_ID = 'trash-can' as const;
export const SCRATCH_MODE_MILESTONE_ID = 'scratch-mode' as const;
export const BASIC_CARD_UNLOCK_GOLD = getUnlockMilestoneThreshold(SCRATCH_MODE_MILESTONE_ID);
export const CLEAN_COMPLETE_THRESHOLD = scratchLegendConfig.work.cleanCompleteThreshold;
export const INITIAL_GOLD = scratchLegendConfig.economy.initialGold;
export const WORK_ACTION_DURATION_MS = scratchLegendConfig.work.actionDurationMs;
export const WORK_BROKEN_PLATE_CHANCE = scratchLegendConfig.work.brokenPlate.chance;
export const WORK_BROKEN_PLATE_ENABLED_AT_LEVEL =
  scratchLegendConfig.work.brokenPlate.enabledAtLevel;
export const WORK_SAFE_REWARD_CHANCE = 1 - WORK_BROKEN_PLATE_CHANCE;
export const WORK_MAX_LEVEL = scratchLegendConfig.work.level.maxLevel;
export const WORK_PLATES_REQUIRED_BY_LEVEL = scratchLegendConfig.work.level.platesRequiredByLevel;
export const WORK_PLATE_COST = scratchLegendConfig.work.plateCost;
export const TRASH_CAN_UNLOCK_AFTER_PLATES =
  scratchLegendConfig.unlockables.trashCan.autoUnlockAfterCleanedPlates;
export const TRASH_CAN_PRICE = scratchLegendConfig.unlockables.trashCan.price;
export const WORK_LEVEL_REWARD_TABLE = scratchLegendConfig.work.level.rewardByLevel;
export const BASIC_SAFE_CARD_CONFIG = scratchLegendConfig.scratchCards.basicSafe;
export const BASIC_SAFE_CARD_PRICE = BASIC_SAFE_CARD_CONFIG.price;
export const BASIC_SAFE_CARD_SCRATCH_COMPLETE_THRESHOLD =
  BASIC_SAFE_CARD_CONFIG.scratchCompleteThreshold;
export const BASIC_SAFE_CARD_SCRATCH_BRUSH = BASIC_SAFE_CARD_CONFIG.scratchBrush;
export const BASIC_SAFE_CARD_LEVEL_CONFIG = BASIC_SAFE_CARD_CONFIG.level;
export const BASIC_SAFE_CARD_MAX_LEVEL =
  BASIC_SAFE_CARD_LEVEL_CONFIG.payoutMultiplierByLevel.length;
export const UPGRADE_TOOLS_CONFIG = scratchLegendConfig.upgradeTools.items;
export const LOAN_CONFIG = scratchLegendConfig.loans;
export const LOAN_PRINCIPAL = LOAN_CONFIG.principal;
export const LOAN_REPAYMENT_AMOUNT = LOAN_CONFIG.repaymentAmount;

export type WorkPhase =
  | 'idle'
  | 'plateSpawned'
  | 'cleaning'
  | 'claimable'
  | 'scratchCardSpawned'
  | 'scratchingCard';

export type PlayerState = {
  gold: number;
  lifetimeGoldEarned: number;
  plateCleaned: number;
  cardsScratched: number;
  loseStreak: number;
  workLevel: number;
};

export type WorkReward = {
  base: number;
  total: number;
  isCrit: boolean;
  isBroken: boolean;
};

export type RollWorkRewardOptions = {
  workOrderIndex: number;
  gold: number;
  workLevel: number;
  random?: () => number;
};

export type DragPoint = {
  clientX: number;
  clientY: number;
};

export type SurfaceBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PlatePosition = {
  xPercent: number;
  yPercent: number;
};

export type ScratchSurfacePoint = PlatePosition;

export type WorkPlateState = {
  id: number;
  reward: WorkReward;
  position: PlatePosition;
  cleanPoints: ScratchSurfacePoint[];
  seed: number;
};

export type ScratchCardType = 'basic-safe';
export type ScratchCardStatus = 'onTable' | 'scratching' | 'claimable' | 'settled';
type BasicSafeScratchCardPrizeTierConfig = (typeof BASIC_SAFE_CARD_CONFIG.prizePool)[number];
export type ScratchCardPrizeTier = Omit<BasicSafeScratchCardPrizeTierConfig, 'payout'> & {
  payout: number;
};
export type ScratchCardPrizeTierId = BasicSafeScratchCardPrizeTierConfig['id'];
export type ScratchCardSymbol = 'fire' | 'cash' | 'bag' | 'blank';

export type ScratchCardResult = {
  tierId: ScratchCardPrizeTierId;
  label: string;
  payout: number;
  symbols: [ScratchCardSymbol, ScratchCardSymbol, ScratchCardSymbol];
  isWinning: boolean;
  hasPenaltySymbol: boolean;
  canDiscard: boolean;
};

export type ScratchCardState = {
  id: number;
  type: ScratchCardType;
  price: number;
  level: number;
  status: ScratchCardStatus;
  result: ScratchCardResult;
  position: PlatePosition;
  scratchPoints: ScratchSurfacePoint[];
};

export type ScratchCardProgressState = {
  cardsSettled: number;
};

export type UpgradeToolConfig = (typeof UPGRADE_TOOLS_CONFIG)[number];
export type UpgradeToolId = UpgradeToolConfig['id'];

export type UpgradeToolState = {
  level: number;
};

export type ScratchCardLevelProgress = {
  level: number;
  current: number;
  target: number;
  ratio: number;
  cardsSettled: number;
};

export type LoanTemplate = (typeof LOAN_CONFIG.templates)[number];
export type LoanPenaltyConfig = LoanTemplate['penalty'];

export type LoanState = {
  id: number;
  templateId: LoanTemplate['id'];
  title: string;
  effect: string;
  penalty: LoanPenaltyConfig;
  amount: number;
  signGold: number;
  interestRateLabel: string;
};

export type CreateBasicSafeScratchCardOptions = {
  id: number;
  level?: number;
  forcedTierId?: ScratchCardPrizeTierId;
  random?: () => number;
  symbolRandom?: () => number;
};

export type CreateLoanFromTemplateOptions = {
  id: number;
  templateIndex: number;
};

export type UnlockMilestone = (typeof UNLOCK_MILESTONES)[number];
export type UnlockMilestoneId = UnlockMilestone['id'];

export const UPGRADE_TOOLS_MILESTONE_ID = 'upgrade-tools' satisfies UnlockMilestoneId;

export function getWorkRewardAmountForLevel(workLevel: number) {
  const normalizedLevel = Math.max(0, Math.min(WORK_MAX_LEVEL, Math.floor(workLevel)));
  return WORK_LEVEL_REWARD_TABLE[normalizedLevel];
}

export function getWorkBrokenPlatePenaltyForLevel(workLevel: number) {
  return getWorkRewardAmountForLevel(workLevel);
}

export function getWorkLevelThreshold(level: number) {
  if (level <= 0) {
    return 0;
  }

  const normalizedLevel = Math.min(WORK_MAX_LEVEL, Math.max(0, Math.floor(level)));
  let total = 0;

  for (let currentLevel = 0; currentLevel < normalizedLevel; currentLevel += 1) {
    total += WORK_PLATES_REQUIRED_BY_LEVEL[currentLevel] ?? 0;
  }

  return total;
}

export function getUnlockMilestoneById(milestoneId: UnlockMilestoneId) {
  return UNLOCK_MILESTONES.find((milestone) => milestone.id === milestoneId);
}

function getUnlockMilestoneIndex(milestoneId: UnlockMilestoneId) {
  return UNLOCK_MILESTONES.findIndex((milestone) => milestone.id === milestoneId);
}

export function getUnlockMilestoneThreshold(milestoneId: UnlockMilestoneId) {
  const milestoneIndex = getUnlockMilestoneIndex(milestoneId);

  if (milestoneIndex < 0) {
    return 0;
  }

  return UNLOCK_MILESTONES.slice(0, milestoneIndex + 1).reduce(
    (sum, milestone) => sum + milestone.requiredProficiency,
    0,
  );
}

function getPreviousUnlockMilestoneThreshold(milestone: UnlockMilestone | null) {
  if (!milestone) {
    return UNLOCK_MILESTONES.reduce((sum, item) => sum + item.requiredProficiency, 0);
  }

  const milestoneIndex = getUnlockMilestoneIndex(milestone.id);

  if (milestoneIndex <= 0) {
    return 0;
  }

  return UNLOCK_MILESTONES.slice(0, milestoneIndex).reduce(
    (sum, item) => sum + item.requiredProficiency,
    0,
  );
}

export function getNextUnlockMilestone(totalProficiency: number) {
  return (
    UNLOCK_MILESTONES.find(
      (milestone) => totalProficiency < getUnlockMilestoneThreshold(milestone.id),
    ) ?? null
  );
}

export function getUnlockMilestoneCurrentValue(
  totalProficiency: number,
  milestone: UnlockMilestone | null,
) {
  if (!milestone) {
    return 0;
  }

  const previousThreshold = getPreviousUnlockMilestoneThreshold(milestone);

  return Math.max(0, Math.min(milestone.requiredProficiency, totalProficiency - previousThreshold));
}

export function getUnlockMilestoneProgress(
  totalProficiency: number,
  milestone: UnlockMilestone | null,
) {
  if (!milestone) {
    return 1;
  }

  return clampRatio(
    getUnlockMilestoneCurrentValue(totalProficiency, milestone) / milestone.requiredProficiency,
  );
}

export function canAffordWorkPlate(gold: number) {
  return gold >= WORK_PLATE_COST;
}

export function canStartWorkFromPhase(phase: WorkPhase, gold: number) {
  return (
    (phase === 'idle' || phase === 'plateSpawned' || phase === 'scratchCardSpawned') &&
    canAffordWorkPlate(gold)
  );
}

export function canBuyBasicSafeScratchCard(
  player: Pick<PlayerState, 'gold' | 'lifetimeGoldEarned'>,
) {
  return (
    player.gold >= BASIC_SAFE_CARD_PRICE && player.lifetimeGoldEarned >= BASIC_CARD_UNLOCK_GOLD
  );
}

function getScratchCardLevelRequirements(cardType: ScratchCardType) {
  if (cardType === 'basic-safe') {
    return BASIC_SAFE_CARD_LEVEL_CONFIG.cardsRequiredByLevel;
  }

  return [] as const;
}

export function getScratchCardMaxLevel(cardType: ScratchCardType) {
  if (cardType === 'basic-safe') {
    return BASIC_SAFE_CARD_MAX_LEVEL;
  }

  return 1;
}

export function getScratchCardLevelThreshold(cardType: ScratchCardType, level: number) {
  if (level <= 1) {
    return 0;
  }

  const requirements = getScratchCardLevelRequirements(cardType);
  const maxLevel = getScratchCardMaxLevel(cardType);
  const normalizedLevel = Math.min(maxLevel, Math.max(1, Math.floor(level)));
  let total = 0;

  for (let currentLevel = 1; currentLevel < normalizedLevel; currentLevel += 1) {
    total += requirements[currentLevel - 1] ?? 0;
  }

  return total;
}

export function getScratchCardLevel(cardType: ScratchCardType, cardsSettled: number) {
  const requirements = getScratchCardLevelRequirements(cardType);
  const maxLevel = getScratchCardMaxLevel(cardType);
  let level = 1;
  let remainingCards = Math.max(0, Math.floor(cardsSettled));

  while (level < maxLevel) {
    const requiredCards = requirements[level - 1];

    if (!requiredCards || remainingCards < requiredCards) {
      break;
    }

    remainingCards -= requiredCards;
    level += 1;
  }

  return level;
}

export function getScratchCardLevelProgress(
  cardType: ScratchCardType,
  cardsSettled: number,
): ScratchCardLevelProgress {
  const level = getScratchCardLevel(cardType, cardsSettled);
  const maxLevel = getScratchCardMaxLevel(cardType);
  const normalizedCardsSettled = Math.max(0, Math.floor(cardsSettled));

  if (level >= maxLevel) {
    return {
      level,
      current: 0,
      target: 0,
      ratio: 1,
      cardsSettled: normalizedCardsSettled,
    };
  }

  const levelStartThreshold = getScratchCardLevelThreshold(cardType, level);
  const target = getScratchCardLevelRequirements(cardType)[level - 1] ?? 0;
  const current = Math.max(0, Math.min(target, normalizedCardsSettled - levelStartThreshold));

  return {
    level,
    current,
    target,
    ratio: target > 0 ? clampRatio(current / target) : 1,
    cardsSettled: normalizedCardsSettled,
  };
}

function normalizeScratchCardLevel(level: number) {
  return Math.max(1, Math.min(BASIC_SAFE_CARD_MAX_LEVEL, Math.floor(level)));
}

function getBasicSafeScratchCardPayoutMultiplier(level: number) {
  const normalizedLevel = normalizeScratchCardLevel(level);

  return BASIC_SAFE_CARD_LEVEL_CONFIG.payoutMultiplierByLevel[normalizedLevel - 1] ?? 1;
}

export function getBasicSafeScratchCardPrizePoolForLevel(level: number): ScratchCardPrizeTier[] {
  const payoutMultiplier = getBasicSafeScratchCardPayoutMultiplier(level);

  return BASIC_SAFE_CARD_CONFIG.prizePool.map((tier) => ({
    ...tier,
    payout: Math.floor(tier.payout * payoutMultiplier),
  }));
}

export function getBasicSafeScratchCardPrizeTier(random: () => number = Math.random, level = 1) {
  const roll = clampRatio(random());
  let cumulativeProbability = 0;
  const prizePool = getBasicSafeScratchCardPrizePoolForLevel(level);

  for (const tier of prizePool) {
    cumulativeProbability += tier.probability;

    if (roll < cumulativeProbability - Number.EPSILON) {
      return tier;
    }
  }

  return prizePool[prizePool.length - 1];
}

function getBasicSafeScratchCardPrizeTierById(level: number, tierId: ScratchCardPrizeTierId) {
  return (
    getBasicSafeScratchCardPrizePoolForLevel(level).find((tier) => tier.id === tierId) ??
    getBasicSafeScratchCardPrizeTier(Math.random, level)
  );
}

export function isScratchCardWinningResult(symbols: readonly ScratchCardSymbol[]) {
  return symbols.some((symbol, index) => symbol !== 'blank' && symbols.indexOf(symbol) !== index);
}

export function shouldRevealFullScratchCover(scratchedRatio: number) {
  return scratchedRatio >= BASIC_SAFE_CARD_SCRATCH_COMPLETE_THRESHOLD;
}

export function shouldShowScratchCover(status: ScratchCardStatus, scratchProgress: number) {
  return status === 'scratching' && !shouldRevealFullScratchCover(scratchProgress);
}

const BASIC_SAFE_RESULT_SYMBOLS = [
  'fire',
  'cash',
  'bag',
] as const satisfies readonly ScratchCardSymbol[];

function getRandomArrayIndex(length: number, random: () => number) {
  return Math.min(length - 1, Math.floor(clampRatio(random()) * length));
}

function shuffleScratchCardSymbols(
  symbols: readonly ScratchCardSymbol[],
  random: () => number,
): [ScratchCardSymbol, ScratchCardSymbol, ScratchCardSymbol] {
  const shuffled = [...symbols];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomArrayIndex(index + 1, random);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return [shuffled[0], shuffled[1], shuffled[2]];
}

function getPairSymbolForPrizeTier(tierId: ScratchCardPrizeTierId) {
  switch (tierId) {
    case 'pair-fire':
      return 'fire';
    case 'pair-cash':
      return 'cash';
    case 'pair-bag':
      return 'bag';
    default:
      return null;
  }
}

function createSymbolsForPrizeTier(
  tierId: ScratchCardPrizeTierId,
  random: () => number,
): [ScratchCardSymbol, ScratchCardSymbol, ScratchCardSymbol] {
  const pairSymbol = getPairSymbolForPrizeTier(tierId);

  if (!pairSymbol) {
    return shuffleScratchCardSymbols(BASIC_SAFE_RESULT_SYMBOLS, random);
  }

  const decoySymbols = BASIC_SAFE_RESULT_SYMBOLS.filter((symbol) => symbol !== pairSymbol);
  const decoySymbol = decoySymbols[getRandomArrayIndex(decoySymbols.length, random)];
  const decoyIndex = getRandomArrayIndex(3, random);
  const symbols: [ScratchCardSymbol, ScratchCardSymbol, ScratchCardSymbol] = [
    pairSymbol,
    pairSymbol,
    pairSymbol,
  ];
  symbols[decoyIndex] = decoySymbol;

  return symbols;
}

export function createBasicSafeScratchCard(options: CreateBasicSafeScratchCardOptions) {
  const level = normalizeScratchCardLevel(options.level ?? 1);
  const tier = options.forcedTierId
    ? getBasicSafeScratchCardPrizeTierById(level, options.forcedTierId)
    : getBasicSafeScratchCardPrizeTier(options.random, level);
  const symbols = createSymbolsForPrizeTier(tier.id, options.symbolRandom ?? Math.random);

  return {
    id: options.id,
    type: BASIC_SAFE_CARD_CONFIG.id,
    price: BASIC_SAFE_CARD_PRICE,
    level,
    status: 'onTable',
    result: {
      tierId: tier.id,
      label: tier.label,
      payout: tier.payout,
      symbols,
      isWinning: isScratchCardWinningResult(symbols),
      hasPenaltySymbol: false,
      canDiscard: false,
    },
    position: getRandomPlateSpawnPosition(),
    scratchPoints: [],
  } satisfies ScratchCardState;
}

export function settleBasicSafeScratchCard(player: PlayerState, card: ScratchCardState) {
  const payout = card.result.isWinning ? card.result.payout : 0;
  const isNetLoss = payout < card.price;

  return {
    ...player,
    gold: Math.max(0, player.gold + payout),
    lifetimeGoldEarned: player.lifetimeGoldEarned + Math.max(0, payout),
    cardsScratched: player.cardsScratched + 1,
    loseStreak: isNetLoss ? player.loseStreak + 1 : 0,
  } satisfies PlayerState;
}

export function advanceBasicSafeScratchCardProgress(
  progress: ScratchCardProgressState,
): ScratchCardProgressState {
  return {
    ...progress,
    cardsSettled: Math.max(0, Math.floor(progress.cardsSettled)) + 1,
  };
}

export function formatGoldOutcome(amount: number) {
  return amount >= 0 ? `$${amount}` : `-$${Math.abs(amount)}`;
}

export function getOutcomeAmountLabel(revealed: boolean, amount: number) {
  return revealed ? formatGoldOutcome(amount) : '未揭晓';
}

export function getNextLoanTemplate(templateIndex: number) {
  const templates = LOAN_CONFIG.templates;
  const normalizedIndex = Math.abs(Math.floor(templateIndex)) % templates.length;

  return templates[normalizedIndex];
}

export function createLoanFromTemplate(options: CreateLoanFromTemplateOptions) {
  const template = getNextLoanTemplate(options.templateIndex);

  return {
    id: options.id,
    templateId: template.id,
    title: template.title,
    effect: template.effect,
    penalty: template.penalty,
    amount: LOAN_REPAYMENT_AMOUNT,
    signGold: LOAN_PRINCIPAL,
    interestRateLabel: LOAN_CONFIG.interestRateLabel,
  } satisfies LoanState;
}

export function shouldForceWrongScratchCardForLoan(
  activeLoans: readonly Partial<Pick<LoanState, 'penalty'>>[],
  purchaseIndex: number,
) {
  const normalizedPurchaseIndex = Math.max(0, Math.floor(purchaseIndex));

  if (normalizedPurchaseIndex <= 0) {
    return false;
  }

  return activeLoans.some((loan) => {
    const penalty = loan.penalty;

    return (
      penalty?.enabled &&
      penalty.type === 'wrong-card-every-n' &&
      penalty.everyCards > 0 &&
      normalizedPurchaseIndex % penalty.everyCards === 0
    );
  });
}

export function repayLoan(gold: number, loan: Pick<LoanState, 'amount'>) {
  if (gold < loan.amount) {
    return gold;
  }

  return gold - loan.amount;
}

export function getLoanRepaymentFeedback(loan: Partial<Pick<LoanState, 'penalty'>>) {
  const penalty = loan.penalty;

  if (penalty?.enabled && penalty.type === 'wrong-card-every-n') {
    return {
      statusLabel: '错卡惩罚解除',
      detailLabel: `每 ${penalty.everyCards} 张错卡已停止`,
    };
  }

  if (penalty?.enabled && penalty.type === 'scratch-brush-radius-delta') {
    return {
      statusLabel: '刮除范围恢复',
      detailLabel: `刮卡笔刷半径 +${Math.abs(penalty.delta)}`,
    };
  }

  return {
    statusLabel: '债务已偿清',
    detailLabel: '未启用惩罚已移除',
  };
}

export function getUpgradeToolConfig(toolId: UpgradeToolId) {
  return UPGRADE_TOOLS_CONFIG.find((tool) => tool.id === toolId) ?? null;
}

export function createInitialUpgradeToolStates() {
  return Object.fromEntries(
    UPGRADE_TOOLS_CONFIG.map((tool) => [tool.id, { level: tool.level }]),
  ) as Record<UpgradeToolId, UpgradeToolState>;
}

export function canBuyUpgradeTool(
  gold: number,
  tool: Pick<UpgradeToolConfig, 'price' | 'maxLevel'>,
  state: Pick<UpgradeToolState, 'level'>,
) {
  return state.level < tool.maxLevel && gold >= tool.price;
}

export function getScratchBrushRadiusForUpgradeLevel(scratchRadiusLevel: number) {
  const tool = getUpgradeToolConfig('scratch-radius');
  const bonus =
    tool?.effect.type === 'scratch-brush-radius'
      ? Math.max(0, Math.floor(scratchRadiusLevel)) * tool.effect.valuePerLevel
      : 0;

  return BASIC_SAFE_CARD_SCRATCH_BRUSH.radius + bonus;
}

export function getScratchBrushRadius(
  scratchRadiusLevel: number,
  activeLoans: readonly Partial<Pick<LoanState, 'penalty'>>[] = [],
) {
  const loanDelta = activeLoans.reduce((sum, loan) => {
    const penalty = loan.penalty;

    if (!penalty?.enabled || penalty.type !== 'scratch-brush-radius-delta') {
      return sum;
    }

    return sum + penalty.delta;
  }, 0);

  return Math.max(1, getScratchBrushRadiusForUpgradeLevel(scratchRadiusLevel) + loanDelta);
}

export function shouldShowUpgradeToolsUnlockNotice(
  totalProficiency: number,
  upgradeToolsMessageDismissed: boolean,
) {
  return (
    totalProficiency >= getUnlockMilestoneThreshold(UPGRADE_TOOLS_MILESTONE_ID) &&
    !upgradeToolsMessageDismissed
  );
}

export function shouldOfferLoanPhone(options: {
  gold: number;
  plateCount: number;
  activeScratchCard: boolean;
  activeLoansCount: number;
}) {
  return options.gold <= 0 && options.plateCount === 0 && !options.activeScratchCard;
}

export function rollWorkReward(options?: RollWorkRewardOptions): WorkReward {
  const gold = options?.gold ?? 0;
  const workLevel = options?.workLevel ?? 0;
  const random = options?.random ?? Math.random;
  const base =
    workLevel < WORK_BROKEN_PLATE_ENABLED_AT_LEVEL ? 2 : getWorkRewardAmountForLevel(workLevel);
  const brokenPlatePenalty = getWorkBrokenPlatePenaltyForLevel(workLevel);

  if (
    workLevel >= WORK_BROKEN_PLATE_ENABLED_AT_LEVEL &&
    random() >= 1 - WORK_BROKEN_PLATE_CHANCE &&
    gold - brokenPlatePenalty >= scratchLegendConfig.work.brokenPlate.reserveGoldForNextPlate
  ) {
    return {
      base: 0,
      total: -brokenPlatePenalty,
      isCrit: false,
      isBroken: true,
    };
  }

  return {
    base,
    total: base,
    isCrit: false,
    isBroken: false,
  };
}

export function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getWorkLevel(plateCleaned: number) {
  const normalizedPlateCleaned = Math.max(0, plateCleaned);
  let currentLevel = 0;
  let remainingPlates = normalizedPlateCleaned;

  while (currentLevel < WORK_MAX_LEVEL) {
    const requiredPlates = WORK_PLATES_REQUIRED_BY_LEVEL[currentLevel];

    if (!requiredPlates || remainingPlates < requiredPlates) {
      break;
    }

    remainingPlates -= requiredPlates;
    currentLevel += 1;
  }

  return currentLevel;
}

export function getWorkLevelProgress(plateCleaned: number) {
  const currentLevel = getWorkLevel(plateCleaned);

  if (currentLevel >= WORK_MAX_LEVEL) {
    return 1;
  }

  const normalizedPlateCleaned = Math.max(0, plateCleaned);
  const levelStartThreshold = getWorkLevelThreshold(currentLevel);
  const requiredPlates = WORK_PLATES_REQUIRED_BY_LEVEL[currentLevel];

  if (!requiredPlates) {
    return 1;
  }

  return clampRatio((normalizedPlateCleaned - levelStartThreshold) / requiredPlates);
}

export function getRandomPlateSpawnPosition(random = Math.random): PlatePosition {
  return {
    xPercent:
      scratchLegendConfig.work.plate.spawnArea.xPercentMin +
      random() * scratchLegendConfig.work.plate.spawnArea.xPercentRange,
    yPercent:
      scratchLegendConfig.work.plate.spawnArea.yPercentMin +
      random() * scratchLegendConfig.work.plate.spawnArea.yPercentRange,
  };
}

export function isPointInsideCircleBounds(point: DragPoint, bounds: SurfaceBounds) {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return false;
  }

  const radius = Math.min(bounds.width, bounds.height) / 2;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const distance = Math.hypot(point.clientX - centerX, point.clientY - centerY);

  return distance <= radius;
}

export function shouldOpenPlateFromClick(wasDragged: boolean) {
  return !wasDragged;
}

export function shouldHandlePlatePointerDown(phase: WorkPhase) {
  return phase === 'plateSpawned' || phase === 'scratchCardSpawned';
}

export function isBrokenPlateEnabled(workLevel: number) {
  return workLevel >= WORK_BROKEN_PLATE_ENABLED_AT_LEVEL;
}

export function shouldOpenPlateFromPointerUp(wasDragged: boolean, droppedOnTrashCan: boolean) {
  return !wasDragged && !droppedOnTrashCan;
}

export function canBuyTrashCan(
  gold: number,
  trashCanUnlocked: boolean,
  trashCanPurchased: boolean,
) {
  return trashCanUnlocked && !trashCanPurchased && gold >= TRASH_CAN_PRICE;
}

export function shouldUnlockTrashCan(totalProficiency: number, trashCanUnlocked: boolean) {
  return (
    totalProficiency >= getUnlockMilestoneThreshold(TRASH_CAN_MILESTONE_ID) && !trashCanUnlocked
  );
}

export function shouldShowWorkRiskNotice(workLevel: number, riskMessageDismissed: boolean) {
  return (
    workLevel >= scratchLegendConfig.notifications.phone.brokenPlateNoticeLevel &&
    !riskMessageDismissed
  );
}

export function shouldShowScratchUnlockNotice(
  totalGoldEarned: number,
  scratchMessageDismissed: boolean,
) {
  return totalGoldEarned >= BASIC_CARD_UNLOCK_GOLD && !scratchMessageDismissed;
}

export function shouldCloseCleaningOverlay(
  phase: WorkPhase,
  clickedBackdrop: boolean,
  clickedInsidePlate: boolean,
  clickedControl = false,
) {
  if (phase !== 'cleaning' && phase !== 'claimable') {
    return false;
  }

  if (clickedControl || clickedInsidePlate) {
    return false;
  }

  return clickedBackdrop || !clickedInsidePlate;
}

function clampToRange(value: number, min: number, max: number) {
  if (max <= min) {
    return (min + max) / 2;
  }

  return Math.max(min, Math.min(max, value));
}

export function getBoundedPlatePosition(
  point: DragPoint,
  bounds: SurfaceBounds,
  plateSize: number,
): PlatePosition {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      xPercent: 50,
      yPercent: 50,
    };
  }

  const radius = plateSize / 2;
  const maxX = bounds.width - radius;
  const maxY = bounds.height - radius;
  const x = clampToRange(point.clientX - bounds.left, radius, maxX);
  const y = clampToRange(point.clientY - bounds.top, radius, maxY);

  return {
    xPercent: (x / bounds.width) * 100,
    yPercent: (y / bounds.height) * 100,
  };
}
