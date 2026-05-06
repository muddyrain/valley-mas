import { scratchLegendConfig } from './game-config';

export const UNLOCK_MILESTONES = scratchLegendConfig.progression.unlockMilestones;
export const BASIC_CARD_UNLOCK_GOLD = UNLOCK_MILESTONES[0].totalGoldEarned;
export const CLEAN_COMPLETE_THRESHOLD = scratchLegendConfig.work.cleanCompleteThreshold;
export const INITIAL_GOLD = scratchLegendConfig.economy.initialGold;
export const WORK_ACTION_DURATION_MS = scratchLegendConfig.work.actionDurationMs;
export const WORK_BROKEN_PLATE_CHANCE = scratchLegendConfig.work.brokenPlate.chance;
export const WORK_BROKEN_PLATE_ENABLED_AT_LEVEL =
  scratchLegendConfig.work.brokenPlate.enabledAtLevel;
export const WORK_BROKEN_PLATE_PENALTY = scratchLegendConfig.work.brokenPlate.penaltyGold;
export const WORK_SAFE_REWARD_CHANCE = 1 - WORK_BROKEN_PLATE_CHANCE;
export const WORK_MAX_LEVEL = scratchLegendConfig.work.level.maxLevel;
export const WORK_PLATES_REQUIRED_BY_LEVEL = scratchLegendConfig.work.level.platesRequiredByLevel;
export const WORK_PLATE_COST = scratchLegendConfig.work.plateCost;
export const TRASH_CAN_UNLOCK_AFTER_PLATES =
  scratchLegendConfig.unlockables.trashCan.autoUnlockAfterCleanedPlates;
export const WORK_LEVEL_REWARD_TABLE = scratchLegendConfig.work.level.rewardByLevel;

export type WorkPhase = 'idle' | 'plateSpawned' | 'cleaning' | 'claimable';

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

export type WorkPlateState = {
  id: number;
  reward: WorkReward;
  position: PlatePosition;
  seed: number;
};

export type UnlockMilestone = (typeof UNLOCK_MILESTONES)[number];
export type UnlockMilestoneId = UnlockMilestone['id'];

export function getWorkRewardAmountForLevel(workLevel: number) {
  const normalizedLevel = Math.max(0, Math.min(WORK_MAX_LEVEL, Math.floor(workLevel)));
  return WORK_LEVEL_REWARD_TABLE[normalizedLevel];
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

export function getNextUnlockMilestone(totalGoldEarned: number) {
  return UNLOCK_MILESTONES.find((milestone) => totalGoldEarned < milestone.totalGoldEarned) ?? null;
}

export function getUnlockMilestoneProgress(
  totalGoldEarned: number,
  milestone: UnlockMilestone | null,
) {
  if (!milestone) {
    return 1;
  }

  return clampRatio(totalGoldEarned / milestone.totalGoldEarned);
}

export function canAffordWorkPlate(gold: number) {
  return gold >= WORK_PLATE_COST;
}

export function rollWorkReward(options?: RollWorkRewardOptions): WorkReward {
  const gold = options?.gold ?? 0;
  const workLevel = options?.workLevel ?? 0;
  const random = options?.random ?? Math.random;
  const base =
    workLevel < WORK_BROKEN_PLATE_ENABLED_AT_LEVEL ? 2 : getWorkRewardAmountForLevel(workLevel);

  if (
    workLevel >= WORK_BROKEN_PLATE_ENABLED_AT_LEVEL &&
    random() >= 1 - WORK_BROKEN_PLATE_CHANCE &&
    gold - WORK_BROKEN_PLATE_PENALTY >= scratchLegendConfig.work.brokenPlate.reserveGoldForNextPlate
  ) {
    return {
      base: 0,
      total: -WORK_BROKEN_PLATE_PENALTY,
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

export function isBrokenPlateEnabled(workLevel: number) {
  return workLevel >= WORK_BROKEN_PLATE_ENABLED_AT_LEVEL;
}

export function shouldOpenPlateFromPointerUp(wasDragged: boolean, droppedOnTrashCan: boolean) {
  return !wasDragged && !droppedOnTrashCan;
}

export function shouldUnlockTrashCan(plateCleaned: number, trashCanUnlocked: boolean) {
  return plateCleaned >= TRASH_CAN_UNLOCK_AFTER_PLATES && !trashCanUnlocked;
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
