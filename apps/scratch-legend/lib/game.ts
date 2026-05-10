import { scratchLegendConfig } from './game-config';

export const UNLOCK_MILESTONES = scratchLegendConfig.progression.proficiencyMilestones;
export const TRASH_CAN_MILESTONE_ID = 'trash-can' as const;
export const SCRATCH_MODE_MILESTONE_ID = 'scratch-mode' as const;
export const TRIPLE_MATCH_CARD_MILESTONE_ID = 'triple-match-card' as const;
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
export const WORK_CLEAN_BRUSH = scratchLegendConfig.work.cleanBrush;
export const TRASH_CAN_UNLOCK_AFTER_PLATES =
  scratchLegendConfig.unlockables.trashCan.autoUnlockAfterCleanedPlates;
export const TRASH_CAN_PRICE = scratchLegendConfig.unlockables.trashCan.price;
export const WORK_LEVEL_REWARD_TABLE = scratchLegendConfig.work.level.rewardByLevel;
export const BASIC_SAFE_CARD_CONFIG = scratchLegendConfig.scratchCards.basicSafe;
export const BASIC_SAFE_CARD_PRICE = BASIC_SAFE_CARD_CONFIG.price;
export const BASIC_SAFE_CARD_SCRATCH_COMPLETE_THRESHOLD =
  BASIC_SAFE_CARD_CONFIG.scratchCompleteThreshold;
export const BASIC_SAFE_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD =
  BASIC_SAFE_CARD_CONFIG.scratchSymbolRevealThreshold;
export const BASIC_SAFE_CARD_SCRATCH_BRUSH = BASIC_SAFE_CARD_CONFIG.scratchBrush;
export const BASIC_SAFE_CARD_LEVEL_CONFIG = BASIC_SAFE_CARD_CONFIG.level;
export const BASIC_SAFE_CARD_MAX_LEVEL =
  BASIC_SAFE_CARD_LEVEL_CONFIG.payoutMultiplierByLevel.length;
export const TRIPLE_MATCH_CARD_CONFIG = scratchLegendConfig.scratchCards.tripleMatch;
export const TRIPLE_MATCH_CARD_PRICE = TRIPLE_MATCH_CARD_CONFIG.price;
export const TRIPLE_MATCH_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD =
  TRIPLE_MATCH_CARD_CONFIG.scratchSymbolRevealThreshold;
export const RISK_PEEK_CARD_CONFIG = scratchLegendConfig.scratchCards.riskPeek;
export const RISK_PEEK_CARD_PRICE = RISK_PEEK_CARD_CONFIG.price;
export const RISK_PEEK_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD =
  RISK_PEEK_CARD_CONFIG.scratchSymbolRevealThreshold;
export const SCRATCH_CARD_ALBUMS_CONFIG = scratchLegendConfig.cardAlbums;
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
  proficiency: number;
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
  isCleaned: boolean;
  seed: number;
};

export type ScratchCardType = 'basic-safe' | 'triple-match' | 'risk-peek';
export type ScratchCardStatus = 'onTable' | 'scratching' | 'claimable' | 'settled';
type BasicSafeScratchCardPrizeTierConfig = (typeof BASIC_SAFE_CARD_CONFIG.prizePool)[number];
type TripleMatchScratchCardPrizeTierConfig = (typeof TRIPLE_MATCH_CARD_CONFIG.prizePool)[number];
type RiskPeekScratchCardPrizeTierConfig = (typeof RISK_PEEK_CARD_CONFIG.prizePool)[number];
type ScratchCardPrizeTierConfig =
  | BasicSafeScratchCardPrizeTierConfig
  | TripleMatchScratchCardPrizeTierConfig
  | RiskPeekScratchCardPrizeTierConfig;
export type ScratchCardPrizeTier = Omit<ScratchCardPrizeTierConfig, 'payout' | 'probability'> & {
  payout: number;
  probability: number;
};
export type ScratchCardPrizeTierId = ScratchCardPrizeTierConfig['id'];
export type BasicSafeScratchCardPrizeTierId = BasicSafeScratchCardPrizeTierConfig['id'];
export type TripleMatchScratchCardPrizeTierId = TripleMatchScratchCardPrizeTierConfig['id'];
export type RiskPeekScratchCardPrizeTierId = RiskPeekScratchCardPrizeTierConfig['id'];
export type ScratchCardSymbol = 'fire' | 'cash' | 'bag' | 'coin' | 'jackpot' | 'blank' | 'danger';

