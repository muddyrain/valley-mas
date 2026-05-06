export const scratchLegendConfig = {
  economy: {
    initialGold: 1,
  },
  progression: {
    unlockMilestones: [
      {
        id: 'scratch-mode',
        label: '刮刮乐模式',
        totalGoldEarned: 10,
        description: '累计赚到 10 金币后解锁刮刮乐模式提示。',
      },
      {
        id: 'next-feature',
        label: '后续功能',
        totalGoldEarned: 50,
        description: '累计赚到 50 金币后预留下一阶段功能解锁位。',
      },
    ] as const,
  },
  work: {
    plateCost: 1,
    actionDurationMs: 600,
    cleanCompleteThreshold: 0.95,
    plate: {
      desktopSize: 94,
      enterAnimationMs: 420,
      spawnArea: {
        xPercentMin: 22,
        xPercentRange: 56,
        yPercentMin: 24,
        yPercentRange: 50,
      },
    },
    drag: {
      holdMs: 140,
      moveThreshold: 6,
    },
    level: {
      maxLevel: 10,
      platesPerLevel: 10,
      rewardByLevel: [2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const,
    },
    brokenPlate: {
      enabledAtLevel: 1,
      chance: 0.1,
      penaltyGold: 3,
      reserveGoldForNextPlate: 1,
    },
  },
  unlockables: {
    trashCan: {
      autoUnlockAfterCleanedPlates: 3,
    },
  },
  notifications: {
    phone: {
      brokenPlateNoticeLevel: 1,
    },
  },
} as const;

export type ScratchLegendConfig = typeof scratchLegendConfig;
