export const BASIC_CARD_COST = 100;
export const CLEAN_COMPLETE_THRESHOLD = 0.95;
export const WORK_ACTION_DURATION_MS = 600;
export const WORK_CRIT_CHANCE = 0.05;
export const WORK_CRIT_MULTIPLIER = 5;

export type WorkPhase = 'idle' | 'plateSpawned' | 'cleaning' | 'claimable';

export type PlayerState = {
  gold: number;
  plateCleaned: number;
  cardsScratched: number;
  loseStreak: number;
  workLevel: number;
};

export type WorkReward = {
  base: number;
  total: number;
  isCrit: boolean;
};

export function rollWorkReward(): WorkReward {
  const base = Math.floor(Math.random() * 3) + 1;
  const isCrit = Math.random() < WORK_CRIT_CHANCE;
  return {
    base,
    total: isCrit ? base * WORK_CRIT_MULTIPLIER : base,
    isCrit,
  };
}

export function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value));
}