export type ScratchCardResult = {
  tierId: ScratchCardPrizeTierId;
  label: string;
  payout: number;
  symbols: ScratchCardSymbol[];
  isWinning: boolean;
  hasPenaltySymbol: boolean;
  canDiscard: boolean;
  penaltySlotIndexes: number[];
  penaltyTriggered: boolean;
  discardCost: number;
  penaltyAmount: number;
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

export type ScratchCardAlbumConfig = (typeof SCRATCH_CARD_ALBUMS_CONFIG)[number];
export type ScratchCardAlbumSlotConfig = ScratchCardAlbumConfig['slots'][number];

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

export type GoldEffectSource =
  | 'work-reward'
  | 'scratch-prize'
  | 'loan-sign'
  | 'work-cost'
  | 'scratch-card-purchase'
  | 'upgrade-purchase'
  | 'loan-repayment'
  | 'broken-plate';

export type GoldEffectDirection = 'increase' | 'decrease';
export type GoldEffectIntensity = 'light' | 'normal' | 'strong';

export type GoldChangeEffect = {
  direction: GoldEffectDirection;
  amount: number;
  intensity: GoldEffectIntensity;
  particleCount: number;
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
  luckLevel?: number;
  forcedTierId?: BasicSafeScratchCardPrizeTierId;
  random?: () => number;
  symbolRandom?: () => number;
};

export type CreateTripleMatchScratchCardOptions = {
  id: number;
  level?: number;
  luckLevel?: number;
  forcedTierId?: TripleMatchScratchCardPrizeTierId;
  random?: () => number;
  symbolRandom?: () => number;
};

export type CreateRiskPeekScratchCardOptions = {
  id: number;
  level?: number;
  luckLevel?: number;
  forcedTierId?: RiskPeekScratchCardPrizeTierId;
  random?: () => number;
  symbolRandom?: () => number;
};

export type CreateScratchCardOptions =
  | CreateBasicSafeScratchCardOptions
  | CreateTripleMatchScratchCardOptions
  | CreateRiskPeekScratchCardOptions;

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

export function advanceSegmentedProficiency(currentProficiency: number, earnedAmount: number) {
  const normalizedCurrent = Math.max(0, currentProficiency);
  const earnedProficiency = Math.max(0, earnedAmount);

  if (earnedProficiency <= 0) {
    return normalizedCurrent;
  }

  const nextMilestone = getNextUnlockMilestone(normalizedCurrent);

  if (!nextMilestone) {
    return normalizedCurrent + earnedProficiency;
  }

  const nextThreshold = getUnlockMilestoneThreshold(nextMilestone.id);
  const progressed = normalizedCurrent + earnedProficiency;

  return progressed >= nextThreshold ? nextThreshold : progressed;
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
  player: Pick<PlayerState, 'gold'> &
    Partial<Pick<PlayerState, 'lifetimeGoldEarned' | 'proficiency'>>,
) {
  return canBuyScratchCard('basic-safe', player);
}

export function canBuyScratchCard(
  cardType: ScratchCardType,
  player: Pick<PlayerState, 'gold'> &
    Partial<Pick<PlayerState, 'lifetimeGoldEarned' | 'proficiency'>>,
) {
  const cardConfig = getScratchCardConfig(cardType);
  const unlockThreshold =
    cardType === 'triple-match' || cardType === 'risk-peek'
      ? getUnlockMilestoneThreshold(TRIPLE_MATCH_CARD_MILESTONE_ID)
      : BASIC_CARD_UNLOCK_GOLD;
  const proficiency = player.proficiency ?? player.lifetimeGoldEarned ?? 0;

  return player.gold >= cardConfig.price && proficiency >= unlockThreshold;
}

function getScratchCardLevelRequirements(cardType: ScratchCardType) {
  if (cardType === 'basic-safe') {
    return BASIC_SAFE_CARD_LEVEL_CONFIG.cardsRequiredByLevel;
  }

  if (cardType === 'risk-peek') {
    return RISK_PEEK_CARD_CONFIG.level.cardsRequiredByLevel;
  }

  return TRIPLE_MATCH_CARD_CONFIG.level.cardsRequiredByLevel;
}

export function getScratchCardMaxLevel(cardType: ScratchCardType) {
  if (cardType === 'basic-safe') {
    return BASIC_SAFE_CARD_MAX_LEVEL;
  }

  if (cardType === 'risk-peek') {
    return RISK_PEEK_CARD_CONFIG.level.payoutMultiplierByLevel.length;
  }

  return TRIPLE_MATCH_CARD_CONFIG.level.payoutMultiplierByLevel.length;
}

export function getScratchCardLevelThreshold(cardType: ScratchCardType, level: number) {
  if (level <= 0) {
    return 0;
  }

  const requirements = getScratchCardLevelRequirements(cardType);
  const maxLevel = getScratchCardMaxLevel(cardType);
  const normalizedLevel = Math.min(maxLevel - 1, Math.max(0, Math.floor(level)));
  let total = 0;

  for (let currentLevel = 0; currentLevel < normalizedLevel; currentLevel += 1) {
    total += requirements[currentLevel] ?? 0;
  }

  return total;
}

export function getScratchCardLevel(cardType: ScratchCardType, cardsSettled: number) {
  const requirements = getScratchCardLevelRequirements(cardType);
  const maxLevel = getScratchCardMaxLevel(cardType);
  let level = 0;
  let remainingCards = Math.max(0, Math.floor(cardsSettled));

  while (level < maxLevel - 1) {
    const requiredCards = requirements[level];

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

  if (level >= maxLevel - 1) {
    return {
      level,
      current: 0,
      target: 0,
      ratio: 1,
      cardsSettled: normalizedCardsSettled,
    };
  }

  const levelStartThreshold = getScratchCardLevelThreshold(cardType, level);
  const target = getScratchCardLevelRequirements(cardType)[level] ?? 0;
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
  return Math.max(0, Math.min(BASIC_SAFE_CARD_MAX_LEVEL - 1, Math.floor(level)));
}

function getBasicSafeScratchCardPayoutMultiplier(level: number) {
  const normalizedLevel = normalizeScratchCardLevel(level);

  return BASIC_SAFE_CARD_LEVEL_CONFIG.payoutMultiplierByLevel[normalizedLevel] ?? 1;
}

export function getBasicSafeScratchCardPrizePoolForLevel(level: number): ScratchCardPrizeTier[] {
  const payoutMultiplier = getBasicSafeScratchCardPayoutMultiplier(level);

  return BASIC_SAFE_CARD_CONFIG.prizePool.map((tier) => ({
    ...tier,
    payout: Math.floor(tier.payout * payoutMultiplier),
  }));
}

export function getScratchCardConfig(cardType: ScratchCardType) {
  if (cardType === 'triple-match') {
    return TRIPLE_MATCH_CARD_CONFIG;
  }

  if (cardType === 'risk-peek') {
    return RISK_PEEK_CARD_CONFIG;
  }

  return BASIC_SAFE_CARD_CONFIG;
}

export function getScratchCardPrizePoolForLevel(
  cardType: ScratchCardType,
  level: number,
): ScratchCardPrizeTier[] {
  if (cardType === 'basic-safe') {
    return getBasicSafeScratchCardPrizePoolForLevel(level);
  }

  const config = getScratchCardConfig(cardType);

  return config.prizePool.map((tier) => ({
    ...tier,
    payout: tier.payout,
  }));
}

export function getLuckAdjustedScratchCardPrizePool(
  cardType: ScratchCardType,
  level: number,
  luckLevel = 0,
): ScratchCardPrizeTier[] {
  const prizePool = getScratchCardPrizePoolForLevel(cardType, level);
  const normalizedLuckLevel = Math.max(0, Math.floor(luckLevel));
  const luckTool = getUpgradeToolConfig('scratch-luck');

  if (
    normalizedLuckLevel <= 0 ||
    cardType === 'risk-peek' ||
    luckTool?.effect.type !== 'scratch-luck'
  ) {
    return prizePool;
  }

  const losingTiers = prizePool.filter((tier) => tier.payout <= 0);
  const winningTiers = prizePool.filter((tier) => tier.payout > 0);
  const losingProbability = losingTiers.reduce((sum, tier) => sum + tier.probability, 0);
  const winningProbability = winningTiers.reduce((sum, tier) => sum + tier.probability, 0);

  if (losingProbability <= 0 || winningProbability <= 0) {
    return prizePool;
  }

  const maxShift = Math.max(0, losingProbability - luckTool.effect.losingProbabilityFloor);
  const shiftedProbability = Math.min(
    maxShift,
    normalizedLuckLevel * luckTool.effect.valuePerLevel,
  );

  if (shiftedProbability <= 0) {
    return prizePool;
  }

  return prizePool.map((tier) => {
    if (tier.payout <= 0) {
      const share = tier.probability / losingProbability;

      return {
        ...tier,
        probability: Math.max(0, tier.probability - shiftedProbability * share),
      };
    }

    const share = tier.probability / winningProbability;

    return {
      ...tier,
      probability: tier.probability + shiftedProbability * share,
    };
  });
}

export function getScratchLuckEffectPercent(luckLevel: number) {
  const normalizedLuckLevel = Math.max(0, Math.floor(luckLevel));
  const luckTool = getUpgradeToolConfig('scratch-luck');

  if (normalizedLuckLevel <= 0 || luckTool?.effect.type !== 'scratch-luck') {
    return 0;
  }

  return Math.round(normalizedLuckLevel * luckTool.effect.valuePerLevel * 100);
}

export function getScratchLuckEffectLabel(luckLevel: number) {
  const effectPercent = getScratchLuckEffectPercent(luckLevel);

  if (effectPercent <= 0) {
    return '当前幸运：未生效';
  }

  return `当前幸运：未中奖权重 -${effectPercent}%`;
}

export function getScratchCardStepDistance(cardType: ScratchCardType) {
  return getScratchCardConfig(cardType).scratchBrush.stepDistance;
}

export function getScratchCardSettlementProgressKey(cardType: ScratchCardType) {
  if (cardType === 'triple-match') {
    return 'tripleMatch';
  }

  if (cardType === 'risk-peek') {
    return 'riskPeek';
  }

  return 'basicSafe';
}

export function getScratchCardAlbumSlotByType(cardType: ScratchCardType) {
  for (const album of SCRATCH_CARD_ALBUMS_CONFIG) {
    for (const slot of album.slots) {
      if (slot.cardType === cardType) {
        return slot;
      }
    }
  }

  return null;
}

export function getBasicSafeScratchCardPrizeTier(
  random: () => number = Math.random,
  level = 0,
  luckLevel = 0,
) {
  const roll = clampRatio(random());
  let cumulativeProbability = 0;
  const prizePool = getLuckAdjustedScratchCardPrizePool('basic-safe', level, luckLevel);

  for (const tier of prizePool) {
    cumulativeProbability += tier.probability;

    if (roll < cumulativeProbability - Number.EPSILON) {
      return tier;
    }
  }

  return prizePool[prizePool.length - 1];
}

function getBasicSafeScratchCardPrizeTierById(
  level: number,
  tierId: BasicSafeScratchCardPrizeTierId,
) {
  return (
    (getBasicSafeScratchCardPrizePoolForLevel(level).find((tier) => tier.id === tierId) as
      | ScratchCardPrizeTier
      | undefined) ?? getBasicSafeScratchCardPrizeTier(Math.random, level)
  );
}

function getScratchCardMatchCount(symbols: readonly ScratchCardSymbol[]) {
  const counts = new Map<ScratchCardSymbol, number>();

  for (const symbol of symbols) {
    if (symbol === 'blank') {
      continue;
    }

    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }

  return Math.max(0, ...counts.values());
}

export function isScratchCardWinningResult(
  symbols: readonly ScratchCardSymbol[],
  requiredMatches: number = BASIC_SAFE_CARD_CONFIG.matchRule.requiredMatches,
) {
  return getScratchCardMatchCount(symbols) >= requiredMatches;
}

export function getWinningScratchSymbolIndexes(
  symbols: readonly ScratchCardSymbol[],
  requiredMatches: number,
) {
  const indexesBySymbol = new Map<ScratchCardSymbol, number[]>();

  for (const [index, symbol] of symbols.entries()) {
    if (symbol === 'blank') {
      continue;
    }

    indexesBySymbol.set(symbol, [...(indexesBySymbol.get(symbol) ?? []), index]);
  }

  for (const indexes of indexesBySymbol.values()) {
    if (indexes.length >= requiredMatches) {
      return indexes.slice(0, requiredMatches);
    }
  }

  return [];
}

export function getScratchCardRevealSlotIndex(
  cardType: ScratchCardType,
  point: ScratchSurfacePoint,
) {
  if (point.xPercent < 0 || point.xPercent > 1 || point.yPercent < 0 || point.yPercent > 1) {
    return null;
  }

  if (cardType === 'basic-safe') {
    return Math.min(2, Math.floor(point.xPercent * 3));
  }

  if (cardType === 'risk-peek') {
    const riskPeekSlots = [
      { x: 45 / 230, y: 32 / 134 },
      { x: 115 / 230, y: 32 / 134 },
      { x: 185 / 230, y: 32 / 134 },
      { x: 45 / 230, y: 102 / 134 },
      { x: 115 / 230, y: 102 / 134 },
      { x: 185 / 230, y: 102 / 134 },
    ] as const;
    const revealRadius = 0.15;

    for (const [index, slot] of riskPeekSlots.entries()) {
      if (Math.hypot(point.xPercent - slot.x, point.yPercent - slot.y) <= revealRadius) {
        return index;
      }
    }

    return null;
  }

  const tripleMatchSlots = [
    { x: 45 / 230, y: 32 / 128 },
    { x: 115 / 230, y: 32 / 128 },
    { x: 185 / 230, y: 32 / 128 },
    { x: 75 / 230, y: 96 / 128 },
    { x: 145 / 230, y: 96 / 128 },
  ] as const;
  const revealRadius = 0.17;

  for (const [index, slot] of tripleMatchSlots.entries()) {
    if (Math.hypot(point.xPercent - slot.x, point.yPercent - slot.y) <= revealRadius) {
      return index;
    }
  }

  return null;
}

export function getScratchCardSlotIndexes(cardType: ScratchCardType) {
  return Array.from(
    { length: Number(getScratchCardConfig(cardType).matchRule.slots) },
    (_, slotIndex) => slotIndex,
  );
}

export function getScratchCardRevealThreshold(cardType: ScratchCardType) {
  if (cardType === 'triple-match') {
    return TRIPLE_MATCH_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD;
  }

  if (cardType === 'risk-peek') {
    return RISK_PEEK_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD;
  }

  return BASIC_SAFE_CARD_SCRATCH_SYMBOL_REVEAL_THRESHOLD;
}

export function getScratchCardRevealRatio(coveredRatio: number) {
  return clampRatio(1 - coveredRatio);
}

export function shouldRevealScratchSlot(revealRatio: number, cardType: ScratchCardType) {
  return revealRatio >= getScratchCardRevealThreshold(cardType);
}

export function getScratchCardSettlementHighlightDelayMs(options: {
  cardType: ScratchCardType;
  revealedSlotIndexes: readonly number[];
  revealFlashDurationMs: number;
  settleDelayMs: number;
}) {
  const slotCount = Number(getScratchCardConfig(options.cardType).matchRule.slots);
  const revealedSlots = new Set(
    options.revealedSlotIndexes.filter(
      (slotIndex) => Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < slotCount,
    ),
  );

  if (revealedSlots.size < slotCount) {
    return null;
  }

  return Math.max(0, options.revealFlashDurationMs) + Math.max(0, options.settleDelayMs);
}

export function getGoldChangeEffect(
  previousGold: number,
  nextGold: number,
  source: GoldEffectSource,
): GoldChangeEffect | null {
  const amount = Math.abs(nextGold - previousGold);

  if (amount <= 0) {
    return null;
  }

  const direction: GoldEffectDirection = nextGold > previousGold ? 'increase' : 'decrease';
  const strongSources = new Set<GoldEffectSource>([
    'scratch-prize',
    'loan-repayment',
    'broken-plate',
  ]);
  const lightSources = new Set<GoldEffectSource>([
    'loan-sign',
    'work-cost',
    'scratch-card-purchase',
    'upgrade-purchase',
  ]);
  const intensity: GoldEffectIntensity = strongSources.has(source)
    ? 'strong'
    : lightSources.has(source)
      ? 'light'
      : 'normal';
  const particleCount = direction === 'increase' && intensity === 'strong' ? 8 : 0;

  return {
    direction,
    amount,
    intensity,
    particleCount,
  };
}

export function getGoldDisplayRollValue(fromGold: number, toGold: number, progress: number) {
  const normalizedFromGold = Math.max(0, Math.floor(fromGold));
  const normalizedToGold = Math.max(0, Math.floor(toGold));

  if (normalizedToGold <= normalizedFromGold) {
    return normalizedToGold;
  }

  return Math.min(
    normalizedToGold,
    Math.round(normalizedFromGold + (normalizedToGold - normalizedFromGold) * clampRatio(progress)),
  );
}

export function shouldRevealFullScratchCover(
  scratchedRatio: number,
  cardType: ScratchCardType = 'basic-safe',
) {
  return scratchedRatio >= getScratchCardConfig(cardType).scratchCompleteThreshold;
}

export function shouldShowScratchCover(
  status: ScratchCardStatus,
  scratchProgress: number,
  cardType: ScratchCardType = 'basic-safe',
) {
  return status === 'scratching' && !shouldRevealFullScratchCover(scratchProgress, cardType);
}

const BASIC_SAFE_RESULT_SYMBOLS = [
  'fire',
  'cash',
  'bag',
] as const satisfies readonly ScratchCardSymbol[];
const TRIPLE_MATCH_RESULT_SYMBOLS = [
  'coin',
  'bag',
  'cash',
  'jackpot',
] as const satisfies readonly ScratchCardSymbol[];

function getRandomArrayIndex(length: number, random: () => number) {
  return Math.min(length - 1, Math.floor(clampRatio(random()) * length));
}

function shuffleScratchCardSymbols(
  symbols: readonly ScratchCardSymbol[],
  random: () => number,
): ScratchCardSymbol[] {
  const shuffled = [...symbols];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomArrayIndex(index + 1, random);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getPairSymbolForPrizeTier(tierId: BasicSafeScratchCardPrizeTierId) {
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
  tierId: BasicSafeScratchCardPrizeTierId,
  random: () => number,
): ScratchCardSymbol[] {
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

function getTripleMatchSymbolForPrizeTier(tierId: TripleMatchScratchCardPrizeTierId) {
  switch (tierId) {
    case 'triple-coin':
      return 'coin';
    case 'triple-bag':
      return 'bag';
    case 'triple-cash':
      return 'cash';
    case 'triple-jackpot':
      return 'jackpot';
    default:
      return null;
  }
}

function createTripleMatchLossSymbols(random: () => number) {
  const symbols: ScratchCardSymbol[] = ['coin', 'coin', 'bag', 'bag', 'cash'];
  return shuffleScratchCardSymbols(symbols, random);
}

function createTripleMatchSymbolsForPrizeTier(
  tierId: TripleMatchScratchCardPrizeTierId,
  random: () => number,
) {
  const tripleSymbol = getTripleMatchSymbolForPrizeTier(tierId);

  if (!tripleSymbol) {
    return createTripleMatchLossSymbols(random);
  }

  const decoySymbols = TRIPLE_MATCH_RESULT_SYMBOLS.filter((symbol) => symbol !== tripleSymbol);
  const firstDecoy = decoySymbols[getRandomArrayIndex(decoySymbols.length, random)];
  const remainingDecoys = decoySymbols.filter((symbol) => symbol !== firstDecoy);
  const secondDecoy = remainingDecoys[getRandomArrayIndex(remainingDecoys.length, random)];

  return shuffleScratchCardSymbols(
    [tripleSymbol, tripleSymbol, tripleSymbol, firstDecoy, secondDecoy],
    random,
  );
}

function getRiskPeekScratchCardPrizePoolForLevel(_level: number): ScratchCardPrizeTier[] {
  return getScratchCardPrizePoolForLevel('risk-peek', 0);
}

function getRiskPeekScratchCardPrizeTier(random: () => number = Math.random, level = 0) {
  const roll = clampRatio(random());
  let cumulativeProbability = 0;
  const prizePool = getRiskPeekScratchCardPrizePoolForLevel(level);

  for (const tier of prizePool) {
    cumulativeProbability += tier.probability;

    if (roll < cumulativeProbability - Number.EPSILON) {
      return tier;
    }
  }

  return prizePool[prizePool.length - 1];
}

function getRiskPeekScratchCardPrizeTierById(
  level: number,
  tierId: RiskPeekScratchCardPrizeTierId,
) {
  return (
    getRiskPeekScratchCardPrizePoolForLevel(level).find((tier) => tier.id === tierId) ??
    getRiskPeekScratchCardPrizeTier(Math.random, level)
  );
}

function getRiskPeekPrimarySymbolForPrizeTier(tierId: RiskPeekScratchCardPrizeTierId) {
  switch (tierId) {
    case 'risk-coin':
      return 'coin';
    case 'risk-bag':
      return 'bag';
    case 'risk-cash':
      return 'cash';
    default:
      return null;
  }
}

function createRiskPeekSymbolsForPrizeTier(
  tierId: RiskPeekScratchCardPrizeTierId,
  random: () => number,
) {
  const primarySymbol = getRiskPeekPrimarySymbolForPrizeTier(tierId);
  const baseSymbols: ScratchCardSymbol[] = ['blank', 'blank', 'blank', 'blank', 'blank', 'blank'];

  if (primarySymbol) {
    baseSymbols[0] = primarySymbol;
  }

  const symbols = shuffleScratchCardSymbols(
    baseSymbols.slice(0, Number(RISK_PEEK_CARD_CONFIG.matchRule.slots)),
    random,
  );

  if (primarySymbol) {
    return {
      symbols,
      penaltySlotIndexes: [],
    };
  }

  const dangerSlotIndex = getRandomArrayIndex(
    Number(RISK_PEEK_CARD_CONFIG.matchRule.slots),
    random,
  );
  symbols[dangerSlotIndex] = 'danger';

  return {
    symbols,
    penaltySlotIndexes: [dangerSlotIndex],
  };
}

export function createBasicSafeScratchCard(options: CreateBasicSafeScratchCardOptions) {
  const level = normalizeScratchCardLevel(options.level ?? 0);
  const tier = options.forcedTierId
    ? getBasicSafeScratchCardPrizeTierById(level, options.forcedTierId)
    : getBasicSafeScratchCardPrizeTier(options.random, level, options.luckLevel);
  const symbols = createSymbolsForPrizeTier(
    tier.id as BasicSafeScratchCardPrizeTierId,
    options.symbolRandom ?? Math.random,
  );

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
      penaltySlotIndexes: [],
      penaltyTriggered: false,
      discardCost: 0,
      penaltyAmount: 0,
    },
    position: getRandomPlateSpawnPosition(),
    scratchPoints: [],
  } satisfies ScratchCardState;
}

function getTripleMatchScratchCardPrizePoolForLevel(_level: number): ScratchCardPrizeTier[] {
  return getScratchCardPrizePoolForLevel('triple-match', 0);
}

function getTripleMatchScratchCardPrizeTier(
  random: () => number = Math.random,
  level = 0,
  luckLevel = 0,
) {
  const roll = clampRatio(random());
  let cumulativeProbability = 0;
  const prizePool = getLuckAdjustedScratchCardPrizePool('triple-match', level, luckLevel);

  for (const tier of prizePool) {
    cumulativeProbability += tier.probability;

    if (roll < cumulativeProbability - Number.EPSILON) {
      return tier;
    }
  }

  return prizePool[prizePool.length - 1];
}

function getTripleMatchScratchCardPrizeTierById(
  level: number,
  tierId: TripleMatchScratchCardPrizeTierId,
) {
  return (
    getTripleMatchScratchCardPrizePoolForLevel(level).find((tier) => tier.id === tierId) ??
    getTripleMatchScratchCardPrizeTier(Math.random, level)
  );
}

export function createTripleMatchScratchCard(options: CreateTripleMatchScratchCardOptions) {
  const level = Math.max(
    0,
    Math.min(TRIPLE_MATCH_CARD_CONFIG.level.payoutMultiplierByLevel.length - 1, options.level ?? 0),
  );
  const tier = options.forcedTierId
    ? getTripleMatchScratchCardPrizeTierById(level, options.forcedTierId)
    : getTripleMatchScratchCardPrizeTier(options.random, level, options.luckLevel);
  const symbols = createTripleMatchSymbolsForPrizeTier(
    tier.id as TripleMatchScratchCardPrizeTierId,
    options.symbolRandom ?? Math.random,
  );

  return {
    id: options.id,
    type: TRIPLE_MATCH_CARD_CONFIG.id,
    price: TRIPLE_MATCH_CARD_PRICE,
    level,
    status: 'onTable',
    result: {
      tierId: tier.id,
      label: tier.label,
      payout: tier.payout,
      symbols,
      isWinning: isScratchCardWinningResult(
        symbols,
        Number(TRIPLE_MATCH_CARD_CONFIG.matchRule.requiredMatches),
      ),
      hasPenaltySymbol: false,
      canDiscard: false,
      penaltySlotIndexes: [],
      penaltyTriggered: false,
      discardCost: 0,
      penaltyAmount: 0,
    },
    position: getRandomPlateSpawnPosition(),
    scratchPoints: [],
  } satisfies ScratchCardState;
}

export function createRiskPeekScratchCard(options: CreateRiskPeekScratchCardOptions) {
  const level = Math.max(
    0,
    Math.min(RISK_PEEK_CARD_CONFIG.level.payoutMultiplierByLevel.length - 1, options.level ?? 0),
  );
  const tier = options.forcedTierId
    ? getRiskPeekScratchCardPrizeTierById(level, options.forcedTierId)
    : getRiskPeekScratchCardPrizeTier(options.random, level);
  const { symbols, penaltySlotIndexes } = createRiskPeekSymbolsForPrizeTier(
    tier.id as RiskPeekScratchCardPrizeTierId,
    options.symbolRandom ?? Math.random,
  );
  const hasPenaltySymbol = penaltySlotIndexes.length > 0;

  return {
    id: options.id,
    type: RISK_PEEK_CARD_CONFIG.id,
    price: RISK_PEEK_CARD_PRICE,
    level,
    status: 'onTable',
    result: {
      tierId: tier.id,
      label: tier.label,
      payout: tier.payout,
      symbols,
      isWinning: tier.payout > 0 && !hasPenaltySymbol,
      hasPenaltySymbol,
      canDiscard: true,
      penaltySlotIndexes,
      penaltyTriggered: false,
      discardCost: getScratchCardDiscardCost(RISK_PEEK_CARD_CONFIG.price),
      penaltyAmount: RISK_PEEK_CARD_CONFIG.riskRule.penaltyAmount,
    },
    position: getRandomPlateSpawnPosition(),
    scratchPoints: [],
  } satisfies ScratchCardState;
}

export function createScratchCard(cardType: ScratchCardType, options: CreateScratchCardOptions) {
  if (cardType === 'triple-match') {
    return createTripleMatchScratchCard(options as CreateTripleMatchScratchCardOptions);
  }

  if (cardType === 'risk-peek') {
    return createRiskPeekScratchCard(options as CreateRiskPeekScratchCardOptions);
  }

  return createBasicSafeScratchCard(options as CreateBasicSafeScratchCardOptions);
}

export function getScratchCardDiscardCost(cardPrice: number) {
  return Math.ceil(cardPrice * RISK_PEEK_CARD_CONFIG.riskRule.discardCostRatio);
}

export function getEffectiveScratchCardDiscardCost(gold: number, card: ScratchCardState) {
  if (!card.result.canDiscard || card.status !== 'scratching' || card.result.penaltyTriggered) {
    return 0;
  }

  const reserveGold = RISK_PEEK_CARD_CONFIG.riskRule.reserveGoldAfterDiscard;
  const spendableGold = Math.max(0, Math.floor(gold) - reserveGold);

  return Math.max(0, Math.min(card.result.discardCost, spendableGold));
}

export function shouldTriggerScratchCardPenalty(card: ScratchCardState, slotIndex: number) {
  return card.result.penaltySlotIndexes.includes(slotIndex);
}

export function markScratchCardPenaltyTriggered(card: ScratchCardState) {
  if (!card.result.hasPenaltySymbol || card.result.penaltyTriggered) {
    return card;
  }

  return {
    ...card,
    result: {
      ...card.result,
      isWinning: false,
      penaltyTriggered: true,
      canDiscard: false,
    },
  } satisfies ScratchCardState;
}

export function settleScratchCard(player: PlayerState, card: ScratchCardState) {
  const penaltyAmount = card.result.penaltyTriggered ? card.result.penaltyAmount : 0;
  const payout = card.result.isWinning && !card.result.penaltyTriggered ? card.result.payout : 0;
  const isNetLoss = payout < card.price;

  return {
    ...player,
    gold: Math.max(0, player.gold + payout - penaltyAmount),
    lifetimeGoldEarned: player.lifetimeGoldEarned + Math.max(0, payout),
    proficiency: advanceSegmentedProficiency(player.proficiency, payout),
    cardsScratched: player.cardsScratched + 1,
    loseStreak: isNetLoss ? player.loseStreak + 1 : 0,
  } satisfies PlayerState;
}

export function settleBasicSafeScratchCard(player: PlayerState, card: ScratchCardState) {
  return settleScratchCard(player, card);
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

export function getUpgradeToolPrice(
  tool: Pick<UpgradeToolConfig, 'price'> &
    Partial<Pick<UpgradeToolConfig, 'priceMultiplierByLevel'>>,
  level: number,
) {
  const normalizedLevel = Math.max(0, Math.floor(level));
  const multipliers = tool.priceMultiplierByLevel ?? [1];
  const multiplier = multipliers[normalizedLevel] ?? multipliers[multipliers.length - 1] ?? 1;

  return Math.floor(tool.price * multiplier);
}

export function canBuyUpgradeTool(
  gold: number,
  tool: Pick<UpgradeToolConfig, 'price' | 'maxLevel'> &
    Partial<Pick<UpgradeToolConfig, 'priceMultiplierByLevel'>>,
  state: Pick<UpgradeToolState, 'level'>,
) {
  return state.level < tool.maxLevel && gold >= getUpgradeToolPrice(tool, state.level);
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

export function getCleaningBrushRadius(
  scratchRadiusLevel: number,
  activeLoans: readonly Partial<Pick<LoanState, 'penalty'>>[] = [],
) {
  const scratchRadiusBonus =
    getScratchBrushRadiusForUpgradeLevel(scratchRadiusLevel) - BASIC_SAFE_CARD_SCRATCH_BRUSH.radius;
  const loanDelta = activeLoans.reduce((sum, loan) => {
    const penalty = loan.penalty;

    if (!penalty?.enabled || penalty.type !== 'scratch-brush-radius-delta') {
      return sum;
    }

    return sum + penalty.delta;
  }, 0);

  return Math.max(1, WORK_CLEAN_BRUSH.radius + scratchRadiusBonus + loanDelta);
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

export function shouldShowTripleMatchUnlockNotice(
  totalProficiency: number,
  tripleMatchMessageDismissed: boolean,
) {
  return (
    totalProficiency >= getUnlockMilestoneThreshold(TRIPLE_MATCH_CARD_MILESTONE_ID) &&
    !tripleMatchMessageDismissed
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

export function shouldShowWorkRiskNotice(
  riskNoticeTriggered: boolean,
  riskMessageDismissed: boolean,
) {
  return riskNoticeTriggered && !riskMessageDismissed;
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
  return getBoundedDesktopPosition(point, bounds, plateSize, plateSize);
}

export function getBoundedDesktopPosition(
  point: DragPoint,
  bounds: SurfaceBounds,
  itemWidth: number,
  itemHeight: number,
): PlatePosition {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      xPercent: 50,
      yPercent: 50,
    };
  }

  const horizontalRadius = itemWidth / 2;
  const verticalRadius = itemHeight / 2;
  const maxX = bounds.width - horizontalRadius;
  const maxY = bounds.height - verticalRadius;
  const x = clampToRange(point.clientX - bounds.left, horizontalRadius, maxX);
  const y = clampToRange(point.clientY - bounds.top, verticalRadius, maxY);

  return {
    xPercent: (x / bounds.width) * 100,
    yPercent: (y / bounds.height) * 100,
  };
}
