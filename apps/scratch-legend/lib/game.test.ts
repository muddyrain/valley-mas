import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTO_SCRATCH_MACHINE_CONFIG,
  advanceBasicSafeScratchCardProgress,
  advanceSegmentedProficiency,
  BASIC_CARD_UNLOCK_GOLD,
  BASIC_SAFE_CARD_PRICE,
  canAffordWorkPlate,
  canBuyAutoScratchMachine,
  canBuyBasicSafeScratchCard,
  canBuyScratchCard,
  canBuyTrashCan,
  canStartWorkFromPhase,
  createBasicSafeScratchCard,
  createLoanFromTemplate,
  createRiskPeekScratchCard,
  createScratchCard,
  createTripleMatchScratchCard,
  getAutoScratchMachineUnlockProgress,
  getBasicSafeScratchCardPrizePoolForLevel,
  getBasicSafeScratchCardPrizeTier,
  getBoundedDesktopPosition,
  getBoundedPlatePosition,
  getCleaningBrushRadius,
  getEffectiveScratchCardDiscardCost,
  getGoldChangeEffect,
  getGoldDisplayRollValue,
  getLoanRepaymentFeedback,
  getLuckAdjustedScratchCardPrizePool,
  getNextLoanTemplate,
  getNextUnlockMilestone,
  getOutcomeAmountLabel,
  getRandomPlateSpawnPosition,
  getScratchBrushRadius,
  getScratchBrushRadiusForUpgradeLevel,
  getScratchCardAlbumSlotByType,
  getScratchCardConfig,
  getScratchCardDiscardCost,
  getScratchCardLevelProgress,
  getScratchCardPrizePoolForLevel,
  getScratchCardRevealRatio,
  getScratchCardRevealSlotIndex,
  getScratchCardRevealThreshold,
  getScratchCardSettlementHighlightDelayMs,
  getScratchCardSettlementProgressKey,
  getScratchCardSlotIndexes,
  getScratchCardStepDistance,
  getScratchLuckEffectLabel,
  getScratchLuckEffectPercent,
  getStageGoalProgress,
  getUnlockMilestoneById,
  getUnlockMilestoneCurrentValue,
  getUnlockMilestoneProgress,
  getUnlockMilestoneThreshold,
  getUpgradeToolPrice,
  getWinningScratchSymbolIndexes,
  getWorkLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  INITIAL_GOLD,
  isPointInsideCircleBounds,
  isScratchCardWinningResult,
  LOAN_PRINCIPAL,
  LOAN_REPAYMENT_AMOUNT,
  markScratchCardPenaltyTriggered,
  RISK_PEEK_CARD_PRICE,
  repayLoan,
  rollWorkReward,
  SCRATCH_CARD_ALBUMS_CONFIG,
  settleBasicSafeScratchCard,
  settleScratchCard,
  shouldCloseCleaningOverlay,
  shouldForceWrongScratchCardForLoan,
  shouldHandlePlatePointerDown,
  shouldOfferLoanPhone,
  shouldOpenPlateFromClick,
  shouldOpenPlateFromPointerUp,
  shouldRevealFullScratchCover,
  shouldRevealScratchSlot,
  shouldShowScratchCover,
  shouldShowScratchUnlockNotice,
  shouldShowTripleMatchUnlockNotice,
  shouldShowWorkRiskNotice,
  shouldTriggerScratchCardPenalty,
  shouldUnlockTrashCan,
  TRASH_CAN_PRICE,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  TRIPLE_MATCH_CARD_PRICE,
  WORK_PLATE_COST,
} from './game';
import { scratchLegendConfig } from './game-config';
import {
  advanceAutoScratchMachineSave,
  createInitialScratchLegendSave,
  getActiveScratchCard,
  getActiveWorkPlate,
  getAutoScratchMachineBlockReason,
  isUnlockMilestoneUnlocked,
  mergeScratchLegendSave,
  syncScratchLegendSave,
  takeOverAutoScratchMachineCard,
} from './game-save';

function assertNearlyEqual(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should be close to ${expected}`);
}

test('keeps dragged plate center inside the table bounds', () => {
  const position = getBoundedPlatePosition(
    { clientX: 4, clientY: 580 },
    { left: 0, top: 100, width: 800, height: 500 },
    94,
  );

  assertNearlyEqual(position.xPercent, 5.875);
  assertNearlyEqual(position.yPercent, 90.6);
});

test('keeps dragged plate centered when table is smaller than the plate', () => {
  const position = getBoundedPlatePosition(
    { clientX: 0, clientY: 0 },
    { left: 0, top: 0, width: 60, height: 40 },
    94,
  );

  assert.equal(position.xPercent, 50);
  assert.equal(position.yPercent, 50);
});

test('keeps dragged rectangular table objects inside the full desktop bounds', () => {
  const position = getBoundedDesktopPosition(
    { clientX: 799, clientY: 580 },
    { left: 0, top: 100, width: 800, height: 500 },
    108,
    76,
  );

  assertNearlyEqual(position.xPercent, 93.25);
  assertNearlyEqual(position.yPercent, 92.4);
});

test('classifies gold change effects by direction and source intensity', () => {
  assert.deepEqual(getGoldChangeEffect(10, 25, 'scratch-prize'), {
    direction: 'increase',
    amount: 15,
    intensity: 'strong',
    particleCount: 8,
  });

  assert.deepEqual(getGoldChangeEffect(25, 15, 'scratch-card-purchase'), {
    direction: 'decrease',
    amount: 10,
    intensity: 'light',
    particleCount: 0,
  });

  assert.deepEqual(getGoldChangeEffect(25, 0, 'broken-plate'), {
    direction: 'decrease',
    amount: 25,
    intensity: 'strong',
    particleCount: 0,
  });

  assert.equal(getGoldChangeEffect(10, 10, 'work-reward'), null);
});

test('calculates stepped gold display values for count-up rolling', () => {
  assert.equal(getGoldDisplayRollValue(10, 25, 0), 10);
  assert.equal(getGoldDisplayRollValue(10, 25, 0.5), 18);
  assert.equal(getGoldDisplayRollValue(10, 25, 1), 25);
  assert.equal(getGoldDisplayRollValue(25, 10, 0.5), 10);
});

test('maps scratch points to the result slot that should reveal-flash', () => {
  assert.equal(getScratchCardRevealSlotIndex('basic-safe', { xPercent: 0.16, yPercent: 0.5 }), 0);
  assert.equal(getScratchCardRevealSlotIndex('basic-safe', { xPercent: 0.5, yPercent: 0.5 }), 1);
  assert.equal(getScratchCardRevealSlotIndex('basic-safe', { xPercent: 0.84, yPercent: 0.5 }), 2);
  assert.equal(getScratchCardRevealSlotIndex('basic-safe', { xPercent: 1.2, yPercent: 0.5 }), null);

  assert.equal(
    getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.24, yPercent: 0.28 }),
    0,
  );
  assert.equal(getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.5, yPercent: 0.28 }), 1);
  assert.equal(
    getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.76, yPercent: 0.28 }),
    2,
  );
  assert.equal(
    getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.37, yPercent: 0.72 }),
    3,
  );
  assert.equal(
    getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.63, yPercent: 0.72 }),
    4,
  );
  assert.equal(
    getScratchCardRevealSlotIndex('triple-match', { xPercent: 0.95, yPercent: 0.95 }),
    null,
  );

  assert.equal(getScratchCardRevealSlotIndex('risk-peek', { xPercent: 0.2, yPercent: 0.24 }), 0);
  assert.equal(getScratchCardRevealSlotIndex('risk-peek', { xPercent: 0.5, yPercent: 0.24 }), 1);
  assert.equal(getScratchCardRevealSlotIndex('risk-peek', { xPercent: 0.8, yPercent: 0.76 }), 5);
  assert.equal(getScratchCardRevealSlotIndex('risk-peek', { xPercent: 0.5, yPercent: 0.5 }), null);
});

test('requires a configured 95 percent reveal ratio before a scratch slot flashes', () => {
  assert.equal(getScratchCardRevealThreshold('basic-safe'), 0.95);
  assert.equal(getScratchCardRevealThreshold('triple-match'), 0.95);
  assert.equal(getScratchCardRevealThreshold('risk-peek'), 0.95);
  assert.equal(getScratchCardRevealRatio(0.05), 0.95);
  assert.equal(getScratchCardRevealRatio(0.2), 0.8);
  assert.equal(shouldRevealScratchSlot(0.94, 'basic-safe'), false);
  assert.equal(shouldRevealScratchSlot(0.95, 'basic-safe'), true);
  assert.equal(shouldRevealScratchSlot(0.949, 'triple-match'), false);
  assert.equal(shouldRevealScratchSlot(1, 'triple-match'), true);
  assert.equal(shouldRevealScratchSlot(0.95, 'risk-peek'), true);
});

test('waits until every scratch slot has revealed before scheduling winning highlights', () => {
  assert.deepEqual(getScratchCardSlotIndexes('basic-safe'), [0, 1, 2]);
  assert.deepEqual(getScratchCardSlotIndexes('triple-match'), [0, 1, 2, 3, 4]);
  assert.deepEqual(getScratchCardSlotIndexes('risk-peek'), [0, 1, 2, 3, 4, 5]);
  assert.equal(
    getScratchCardSettlementHighlightDelayMs({
      cardType: 'basic-safe',
      revealedSlotIndexes: [0, 2],
      revealFlashDurationMs: 420,
      settleDelayMs: 140,
    }),
    null,
  );
  assert.equal(
    getScratchCardSettlementHighlightDelayMs({
      cardType: 'basic-safe',
      revealedSlotIndexes: [0, 1, 2],
      revealFlashDurationMs: 420,
      settleDelayMs: 140,
    }),
    560,
  );
});

test('finds winning scratch symbol indexes for settlement highlights', () => {
  assert.deepEqual(getWinningScratchSymbolIndexes(['fire', 'cash', 'fire'], 2), [0, 2]);
  assert.deepEqual(
    getWinningScratchSymbolIndexes(['bag', 'coin', 'bag', 'cash', 'bag'], 3),
    [0, 2, 4],
  );
  assert.deepEqual(getWinningScratchSymbolIndexes(['blank', 'blank', 'cash'], 2), []);
});

test('uses cleaned plate count as work level progress within the current level', () => {
  const level0Required = scratchLegendConfig.work.level.platesRequiredByLevel[0];
  const level1Required = scratchLegendConfig.work.level.platesRequiredByLevel[1];
  const maxLevelThreshold = scratchLegendConfig.work.level.platesRequiredByLevel.reduce(
    (sum, count) => sum + count,
    0,
  );

  assert.equal(getWorkLevelProgress(0), 0);
  assert.equal(getWorkLevelProgress(4), 4 / level0Required);
  assert.equal(getWorkLevelProgress(level0Required), 0);
  assert.equal(getWorkLevelProgress(level0Required + 8), 8 / level1Required);
  assert.equal(getWorkLevelProgress(maxLevelThreshold), 1);
});

test('caps work level at the phase one max level', () => {
  const requiredByLevel = scratchLegendConfig.work.level.platesRequiredByLevel;
  const levelOneThreshold = requiredByLevel[0];
  const maxLevelThreshold = requiredByLevel.reduce((sum, count) => sum + count, 0);

  assert.equal(getWorkLevel(0), 0);
  assert.equal(getWorkLevel(levelOneThreshold - 1), 0);
  assert.equal(getWorkLevel(levelOneThreshold), 1);
  assert.equal(getWorkLevel(maxLevelThreshold - 1), scratchLegendConfig.work.level.maxLevel - 1);
  assert.equal(getWorkLevel(maxLevelThreshold), scratchLegendConfig.work.level.maxLevel);
  assert.equal(getWorkLevel(maxLevelThreshold + 48), scratchLegendConfig.work.level.maxLevel);
});

test('creates random plate spawn positions inside the playable desktop area', () => {
  const low = getRandomPlateSpawnPosition(() => 0);
  const high = getRandomPlateSpawnPosition(() => 1);

  assert.deepEqual(low, { xPercent: 22, yPercent: 24 });
  assert.deepEqual(high, { xPercent: 78, yPercent: 74 });
});

test('only closes cleaning view when the backdrop itself is clicked', () => {
  assert.equal(shouldCloseCleaningOverlay('cleaning', true, false), true);
  assert.equal(shouldCloseCleaningOverlay('claimable', true, false), true);
  assert.equal(shouldCloseCleaningOverlay('cleaning', false, true), false);
  assert.equal(shouldCloseCleaningOverlay('cleaning', false, false), true);
  assert.equal(shouldCloseCleaningOverlay('cleaning', false, false, true), false);
  assert.equal(shouldCloseCleaningOverlay('plateSpawned', true, false), false);
});

test('detects whether a click is inside a circular plate hit area', () => {
  const bounds = { left: 100, top: 100, width: 200, height: 200 };

  assert.equal(isPointInsideCircleBounds({ clientX: 200, clientY: 200 }, bounds), true);
  assert.equal(isPointInsideCircleBounds({ clientX: 295, clientY: 200 }, bounds), true);
  assert.equal(isPointInsideCircleBounds({ clientX: 100, clientY: 100 }, bounds), false);
});

test('opens a plate from click only when it was not dragged', () => {
  assert.equal(shouldOpenPlateFromClick(false), true);
  assert.equal(shouldOpenPlateFromClick(true), false);
});

test('opens a plate directly on pointer up when it was not dragged', () => {
  assert.equal(shouldOpenPlateFromPointerUp(false, false), true);
  assert.equal(shouldOpenPlateFromPointerUp(true, false), false);
  assert.equal(shouldOpenPlateFromPointerUp(false, true), false);
});

test('handles plate pointer down while scratch cards are on the table', () => {
  assert.equal(shouldHandlePlatePointerDown('plateSpawned'), true);
  assert.equal(shouldHandlePlatePointerDown('scratchCardSpawned'), true);
  assert.equal(shouldHandlePlatePointerDown('idle'), false);
  assert.equal(shouldHandlePlatePointerDown('scratchingCard'), false);
});

test('starts the game with enough gold to buy exactly one work plate', () => {
  assert.equal(INITIAL_GOLD, 1);
  assert.equal(WORK_PLATE_COST, 1);
  assert.equal(canAffordWorkPlate(INITIAL_GOLD), true);
  assert.equal(canAffordWorkPlate(0), false);
});

test('allows buying work plates while scratch cards are on the table', () => {
  assert.equal(canStartWorkFromPhase('idle', WORK_PLATE_COST), true);
  assert.equal(canStartWorkFromPhase('plateSpawned', WORK_PLATE_COST), true);
  assert.equal(canStartWorkFromPhase('scratchCardSpawned', WORK_PLATE_COST), true);
  assert.equal(canStartWorkFromPhase('scratchingCard', WORK_PLATE_COST), false);
  assert.equal(canStartWorkFromPhase('scratchCardSpawned', 0), false);
});

test('unlocks scratch mode notice when the 10 proficiency segment is filled', () => {
  assert.equal(BASIC_CARD_UNLOCK_GOLD, 13);
  assert.equal(shouldShowScratchUnlockNotice(12, false), false);
  assert.equal(shouldShowScratchUnlockNotice(13, false), true);
  assert.equal(shouldShowScratchUnlockNotice(13, true), false);
});

test('reads segmented proficiency milestones from config', () => {
  const trashMilestone = getUnlockMilestoneById('trash-can');
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const upgradeToolsMilestone = getUnlockMilestoneById('upgrade-tools');
  const tripleMatchMilestone = getUnlockMilestoneById('triple-match-card');
  const autoScratchMachineMilestone = getUnlockMilestoneById('auto-scratcher');
  const lateGameMilestone = getUnlockMilestoneById('late-game-goal');

  assert.equal(trashMilestone?.requiredProficiency, 3);
  assert.equal(scratchMilestone?.requiredProficiency, 10);
  assert.equal(upgradeToolsMilestone?.requiredProficiency, 50);
  assert.equal(tripleMatchMilestone?.requiredProficiency, 100);
  assert.equal(autoScratchMachineMilestone?.requiredProficiency, 250);
  assert.equal(lateGameMilestone?.requiredProficiency, 1000);
  assert.equal(getUnlockMilestoneThreshold('trash-can'), 3);
  assert.equal(getUnlockMilestoneThreshold('scratch-mode'), 13);
  assert.equal(getUnlockMilestoneThreshold('upgrade-tools'), 63);
  assert.equal(getUnlockMilestoneThreshold('triple-match-card'), 163);
  assert.equal(getUnlockMilestoneThreshold('auto-scratcher'), 413);
  assert.equal(getUnlockMilestoneThreshold('late-game-goal'), 1413);
  assert.equal(getNextUnlockMilestone(0)?.id, 'trash-can');
  assert.equal(getNextUnlockMilestone(3)?.id, 'scratch-mode');
  assert.equal(getNextUnlockMilestone(13)?.id, 'upgrade-tools');
  assert.equal(getNextUnlockMilestone(63)?.id, 'triple-match-card');
  assert.equal(getNextUnlockMilestone(163)?.id, 'auto-scratcher');
  assert.equal(getNextUnlockMilestone(413)?.id, 'late-game-goal');
});

test('uses the current milestone segment to calculate the next unlock progress', () => {
  const trashMilestone = getUnlockMilestoneById('trash-can');
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const upgradeToolsMilestone = getUnlockMilestoneById('upgrade-tools');
  const tripleMatchMilestone = getUnlockMilestoneById('triple-match-card');
  const autoScratchMachineMilestone = getUnlockMilestoneById('auto-scratcher');

  assert.equal(getUnlockMilestoneCurrentValue(0, trashMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(3, scratchMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(8, scratchMilestone ?? null), 5);
  assert.equal(getUnlockMilestoneCurrentValue(13, upgradeToolsMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(63, tripleMatchMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(163, autoScratchMachineMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneProgress(0, trashMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneProgress(8, scratchMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(38, upgradeToolsMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(113, tripleMatchMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(288, autoScratchMachineMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(1200, null), 1);
});

test('carries overflow proficiency into the next segment when a reward crosses a goal', () => {
  const trashMilestone = getUnlockMilestoneById('trash-can');
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const upgradeToolsMilestone = getUnlockMilestoneById('upgrade-tools');

  const reachedTrashUnlock = advanceSegmentedProficiency(2, 2);
  assert.equal(reachedTrashUnlock, 4);
  assert.equal(getUnlockMilestoneCurrentValue(reachedTrashUnlock, scratchMilestone ?? null), 1);

  const progressedScratchSegment = advanceSegmentedProficiency(reachedTrashUnlock, 2);
  assert.equal(
    getUnlockMilestoneCurrentValue(progressedScratchSegment, scratchMilestone ?? null),
    3,
  );

  const reachedScratchUnlock = advanceSegmentedProficiency(12, 20);
  assert.equal(reachedScratchUnlock, 32);
  assert.equal(
    getUnlockMilestoneCurrentValue(reachedScratchUnlock, upgradeToolsMilestone ?? null),
    19,
  );
  assert.equal(getUnlockMilestoneProgress(0, trashMilestone ?? null), 0);
});

test('creates a persistable save state with separated player, unlock, notice and workspace data', () => {
  const save = createInitialScratchLegendSave();

  assert.equal(save.version, 1);
  assert.equal(save.player.gold, 1);
  assert.equal(save.player.lifetimeGoldEarned, 0);
  assert.equal(save.player.proficiency, 0);
  assert.equal(save.unlocks.trashCanUnlocked, false);
  assert.equal(save.unlocks.trashCanPurchased, false);
  assert.equal(save.unlocks.unlockedMilestones['scratch-mode'], false);
  assert.equal(save.notices.workRiskMessageDismissed, false);
  assert.equal(save.notices.workRiskNoticeTriggered, false);
  assert.equal(save.notices.upgradeToolsMessageDismissed, false);
  assert.equal(save.workspace.phase, 'idle');
  assert.equal(save.workspace.nextPlateId, 1);
});

test('syncs save state derived unlocks and persisted work level', () => {
  const save = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    player: {
      gold: 9,
      lifetimeGoldEarned: 64,
      proficiency: 64,
      plateCleaned: 10,
      cardsScratched: 0,
      loseStreak: 0,
      workLevel: 0,
    },
  });

  assert.equal(save.player.workLevel, 1);
  assert.equal(save.unlocks.trashCanUnlocked, true);
  assert.equal(save.unlocks.trashCanPurchased, false);
  assert.equal(isUnlockMilestoneUnlocked(save, 'trash-can'), true);
  assert.equal(isUnlockMilestoneUnlocked(save, 'scratch-mode'), true);
  assert.equal(isUnlockMilestoneUnlocked(save, 'upgrade-tools'), true);
  assert.equal(isUnlockMilestoneUnlocked(save, 'triple-match-card'), false);
});

test('unlocks the auto scratch machine when the 250 proficiency segment is filled', () => {
  const beforeUnlock = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    player: {
      ...createInitialScratchLegendSave().player,
      proficiency: 412,
      lifetimeGoldEarned: 412,
    },
  });
  const unlocked = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    player: {
      ...createInitialScratchLegendSave().player,
      proficiency: 413,
      lifetimeGoldEarned: 413,
    },
  });

  assert.equal(isUnlockMilestoneUnlocked(beforeUnlock, 'auto-scratcher'), false);
  assert.equal(isUnlockMilestoneUnlocked(unlocked, 'auto-scratcher'), true);
});

test('merges partial persisted save data back into a complete save schema', () => {
  const save = mergeScratchLegendSave({
    player: {
      gold: 6,
      lifetimeGoldEarned: 14,
    },
    notices: {
      scratchMessageDismissed: true,
    },
    workspace: {
      phase: 'plateSpawned',
    },
  });

  assert.equal(save.player.gold, 6);
  assert.equal(save.player.lifetimeGoldEarned, 14);
  assert.equal(save.player.proficiency, 14);
  assert.equal(save.player.workLevel, 0);
  assert.equal(save.notices.scratchMessageDismissed, true);
  assert.equal(save.notices.workRiskMessageDismissed, false);
  assert.equal(save.workspace.phase, 'plateSpawned');
  assert.equal(save.workspace.nextPlateId, 1);
  assert.equal(isUnlockMilestoneUnlocked(save, 'scratch-mode'), true);
});

test('migrates legacy loans without penalty config back to current templates', () => {
  const save = mergeScratchLegendSave({
    loans: {
      activeLoans: [
        {
          id: 2,
          templateId: 'loan-2',
          title: '贷款 #2',
          effect: '你的刮除范围降低了 1',
          amount: 300,
          signGold: 5,
          interestRateLabel: '6000%',
        } as never,
      ],
      nextLoanId: 3,
      nextLoanTemplateIndex: 2,
    },
  });

  assert.deepEqual(save.loans.activeLoans[0]?.penalty, {
    type: 'scratch-brush-radius-delta',
    delta: -1,
    enabled: true,
  });
});

test('migrates legacy table items with empty scratch progress points', () => {
  const save = mergeScratchLegendSave({
    workspace: {
      plates: [
        {
          id: 7,
          reward: { base: 2, total: 2, isCrit: false, isBroken: false },
          position: { xPercent: 20, yPercent: 30 },
          seed: 7,
        } as never,
      ],
      scratchCards: [
        {
          ...createBasicSafeScratchCard({ id: 8 }),
          scratchPoints: undefined,
        } as never,
      ],
    },
  });

  assert.deepEqual(save.workspace.plates[0]?.cleanPoints, []);
  assert.equal(save.workspace.plates[0]?.isCleaned, false);
  assert.deepEqual(save.workspace.scratchCards[0]?.scratchPoints, []);
});

test('finds the current active plate from the save workspace', () => {
  const save = createInitialScratchLegendSave();
  save.workspace.plates.push({
    id: 3,
    reward: { base: 2, total: 2, isCrit: false, isBroken: false },
    position: { xPercent: 50, yPercent: 50 },
    cleanPoints: [],
    isCleaned: false,
    seed: 3,
  });
  save.workspace.activePlateId = 3;

  assert.equal(getActiveWorkPlate(save)?.id, 3);
});

test('repairs stale claimable work phase without an active plate', () => {
  const save = mergeScratchLegendSave({
    workspace: {
      phase: 'claimable',
      activePlateId: null,
      plates: [],
      scratchCards: [],
    },
  });

  assert.equal(save.workspace.phase, 'idle');
  assert.equal(save.workspace.activePlateId, null);
});

test('returns stale claimable work phase to the desktop when plates remain', () => {
  const save = mergeScratchLegendSave({
    workspace: {
      phase: 'claimable',
      activePlateId: null,
      plates: [
        {
          id: 4,
          reward: { base: 2, total: 2, isCrit: false, isBroken: false },
          position: { xPercent: 50, yPercent: 50 },
          cleanPoints: [],
          isCleaned: false,
          seed: 4,
        },
      ],
      scratchCards: [],
    },
  });

  assert.equal(save.workspace.phase, 'plateSpawned');
});

test('treats fully reset player progress as a fresh workspace', () => {
  const stalePlate = {
    id: 4,
    reward: { base: 2, total: 2, isCrit: false, isBroken: false },
    position: { xPercent: 50, yPercent: 50 },
    cleanPoints: [],
    isCleaned: true,
    seed: 4,
  };
  const save = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    workspace: {
      phase: 'claimable',
      activePlateId: stalePlate.id,
      plates: [stalePlate],
      scratchCards: [],
      activeScratchCardId: null,
      activeScratchCard: null,
      nextPlateId: 5,
      nextScratchCardId: 1,
    },
  });

  assert.equal(save.workspace.phase, 'idle');
  assert.equal(save.workspace.plates.length, 0);
  assert.equal(save.workspace.activePlateId, null);
  assert.equal(canStartWorkFromPhase(save.workspace.phase, save.player.gold), true);
});

test('treats reset core progress as fresh even when lose streak remains', () => {
  const save = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    player: {
      ...createInitialScratchLegendSave().player,
      loseStreak: 3,
    },
    workspace: {
      phase: 'scratchingCard',
      activePlateId: null,
      plates: [],
      scratchCards: [createBasicSafeScratchCard({ id: 7 })],
      activeScratchCardId: 7,
      activeScratchCard: null,
      nextPlateId: 1,
      nextScratchCardId: 8,
    },
  });

  assert.equal(save.workspace.phase, 'idle');
  assert.equal(save.workspace.scratchCards.length, 0);
  assert.equal(save.workspace.activeScratchCardId, null);
  assert.equal(canStartWorkFromPhase(save.workspace.phase, save.player.gold), true);
});

test('uses configured work reward amounts by level', () => {
  scratchLegendConfig.work.level.rewardByLevel.forEach((reward, level) => {
    assert.equal(getWorkRewardAmountForLevel(level), reward);
  });
});

test('guarantees level zero work plates earn two gold without breaking', () => {
  for (const workOrderIndex of [0, 1, 8]) {
    const reward = rollWorkReward({
      workOrderIndex,
      gold: 0,
      workLevel: 0,
      random: () => 0.99,
    });

    assert.equal(reward.total, 2);
    assert.equal(reward.isBroken, false);
  }
});

test('enables the broken plate roll starting at work level one', () => {
  const levelOneReward = getWorkRewardAmountForLevel(1);
  const brokenReward = rollWorkReward({
    workOrderIndex: 0,
    gold: levelOneReward + WORK_PLATE_COST,
    workLevel: 1,
    random: () => 0.95,
  });

  assert.equal(brokenReward.total, -levelOneReward);
  assert.equal(brokenReward.isBroken, true);
});

test('rolls normal reward or protected broken plate after work level one', () => {
  const normalReward = rollWorkReward({
    workOrderIndex: 0,
    gold: 8,
    workLevel: 2,
    random: () => 0.89,
  });

  assert.equal(normalReward.total, getWorkRewardAmountForLevel(2));
  assert.equal(normalReward.isBroken, false);

  const brokenReward = rollWorkReward({
    workOrderIndex: 0,
    gold: getWorkRewardAmountForLevel(2) + WORK_PLATE_COST,
    workLevel: 2,
    random: () => 0.9,
  });

  assert.equal(brokenReward.total, -getWorkRewardAmountForLevel(2));
  assert.equal(brokenReward.isBroken, true);

  const protectedReward = rollWorkReward({
    workOrderIndex: 0,
    gold: getWorkRewardAmountForLevel(2),
    workLevel: 2,
    random: () => 0.99,
  });

  assert.equal(protectedReward.total, getWorkRewardAmountForLevel(2));
  assert.equal(protectedReward.isBroken, false);
});

test('uses the current work level reward as the broken plate penalty', () => {
  const levelThreeReward = getWorkRewardAmountForLevel(3);
  const brokenReward = rollWorkReward({
    workOrderIndex: 0,
    gold: levelThreeReward + WORK_PLATE_COST,
    workLevel: 3,
    random: () => 0.95,
  });

  assert.equal(brokenReward.base, 0);
  assert.equal(brokenReward.total, -levelThreeReward);
  assert.equal(brokenReward.isBroken, true);
});

test('only rings the work risk phone after the first broken plate happens', () => {
  assert.equal(shouldShowWorkRiskNotice(false, false), false);
  assert.equal(shouldShowWorkRiskNotice(true, false), true);
  assert.equal(shouldShowWorkRiskNotice(true, true), false);
});

test('configures the stage 2.5 upgrade tools from the static rules source', () => {
  const tools = scratchLegendConfig.upgradeTools.items;

  assert.deepEqual(
    tools.map((tool) => ({
      id: tool.id,
      price: tool.price,
      level: tool.level,
      maxLevel: tool.maxLevel,
    })),
    [
      { id: 'scratch-luck', price: 200, level: 0, maxLevel: 10 },
      { id: 'scratch-radius', price: 100, level: 0, maxLevel: 10 },
      { id: 'copper-coin', price: 500, level: 1, maxLevel: 10 },
    ],
  );
});

test('uses increasing upgrade prices by current tool level', () => {
  const radiusTool = scratchLegendConfig.upgradeTools.items.find(
    (tool) => tool.id === 'scratch-radius',
  );
  const luckTool = scratchLegendConfig.upgradeTools.items.find(
    (tool) => tool.id === 'scratch-luck',
  );

  assert.ok(radiusTool);
  assert.ok(luckTool);
  assert.equal(getUpgradeToolPrice(radiusTool, 0), 100);
  assert.equal(getUpgradeToolPrice(radiusTool, 1), 150);
  assert.equal(getUpgradeToolPrice(radiusTool, 2), 225);
  assert.equal(getUpgradeToolPrice(luckTool, 0), 200);
  assert.equal(getUpgradeToolPrice(luckTool, 1), 300);
});

test('scratch luck shifts losing probability into winning prize tiers', () => {
  const levelZeroPool = getLuckAdjustedScratchCardPrizePool('basic-safe', 0, 0);
  const levelTwoPool = getLuckAdjustedScratchCardPrizePool('basic-safe', 0, 2);
  const levelTenPool = getLuckAdjustedScratchCardPrizePool('basic-safe', 0, 10);

  assert.equal(levelZeroPool.find((tier) => tier.id === 'no-pair')?.probability, 0.72);
  assert.equal(
    Number(levelTwoPool.find((tier) => tier.id === 'no-pair')?.probability.toFixed(2)),
    0.66,
  );
  assert.equal(levelTenPool.find((tier) => tier.id === 'no-pair')?.probability, 0.45);
  assert.ok(
    (levelTwoPool.find((tier) => tier.id === 'pair-fire')?.probability ?? 0) >
      (levelZeroPool.find((tier) => tier.id === 'pair-fire')?.probability ?? 0),
  );
});

test('scratch luck affects generated safe card results without changing forced tiers', () => {
  const levelZeroCard = createBasicSafeScratchCard({ id: 1, random: () => 0.7 });
  const luckyCard = createBasicSafeScratchCard({ id: 2, luckLevel: 2, random: () => 0.7 });
  const forcedCard = createBasicSafeScratchCard({
    id: 3,
    luckLevel: 10,
    forcedTierId: 'no-pair',
  });

  assert.equal(levelZeroCard.result.tierId, 'no-pair');
  assert.notEqual(luckyCard.result.tierId, 'no-pair');
  assert.equal(forcedCard.result.tierId, 'no-pair');
});

test('describes the active scratch luck upgrade effect for the panel', () => {
  assert.equal(getScratchLuckEffectPercent(0), 0);
  assert.equal(getScratchLuckEffectPercent(3), 9);
  assert.equal(getScratchLuckEffectLabel(0), '当前幸运：未生效');
  assert.equal(getScratchLuckEffectLabel(3), '当前幸运：未中奖权重 -9%');
});

test('applies active loan brush radius penalties after upgrade bonuses', () => {
  const baseRadius = scratchLegendConfig.scratchCards.basicSafe.scratchBrush.radius;
  const radiusLoan = createLoanFromTemplate({
    id: 2,
    templateIndex: 1,
  });

  assert.equal(getScratchBrushRadiusForUpgradeLevel(2), baseRadius + 2);
  assert.equal(getScratchBrushRadius(2, [radiusLoan]), baseRadius + 1);
  assert.equal(getScratchBrushRadius(0, [radiusLoan]), baseRadius - 1);
});

test('applies scratch radius upgrades to the larger cleaning brush', () => {
  const baseRadius = scratchLegendConfig.work.cleanBrush.radius;
  const radiusLoan = createLoanFromTemplate({
    id: 2,
    templateIndex: 1,
  });

  assert.equal(getCleaningBrushRadius(0), baseRadius);
  assert.equal(getCleaningBrushRadius(2), baseRadius + 2);
  assert.equal(getCleaningBrushRadius(2, [radiusLoan]), baseRadius + 1);
});

test('ignores legacy active loans without penalty config in brush radius calculations', () => {
  const baseRadius = scratchLegendConfig.scratchCards.basicSafe.scratchBrush.radius;

  assert.equal(getScratchBrushRadius(0, [{} as never]), baseRadius);
});

test('unlocks the trash can offer after three proficiency and requires buying it', () => {
  assert.equal(TRASH_CAN_UNLOCK_AFTER_PLATES, 3);
  assert.equal(TRASH_CAN_PRICE, 2);
  assert.equal(shouldUnlockTrashCan(2, false), false);
  assert.equal(shouldUnlockTrashCan(3, false), true);
  assert.equal(shouldUnlockTrashCan(3, true), false);
  assert.equal(canBuyTrashCan(1, true, false), false);
  assert.equal(canBuyTrashCan(2, false, false), false);
  assert.equal(canBuyTrashCan(2, true, false), true);
  assert.equal(canBuyTrashCan(2, true, true), false);
  assert.equal(shouldShowWorkRiskNotice(false, false), false);
  assert.equal(shouldShowWorkRiskNotice(true, false), true);
  assert.equal(shouldShowWorkRiskNotice(true, true), false);
});

test('uses configured price and unlock gate for the first safe scratch card', () => {
  assert.equal(BASIC_SAFE_CARD_PRICE, scratchLegendConfig.scratchCards.basicSafe.price);
  assert.equal(BASIC_SAFE_CARD_PRICE, 10);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 9, lifetimeGoldEarned: 10 }), false);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 10, lifetimeGoldEarned: 12 }), false);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 10, lifetimeGoldEarned: 13 }), true);
});

test('tracks basic safe scratch card level progress by settled card count', () => {
  const levelOne = getScratchCardLevelProgress('basic-safe', 0);
  const almostLevelTwo = getScratchCardLevelProgress('basic-safe', 2);
  const levelTwo = getScratchCardLevelProgress('basic-safe', 3);

  assert.equal(levelOne.level, 0);
  assert.equal(levelOne.current, 0);
  assert.equal(levelOne.target, 3);
  assert.equal(levelOne.ratio, 0);
  assert.equal(almostLevelTwo.level, 0);
  assert.equal(almostLevelTwo.current, 2);
  assert.equal(almostLevelTwo.target, 3);
  assert.equal(levelTwo.level, 1);
  assert.equal(levelTwo.current, 0);
  assert.equal(levelTwo.target, 10);
});

test('uses level adjusted payouts for the basic safe scratch card prize pool', () => {
  const levelZeroPool = getBasicSafeScratchCardPrizePoolForLevel(0);
  const levelOnePool = getBasicSafeScratchCardPrizePoolForLevel(1);

  assert.equal(levelZeroPool.find((tier) => tier.id === 'pair-fire')?.payout, 10);
  assert.equal(levelZeroPool.find((tier) => tier.id === 'pair-cash')?.payout, 25);
  assert.equal(levelZeroPool.find((tier) => tier.id === 'pair-bag')?.payout, 50);
  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-fire')?.payout, 13);
  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-cash')?.payout, 32);
  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-bag')?.payout, 65);
});

test('pre-generates a basic safe card result when the card is created', () => {
  const card = createBasicSafeScratchCard({
    id: 7,
    random: () => 0.73,
    level: 2,
  });

  assert.equal(card.id, 7);
  assert.equal(card.type, 'basic-safe');
  assert.equal(card.price, BASIC_SAFE_CARD_PRICE);
  assert.equal(card.level, 2);
  assert.equal(card.status, 'onTable');
  assert.equal(card.result.tierId, 'pair-fire');
  assert.equal(card.result.payout, 16);
  assert.equal(card.result.hasPenaltySymbol, false);
  assert.equal(card.result.canDiscard, false);
});

test('can force a basic safe card into the loan wrong-card result', () => {
  const card = createBasicSafeScratchCard({
    id: 20,
    random: () => 0.99,
    forcedTierId: 'no-pair',
  });

  assert.equal(card.result.tierId, 'no-pair');
  assert.equal(card.result.payout, 0);
  assert.equal(card.result.isWinning, false);
});

test('randomizes basic safe card result slot positions without changing outcomes', () => {
  const firstLossCard = createBasicSafeScratchCard({
    id: 21,
    forcedTierId: 'no-pair',
    symbolRandom: () => 0,
  });
  const secondLossCard = createBasicSafeScratchCard({
    id: 22,
    forcedTierId: 'no-pair',
    symbolRandom: () => 0.99,
  });
  const firstFireCard = createBasicSafeScratchCard({
    id: 23,
    forcedTierId: 'pair-fire',
    symbolRandom: () => 0,
  });
  const secondFireCard = createBasicSafeScratchCard({
    id: 24,
    forcedTierId: 'pair-fire',
    symbolRandom: () => 0.99,
  });

  assert.notDeepEqual(firstLossCard.result.symbols, secondLossCard.result.symbols);
  assert.equal(firstLossCard.result.isWinning, false);
  assert.equal(secondLossCard.result.isWinning, false);
  assert.notDeepEqual(firstFireCard.result.symbols, secondFireCard.result.symbols);
  assert.equal(firstFireCard.result.isWinning, true);
  assert.equal(secondFireCard.result.isWinning, true);
  assert.equal(firstFireCard.result.symbols.filter((symbol) => symbol === 'fire').length, 2);
  assert.equal(secondFireCard.result.symbols.filter((symbol) => symbol === 'fire').length, 2);
});

test('can place every basic safe card symbol in every loss result slot', () => {
  const randomSequences = [
    [0, 0],
    [0, 0.75],
    [0.4, 0],
    [0.4, 0.75],
    [0.8, 0],
    [0.8, 0.75],
  ];
  const symbolsBySlot = [new Set(), new Set(), new Set()];

  for (const [cardIndex, sequence] of randomSequences.entries()) {
    let randomIndex = 0;
    const card = createBasicSafeScratchCard({
      id: 30 + cardIndex,
      forcedTierId: 'no-pair',
      symbolRandom: () => sequence[randomIndex++] ?? 0,
    });

    assert.equal(card.result.isWinning, false);
    card.result.symbols.forEach((symbol, slotIndex) => {
      symbolsBySlot[slotIndex].add(symbol);
    });
  }

  for (const slotSymbols of symbolsBySlot) {
    assert.deepEqual([...slotSymbols].sort(), ['bag', 'cash', 'fire']);
  }
});

test('keeps generated outcome amounts hidden until the result is revealed', () => {
  assert.equal(getOutcomeAmountLabel(false, 13), '未揭晓');
  assert.equal(getOutcomeAmountLabel(false, -5), '未揭晓');
  assert.equal(getOutcomeAmountLabel(true, 13), '$13');
  assert.equal(getOutcomeAmountLabel(true, 0), '$0');
  assert.equal(getOutcomeAmountLabel(true, -5), '-$5');
});

test('rolls all local MVP prize tiers from deterministic random values', () => {
  const cases = [
    [0, 'no-pair', 0],
    [0.72, 'pair-fire', 10],
    [0.92, 'pair-cash', 25],
    [0.98, 'pair-bag', 50],
  ] as const;

  for (const [randomValue, tierId, payout] of cases) {
    const tier = getBasicSafeScratchCardPrizeTier(() => randomValue, 0);

    assert.equal(tier.id, tierId);
    assert.equal(tier.payout, payout);
  }
});

test('keeps real scratch odds separate from displayed ticket odds', () => {
  const prizePool = getBasicSafeScratchCardPrizePoolForLevel(1);
  const lossTier = prizePool.find((tier) => tier.id === 'no-pair');
  const fireTier = prizePool.find((tier) => tier.id === 'pair-fire');
  const cashTier = prizePool.find((tier) => tier.id === 'pair-cash');
  const bagTier = prizePool.find((tier) => tier.id === 'pair-bag');

  assert.equal(lossTier?.probability, 0.72);
  assert.equal(lossTier?.displayProbability, null);
  assert.equal(fireTier?.probability, 0.2);
  assert.equal(fireTier?.displayProbability, 0.5);
  assert.equal(cashTier?.probability, 0.06);
  assert.equal(cashTier?.displayProbability, 0.4);
  assert.equal(bagTier?.probability, 0.02);
  assert.equal(bagTier?.displayProbability, 0.1);
});

test('treats any two matching result slots as a winning scratch card', () => {
  assert.equal(isScratchCardWinningResult(['fire', 'fire', 'blank']), true);
  assert.equal(isScratchCardWinningResult(['fire', 'blank', 'fire']), true);
  assert.equal(isScratchCardWinningResult(['blank', 'fire', 'fire']), true);
  assert.equal(isScratchCardWinningResult(['fire', 'blank', 'cash']), false);
});

test('reveals the full scratch cover once the effective scratch threshold is reached', () => {
  const threshold = scratchLegendConfig.scratchCards.basicSafe.scratchCompleteThreshold;

  assert.equal(shouldRevealFullScratchCover(threshold - 0.01), false);
  assert.equal(shouldRevealFullScratchCover(threshold), true);
  assert.equal(shouldShowScratchCover('scratching', 0), true);
  assert.equal(shouldShowScratchCover('scratching', threshold), false);
  assert.equal(shouldShowScratchCover('claimable', 0), false);
});

test('settles a completed two-win card only when a pair appears', () => {
  const player = {
    gold: 10,
    lifetimeGoldEarned: 14,
    proficiency: 14,
    plateCleaned: 4,
    cardsScratched: 2,
    loseStreak: 1,
    workLevel: 0,
  };
  const lossCard = createBasicSafeScratchCard({ id: 1, random: () => 0 });
  const winningCard = createBasicSafeScratchCard({ id: 2, random: () => 0.93 });

  const afterLoss = settleBasicSafeScratchCard(player, lossCard);
  const afterWin = settleBasicSafeScratchCard(player, winningCard);

  assert.equal(afterLoss.gold, 10);
  assert.equal(afterLoss.lifetimeGoldEarned, 14);
  assert.equal(afterLoss.cardsScratched, 3);
  assert.equal(afterLoss.loseStreak, 2);
  assert.equal(afterWin.gold, 35);
  assert.equal(afterWin.lifetimeGoldEarned, 39);
  assert.equal(afterWin.cardsScratched, 3);
  assert.equal(afterWin.loseStreak, 0);
});

test('advances basic safe card progress only after settlement', () => {
  const progress = { cardsSettled: 2 };
  const nextProgress = advanceBasicSafeScratchCardProgress(progress);

  assert.equal(progress.cardsSettled, 2);
  assert.equal(nextProgress.cardsSettled, 3);
  assert.equal(getScratchCardLevelProgress('basic-safe', nextProgress.cardsSettled).level, 1);
});

test('configures triple match card from the static rules source', () => {
  const tripleMatchConfig = getScratchCardConfig('triple-match');

  assert.equal(TRIPLE_MATCH_CARD_PRICE, 100);
  assert.equal(tripleMatchConfig.label, '三连胜出');
  assert.equal(tripleMatchConfig.price, 100);
  assert.equal(tripleMatchConfig.matchRule.slots, 5);
  assert.equal(tripleMatchConfig.matchRule.requiredMatches, 3);
  assert.equal(tripleMatchConfig.scratchCompleteThreshold, 0.82);
  assert.equal(getScratchCardStepDistance('triple-match'), 5);
});

test('unlocks triple match notice when the 100 proficiency segment is filled', () => {
  assert.equal(getUnlockMilestoneThreshold('triple-match-card'), 163);
  assert.equal(shouldShowTripleMatchUnlockNotice(162, false), false);
  assert.equal(shouldShowTripleMatchUnlockNotice(163, false), true);
  assert.equal(shouldShowTripleMatchUnlockNotice(163, true), false);
});

test('uses configured price and unlock gate for generic scratch card purchases', () => {
  assert.equal(canBuyScratchCard('basic-safe', { gold: 9, lifetimeGoldEarned: 100 }), false);
  assert.equal(canBuyScratchCard('basic-safe', { gold: 10, lifetimeGoldEarned: 12 }), false);
  assert.equal(canBuyScratchCard('basic-safe', { gold: 10, lifetimeGoldEarned: 13 }), true);
  assert.equal(canBuyScratchCard('triple-match', { gold: 99, lifetimeGoldEarned: 163 }), false);
  assert.equal(canBuyScratchCard('triple-match', { gold: 100, lifetimeGoldEarned: 162 }), false);
  assert.equal(canBuyScratchCard('triple-match', { gold: 100, lifetimeGoldEarned: 163 }), true);
});

test('keeps triple match real odds separate from displayed ticket odds', () => {
  const prizePool = getScratchCardPrizePoolForLevel('triple-match', 0);
  const lossTier = prizePool.find((tier) => tier.id === 'no-triple');
  const coinTier = prizePool.find((tier) => tier.id === 'triple-coin');
  const bagTier = prizePool.find((tier) => tier.id === 'triple-bag');
  const cashTier = prizePool.find((tier) => tier.id === 'triple-cash');
  const jackpotTier = prizePool.find((tier) => tier.id === 'triple-jackpot');

  assert.equal(lossTier?.probability, 0.82);
  assert.equal(lossTier?.displayProbability, null);
  assert.equal(coinTier?.probability, 0.1);
  assert.equal(coinTier?.displayProbability, 0.3);
  assert.equal(bagTier?.probability, 0.05);
  assert.equal(bagTier?.displayProbability, 0.3);
  assert.equal(cashTier?.probability, 0.025);
  assert.equal(cashTier?.displayProbability, 0.3);
  assert.equal(jackpotTier?.probability, 0.005);
  assert.equal(jackpotTier?.displayProbability, 0.1);
});

test('pre-generates a triple match result with five symbols and level zero', () => {
  const card = createTripleMatchScratchCard({
    id: 41,
    forcedTierId: 'triple-cash',
    symbolRandom: () => 0,
  });

  assert.equal(card.id, 41);
  assert.equal(card.type, 'triple-match');
  assert.equal(card.price, TRIPLE_MATCH_CARD_PRICE);
  assert.equal(card.level, 0);
  assert.equal(card.result.tierId, 'triple-cash');
  assert.equal(card.result.symbols.length, 5);
  assert.equal(card.result.symbols.filter((symbol) => symbol === 'cash').length, 3);
  assert.equal(card.result.payout, 500);
  assert.equal(card.result.isWinning, true);
});

test('creates triple match loss results without any three matching symbols', () => {
  const card = createTripleMatchScratchCard({
    id: 42,
    forcedTierId: 'no-triple',
    symbolRandom: () => 0,
  });
  const symbolCounts = new Map(card.result.symbols.map((symbol) => [symbol, 0]));

  for (const symbol of card.result.symbols) {
    symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
  }

  assert.equal(card.result.tierId, 'no-triple');
  assert.equal(Math.max(...symbolCounts.values()), 2);
  assert.equal(card.result.payout, 0);
  assert.equal(card.result.isWinning, false);
});

test('settles scratch cards through the generic card type rules', () => {
  const player = {
    gold: 100,
    lifetimeGoldEarned: 163,
    proficiency: 163,
    plateCleaned: 20,
    cardsScratched: 4,
    loseStreak: 1,
    workLevel: 2,
  };
  const lossCard = createTripleMatchScratchCard({ id: 43, forcedTierId: 'no-triple' });
  const winningCard = createTripleMatchScratchCard({ id: 44, forcedTierId: 'triple-coin' });

  const afterLoss = settleScratchCard(player, lossCard);
  const afterWin = settleScratchCard(player, winningCard);

  assert.equal(afterLoss.gold, 100);
  assert.equal(afterLoss.lifetimeGoldEarned, 163);
  assert.equal(afterLoss.cardsScratched, 5);
  assert.equal(afterLoss.loseStreak, 2);
  assert.equal(afterWin.gold, 200);
  assert.equal(afterWin.lifetimeGoldEarned, 263);
  assert.equal(afterWin.cardsScratched, 5);
  assert.equal(afterWin.loseStreak, 0);
});

test('configures the first risk peek card from the static rules source', () => {
  const riskPeekConfig = getScratchCardConfig('risk-peek');

  assert.equal(RISK_PEEK_CARD_PRICE, 150);
  assert.equal(riskPeekConfig.label, '险中求财');
  assert.equal(riskPeekConfig.price, 150);
  assert.equal(riskPeekConfig.matchRule.slots, 6);
  assert.equal('riskRule' in riskPeekConfig ? riskPeekConfig.riskRule.discardCostRatio : null, 0.3);
  assert.equal(getScratchCardDiscardCost(riskPeekConfig.price), 45);
  assert.equal(getScratchCardStepDistance('risk-peek'), 5);
});

test('groups implemented scratch cards into the first card album roles', () => {
  const firstAlbum = SCRATCH_CARD_ALBUMS_CONFIG[0];
  const nextAlbum = SCRATCH_CARD_ALBUMS_CONFIG[1];

  assert.equal(firstAlbum?.id, 'street-luck');
  assert.equal(firstAlbum?.label, '街角好运');
  assert.deepEqual(
    firstAlbum?.slots.map((slot) => [slot.role, slot.cardType]),
    [
      ['stable', 'basic-safe'],
      ['risk', 'risk-peek'],
      ['high-odds', 'triple-match'],
      ['finale', null],
    ],
  );
  assert.equal(nextAlbum?.id, 'next-album');
  assert.equal(nextAlbum?.slots.length, 0);
  assert.equal(getScratchCardAlbumSlotByType('basic-safe')?.roleLabel, '稳定票');
  assert.equal(getScratchCardAlbumSlotByType('risk-peek')?.roleLabel, '风险票');
  assert.equal(getScratchCardAlbumSlotByType('triple-match')?.roleLabel, '高赔率票');
});

test('configures the auto scratch machine as a proficiency-gated purchase', () => {
  assert.equal(AUTO_SCRATCH_MACHINE_CONFIG.price, 1000);
  assert.equal(AUTO_SCRATCH_MACHINE_CONFIG.unlock.requiredMilestoneId, 'auto-scratcher');
  assert.equal(AUTO_SCRATCH_MACHINE_CONFIG.base.queueCapacity, 2);
  assert.equal(AUTO_SCRATCH_MACHINE_CONFIG.base.processingSeconds, 8);
  assert.equal(AUTO_SCRATCH_MACHINE_CONFIG.base.defaultCardType, 'basic-safe');
  assert.deepEqual(
    AUTO_SCRATCH_MACHINE_CONFIG.upgrades.map((upgrade) => [upgrade.id, upgrade.price]),
    [
      ['auto-capacity', 2500],
      ['auto-power', 2000],
      ['auto-speed', 5000],
    ],
  );
});

test('summarizes proficiency milestone state for the locked auto scratch machine goal', () => {
  assert.deepEqual(
    getAutoScratchMachineUnlockProgress({
      gold: 469,
      milestoneUnlocked: false,
    }),
    {
      price: 1000,
      goldShortfall: 531,
      milestoneUnlocked: false,
      unlockedByTargets: false,
    },
  );
});

test('allows buying the auto scratch machine only after proficiency and gold are ready', () => {
  assert.equal(
    canBuyAutoScratchMachine({
      gold: 999,
      milestoneUnlocked: true,
      alreadyUnlocked: false,
    }),
    false,
  );
  assert.equal(
    canBuyAutoScratchMachine({
      gold: 1000,
      milestoneUnlocked: false,
      alreadyUnlocked: false,
    }),
    false,
  );
  assert.equal(
    canBuyAutoScratchMachine({
      gold: 1000,
      milestoneUnlocked: true,
      alreadyUnlocked: false,
    }),
    true,
  );
  assert.equal(
    canBuyAutoScratchMachine({
      gold: 2000,
      milestoneUnlocked: true,
      alreadyUnlocked: true,
    }),
    false,
  );
});

test('auto scratch machine buys a basic safe card into its queue', () => {
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 25,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
    },
  });

  const nextSave = advanceAutoScratchMachineSave(save, 1000, {
    random: () => 0.99,
    symbolRandom: () => 0.25,
  });

  assert.equal(nextSave.player.gold, 15);
  assert.equal(nextSave.automation.autoScratchMachineStatus, 'refilling');
  assert.equal(nextSave.automation.autoScratchQueue.length, 1);
  assert.equal(nextSave.automation.autoScratchQueue[0]?.type, 'basic-safe');
  assert.equal(nextSave.automation.autoScratchQueue[0]?.status, 'onTable');
  assert.equal(nextSave.workspace.scratchCards.length, 0);
  assert.equal(nextSave.workspace.nextScratchCardId, save.workspace.nextScratchCardId + 1);
});

test('normalizes unlocked auto scratch machine away from locked status', () => {
  const save = mergeScratchLegendSave({
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMachineStatus: 'locked',
    },
  });

  assert.equal(save.automation.autoScratchMachineStatus, 'idle');

  const syncedSave = syncScratchLegendSave({
    ...save,
    automation: {
      ...save.automation,
      autoScratchMachineStatus: 'locked',
    },
  });

  assert.equal(syncedSave.automation.autoScratchMachineStatus, 'idle');
});

test('normalizes missing auto scratch machine ticket config to runnable defaults', () => {
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 25,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchAutoBuyEnabled: false,
      autoScratchMinReserveGold: 999,
    },
  });

  assert.equal(save.automation.autoScratchAutoBuyEnabled, false);
  assert.deepEqual(save.automation.autoScratchAllowedCardTypes, ['basic-safe']);
  assert.equal(save.automation.autoScratchMinReserveGold, 999);

  const nextSave = advanceAutoScratchMachineSave(save, 1000, {
    random: () => 0.99,
    symbolRandom: () => 0.25,
  });

  assert.equal(nextSave.player.gold, 25);
  assert.equal(nextSave.automation.autoScratchMachineStatus, 'idle');
  assert.equal(nextSave.automation.autoScratchQueue.length, 0);
});

test('auto scratch machine can disable every allowed ticket type', () => {
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 25,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchAllowedCardTypes: [],
    },
  });

  assert.deepEqual(save.automation.autoScratchAllowedCardTypes, []);
  assert.equal(getAutoScratchMachineBlockReason(save), 'no-allowed-card-types');

  const nextSave = advanceAutoScratchMachineSave(save, 1000, {
    random: () => 0.99,
    symbolRandom: () => 0.25,
  });

  assert.equal(nextSave.player.gold, 25);
  assert.equal(nextSave.automation.autoScratchMachineStatus, 'blocked');
  assert.equal(nextSave.automation.autoScratchQueue.length, 0);
});

test('auto scratch machine reports specific purchase block reasons', () => {
  const notEnoughGoldSave = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: BASIC_SAFE_CARD_PRICE - 1,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
    },
  });
  const reserveBlockedSave = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: BASIC_SAFE_CARD_PRICE + 5,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMinReserveGold: 10,
    },
  });
  const autoBuyOffSave = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchAutoBuyEnabled: false,
    },
  });

  assert.equal(getAutoScratchMachineBlockReason(notEnoughGoldSave), 'not-enough-gold');
  assert.equal(getAutoScratchMachineBlockReason(reserveBlockedSave), 'reserve');
  assert.equal(getAutoScratchMachineBlockReason(autoBuyOffSave), 'auto-buy-off');
});

test('auto scratch machine respects minimum reserve gold before buying', () => {
  const blockedSave = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 105,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMinReserveGold: 100,
    },
  });

  const nextBlockedSave = advanceAutoScratchMachineSave(blockedSave, 1000);

  assert.equal(nextBlockedSave.player.gold, 105);
  assert.equal(nextBlockedSave.automation.autoScratchMachineStatus, 'blocked');
  assert.equal(nextBlockedSave.automation.autoScratchQueue.length, 0);

  const buyableSave = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 110,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMinReserveGold: 100,
    },
  });

  const nextBuyableSave = advanceAutoScratchMachineSave(buyableSave, 1000, {
    random: () => 0.99,
    symbolRandom: () => 0.25,
  });

  assert.equal(nextBuyableSave.player.gold, 100);
  assert.equal(nextBuyableSave.automation.autoScratchMachineStatus, 'refilling');
  assert.equal(nextBuyableSave.automation.autoScratchQueue.length, 1);
});

test('auto scratch machine pause freezes current processing progress', () => {
  const currentCard = createScratchCard('basic-safe', {
    id: 8,
    level: 0,
    forcedTierId: 'pair-fire',
  });
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMachineStatus: 'paused',
      autoScratchCurrentCard: currentCard,
      autoScratchProgressMs: 3000,
    },
  });

  const nextSave = advanceAutoScratchMachineSave(save, 4000);

  assert.equal(nextSave.automation.autoScratchMachineStatus, 'paused');
  assert.equal(nextSave.automation.autoScratchCurrentCard?.id, currentCard.id);
  assert.equal(nextSave.automation.autoScratchProgressMs, 3000);
  assert.equal(nextSave.player.gold, 40);
  assert.equal(nextSave.player.cardsScratched, 0);
});

test('auto scratch machine processes queued cards when auto buy is disabled', () => {
  const queuedCard = createScratchCard('basic-safe', {
    id: 9,
    level: 0,
    forcedTierId: 'pair-fire',
  });
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchAutoBuyEnabled: false,
      autoScratchQueue: [queuedCard],
    },
  });

  const startedSave = advanceAutoScratchMachineSave(save, 0);

  assert.equal(startedSave.automation.autoScratchAutoBuyEnabled, false);
  assert.equal(startedSave.automation.autoScratchMachineStatus, 'processing');
  assert.equal(startedSave.automation.autoScratchCurrentCard?.id, queuedCard.id);
});

test('auto scratch machine lets a queued card return to manual play', () => {
  const queuedCard = createScratchCard('basic-safe', {
    id: 11,
    level: 0,
    forcedTierId: 'pair-bag',
  });
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMachineStatus: 'refilling',
      autoScratchQueue: [queuedCard],
    },
  });

  const nextSave = takeOverAutoScratchMachineCard(save, queuedCard.id);

  assert.equal(nextSave.automation.autoScratchQueue.length, 0);
  assert.equal(nextSave.automation.autoScratchCurrentCard, null);
  assert.equal(nextSave.workspace.scratchCards.length, 1);
  assert.equal(nextSave.workspace.scratchCards[0]?.id, queuedCard.id);
  assert.equal(nextSave.workspace.scratchCards[0]?.result.tierId, queuedCard.result.tierId);
  assert.equal(nextSave.workspace.scratchCards[0]?.status, 'onTable');
  assert.equal(nextSave.workspace.phase, 'scratchCardSpawned');
  assert.equal(nextSave.player.cardsScratched, 0);
  assert.equal(nextSave.player.gold, 40);
});

test('auto scratch machine lets the current card return to manual play without settling', () => {
  const currentCard = createScratchCard('basic-safe', {
    id: 12,
    level: 0,
    forcedTierId: 'pair-fire',
  });
  const queuedCard = createScratchCard('basic-safe', {
    id: 13,
    level: 0,
    forcedTierId: 'pair-cash',
  });
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchMachineStatus: 'processing',
      autoScratchCurrentCard: currentCard,
      autoScratchQueue: [queuedCard],
      autoScratchProgressMs: 5000,
    },
  });

  const nextSave = takeOverAutoScratchMachineCard(save, currentCard.id);

  assert.equal(nextSave.automation.autoScratchCurrentCard, null);
  assert.equal(nextSave.automation.autoScratchProgressMs, 0);
  assert.equal(nextSave.automation.autoScratchQueue.length, 1);
  assert.equal(nextSave.automation.autoScratchQueue[0]?.id, queuedCard.id);
  assert.equal(nextSave.automation.autoScratchMachineStatus, 'idle');
  assert.equal(nextSave.workspace.scratchCards.length, 1);
  assert.equal(nextSave.workspace.scratchCards[0]?.id, currentCard.id);
  assert.equal(nextSave.workspace.scratchCards[0]?.result.tierId, currentCard.result.tierId);
  assert.equal(nextSave.player.gold, 40);
  assert.equal(nextSave.player.cardsScratched, 0);
  assert.equal(nextSave.scratchCards.basicSafe.cardsSettled, 0);
});

test('auto scratch machine processes queued cards over time before settlement', () => {
  const queuedCard = createScratchCard('basic-safe', {
    id: 7,
    level: 0,
    forcedTierId: 'pair-fire',
  });
  const save = mergeScratchLegendSave({
    player: {
      ...createInitialScratchLegendSave().player,
      gold: 40,
      proficiency: getUnlockMilestoneThreshold('auto-scratcher'),
    },
    automation: {
      autoScratchMachineUnlocked: true,
      autoScratchQueue: [queuedCard],
    },
  });

  const startedSave = advanceAutoScratchMachineSave(save, 0);
  assert.equal(startedSave.automation.autoScratchMachineStatus, 'processing');
  assert.equal(startedSave.automation.autoScratchCurrentCard?.id, queuedCard.id);
  assert.equal(startedSave.automation.autoScratchQueue.length, 0);
  assert.equal(startedSave.player.cardsScratched, 0);

  const halfwaySave = advanceAutoScratchMachineSave(startedSave, 4000);
  assert.equal(halfwaySave.automation.autoScratchMachineStatus, 'processing');
  assert.equal(halfwaySave.automation.autoScratchProgressMs, 4000);
  assert.equal(halfwaySave.player.gold, 40);
  assert.equal(halfwaySave.player.cardsScratched, 0);

  const settledSave = advanceAutoScratchMachineSave(halfwaySave, 4000);
  assert.equal(settledSave.automation.autoScratchMachineStatus, 'idle');
  assert.equal(settledSave.automation.autoScratchCurrentCard, null);
  assert.equal(settledSave.automation.autoScratchProgressMs, 0);
  assert.equal(settledSave.player.gold, 50);
  assert.equal(settledSave.player.cardsScratched, 1);
  assert.equal(settledSave.scratchCards.basicSafe.cardsSettled, 1);
});

test('keeps the top progress on proficiency after upgrade tools unlock', () => {
  assert.deepEqual(
    getStageGoalProgress({
      nextUnlockMilestone: { id: 'late-game-goal', label: '后续目标', requiredProficiency: 1000 },
      unlockProgressCurrent: 37,
      unlockProgressTarget: 1000,
      unlockProgressRatio: 0.037,
      autoScratchMachineUnlocked: false,
      autoScratchMachineProgress: getAutoScratchMachineUnlockProgress({
        gold: 1510,
        milestoneUnlocked: false,
      }),
    }),
    {
      label: '熟练度',
      current: 37,
      target: 1000,
      ratio: 0.037,
    },
  );
});

test('keeps the top progress on proficiency after the auto scratch machine is unlocked', () => {
  assert.deepEqual(
    getStageGoalProgress({
      nextUnlockMilestone: { id: 'late-game-goal', label: '后续目标', requiredProficiency: 1000 },
      unlockProgressCurrent: 0,
      unlockProgressTarget: 1000,
      unlockProgressRatio: 0,
      autoScratchMachineUnlocked: true,
      autoScratchMachineProgress: getAutoScratchMachineUnlockProgress({
        gold: 510,
        milestoneUnlocked: true,
      }),
    }),
    {
      label: '熟练度',
      current: 0,
      target: 1000,
      ratio: 0,
    },
  );
});

test('pre-generates real danger symbols on risk peek cards', () => {
  for (const randomValue of [0, 0.19, 0.51, 0.99]) {
    const card = createRiskPeekScratchCard({
      id: 60,
      forcedTierId: 'risk-danger',
      symbolRandom: () => randomValue,
    });

    assert.equal(card.type, 'risk-peek');
    assert.equal(card.price, RISK_PEEK_CARD_PRICE);
    assert.equal(card.result.hasPenaltySymbol, true);
    assert.equal(card.result.canDiscard, true);
    assert.equal(card.result.penaltyTriggered, false);
    assert.equal(card.result.discardCost, 45);
    assert.equal(card.result.penaltySlotIndexes.length, 1);
    assert.equal(card.result.symbols.filter((symbol) => symbol === 'danger').length, 1);
    assert.equal(card.result.symbols[card.result.penaltySlotIndexes[0] ?? -1], 'danger');
  }
});

test('keeps risk peek safe tier symbols from implying count-based payouts', () => {
  const card = createRiskPeekScratchCard({
    id: 60,
    forcedTierId: 'risk-bag',
    symbolRandom: () => 0,
  });

  assert.equal(card.result.tierId, 'risk-bag');
  assert.equal(card.result.payout, 260);
  assert.equal(card.result.symbols.filter((symbol) => symbol === 'bag').length, 1);
  assert.equal(card.result.symbols.filter((symbol) => symbol === 'coin').length, 0);
  assert.equal(card.result.symbols.filter((symbol) => symbol === 'cash').length, 0);
  assert.equal(card.result.symbols.filter((symbol) => symbol === 'danger').length, 0);
});

test('keeps risk peek visible prize symbols aligned with the payout tier', () => {
  const coinCard = createRiskPeekScratchCard({ id: 65, forcedTierId: 'risk-coin' });
  const cashCard = createRiskPeekScratchCard({ id: 66, forcedTierId: 'risk-cash' });

  assert.equal(coinCard.result.payout, 180);
  assert.equal(coinCard.result.symbols.filter((symbol) => symbol === 'coin').length, 1);
  assert.equal(coinCard.result.symbols.filter((symbol) => symbol === 'cash').length, 0);
  assert.equal(cashCard.result.payout, 420);
  assert.equal(cashCard.result.symbols.filter((symbol) => symbol === 'cash').length, 1);
  assert.equal(cashCard.result.symbols.filter((symbol) => symbol === 'coin').length, 0);
});

test('ties risk peek penalties to revealed danger slots', () => {
  const card = createRiskPeekScratchCard({
    id: 61,
    forcedTierId: 'risk-danger',
    symbolRandom: () => 0,
  });
  const dangerSlotIndex = card.result.penaltySlotIndexes[0] ?? -1;
  const safeSlotIndex = getScratchCardSlotIndexes('risk-peek').find(
    (slotIndex) => slotIndex !== dangerSlotIndex,
  );

  assert.equal(shouldTriggerScratchCardPenalty(card, safeSlotIndex ?? -1), false);
  assert.equal(shouldTriggerScratchCardPenalty(card, dangerSlotIndex), true);

  const triggeredCard = markScratchCardPenaltyTriggered(card);

  assert.equal(triggeredCard.result.penaltyTriggered, true);
  assert.equal(triggeredCard.result.isWinning, false);
  assert.equal(triggeredCard.result.canDiscard, false);
});

test('uses discard cost protection for risk peek cards', () => {
  const card = createRiskPeekScratchCard({
    id: 62,
    forcedTierId: 'risk-danger',
  });
  const scratchingCard = { ...card, status: 'scratching' as const };
  const triggeredCard = markScratchCardPenaltyTriggered(scratchingCard);

  assert.equal(getEffectiveScratchCardDiscardCost(200, scratchingCard), 45);
  assert.equal(getEffectiveScratchCardDiscardCost(20, scratchingCard), 19);
  assert.equal(getEffectiveScratchCardDiscardCost(0, scratchingCard), 0);
  assert.equal(getEffectiveScratchCardDiscardCost(200, triggeredCard), 0);
});

test('settles risk peek safe prizes and triggered penalties through generic rules', () => {
  const player = {
    gold: 80,
    lifetimeGoldEarned: 200,
    proficiency: 200,
    plateCleaned: 20,
    cardsScratched: 4,
    loseStreak: 1,
    workLevel: 2,
  };
  const safeCard = createRiskPeekScratchCard({ id: 63, forcedTierId: 'risk-bag' });
  const dangerCard = markScratchCardPenaltyTriggered(
    createRiskPeekScratchCard({ id: 64, forcedTierId: 'risk-danger' }),
  );

  const afterSafe = settleScratchCard(player, safeCard);
  const afterDanger = settleScratchCard(player, dangerCard);

  assert.equal(afterSafe.gold, 340);
  assert.equal(afterSafe.lifetimeGoldEarned, 460);
  assert.equal(afterSafe.loseStreak, 0);
  assert.equal(afterDanger.gold, 80);
  assert.equal(afterDanger.lifetimeGoldEarned, 200);
  assert.equal(afterDanger.loseStreak, 2);
});

test('maps scratch card types to independent settlement progress keys', () => {
  assert.equal(getScratchCardSettlementProgressKey('basic-safe'), 'basicSafe');
  assert.equal(getScratchCardSettlementProgressKey('triple-match'), 'tripleMatch');
  assert.equal(getScratchCardSettlementProgressKey('risk-peek'), 'riskPeek');
  const tripleMatchStart = getScratchCardLevelProgress('triple-match', 0);
  const riskPeekStart = getScratchCardLevelProgress('risk-peek', 0);

  assert.equal(tripleMatchStart.level, 0);
  assert.equal(tripleMatchStart.current, 0);
  assert.equal(tripleMatchStart.target, 3);
  assert.equal(tripleMatchStart.ratio, 0);
  assert.equal(riskPeekStart.level, 0);
  assert.equal(riskPeekStart.current, 0);
  assert.equal(riskPeekStart.target, 3);
  assert.equal(riskPeekStart.ratio, 0);
});

test('creates scratch cards through the generic factory', () => {
  assert.equal(createScratchCard('basic-safe', { id: 50 }).type, 'basic-safe');
  assert.equal(createScratchCard('triple-match', { id: 51 }).type, 'triple-match');
  assert.equal(createScratchCard('risk-peek', { id: 52 }).type, 'risk-peek');
});

test('initializes and merges scratch card catalog progress in save data', () => {
  const initialSave = createInitialScratchLegendSave();
  const mergedSave = mergeScratchLegendSave({
    scratchCards: {
      basicSafe: {
        cardsSettled: 4,
      },
    },
  });

  assert.equal(initialSave.scratchCards.basicSafe.cardsSettled, 0);
  assert.equal(initialSave.scratchCards.riskPeek.cardsSettled, 0);
  assert.equal(mergedSave.scratchCards.basicSafe.cardsSettled, 4);
  assert.equal(mergedSave.scratchCards.riskPeek.cardsSettled, 0);
});

test('initializes workspace scratch cards as a list for multiple table cards', () => {
  const firstCard = createBasicSafeScratchCard({ id: 1, random: () => 0.72 });
  const secondCard = createBasicSafeScratchCard({ id: 2, random: () => 0.98 });
  const save = mergeScratchLegendSave({
    workspace: {
      scratchCards: [firstCard, secondCard],
      activeScratchCardId: 2,
    },
  });

  assert.equal(createInitialScratchLegendSave().workspace.scratchCards.length, 0);
  assert.equal(save.workspace.scratchCards.length, 2);
  assert.equal(getActiveScratchCard(save)?.id, 2);
});

test('migrates a legacy single active scratch card into the table card list', () => {
  const legacyCard = createBasicSafeScratchCard({ id: 9, random: () => 0.72 });
  const save = mergeScratchLegendSave({
    workspace: {
      activeScratchCard: legacyCard,
    },
  });

  assert.equal(save.workspace.activeScratchCard, null);
  assert.equal(save.workspace.scratchCards.length, 1);
  assert.equal(save.workspace.scratchCards[0]?.id, 9);
});

test('uses configured loan templates and repayment amount', () => {
  assert.equal(LOAN_PRINCIPAL, 5);
  assert.equal(LOAN_REPAYMENT_AMOUNT, 300);
  assert.equal(getNextLoanTemplate(0).id, 'loan-1');
  assert.equal(getNextLoanTemplate(1).id, 'loan-2');
  assert.equal(getNextLoanTemplate(2).id, 'loan-3');
  assert.equal(getNextLoanTemplate(3).id, 'loan-1');
});

test('keeps loan penalties as structured extensible config', () => {
  const templates = scratchLegendConfig.loans.templates;

  assert.deepEqual(
    templates.map((template) => template.penalty),
    [
      {
        type: 'wrong-card-every-n',
        everyCards: 20,
        enabled: true,
      },
      {
        type: 'scratch-brush-radius-delta',
        delta: -1,
        enabled: true,
      },
      {
        type: 'automation-speed-multiplier',
        multiplier: 0.7,
        enabled: false,
      },
    ],
  );
});

test('forces every twentieth purchased card when the wrong-card loan is active', () => {
  const loan = createLoanFromTemplate({
    id: 1,
    templateIndex: 0,
  });

  assert.equal(shouldForceWrongScratchCardForLoan([loan], 19), false);
  assert.equal(shouldForceWrongScratchCardForLoan([loan], 20), true);
  assert.equal(shouldForceWrongScratchCardForLoan([loan], 21), false);
  assert.equal(shouldForceWrongScratchCardForLoan([], 20), false);
});

test('stops forcing every twentieth purchased card after the wrong-card loan is repaid', () => {
  const loan = createLoanFromTemplate({
    id: 1,
    templateIndex: 0,
  });
  const activeLoans = [loan];
  const remainingLoans = activeLoans.filter((item) => item.id !== loan.id);

  assert.equal(shouldForceWrongScratchCardForLoan(activeLoans, 20), true);
  assert.equal(shouldForceWrongScratchCardForLoan(remainingLoans, 20), false);
});

test('creates a loan from the current template and repays it at the configured amount', () => {
  const loan = createLoanFromTemplate({
    id: 1,
    templateIndex: 0,
  });

  assert.equal(loan.id, 1);
  assert.equal(loan.title, '贷款 #1');
  assert.equal(loan.amount, 300);
  assert.equal(loan.signGold, 5);
  assert.deepEqual(loan.penalty, {
    type: 'wrong-card-every-n',
    everyCards: 20,
    enabled: true,
  });
  assert.equal(repayLoan(500, loan), 200);
});

test('describes repayment feedback from the repaid loan penalty', () => {
  const wrongCardLoan = createLoanFromTemplate({
    id: 1,
    templateIndex: 0,
  });
  const radiusLoan = createLoanFromTemplate({
    id: 2,
    templateIndex: 1,
  });
  const automationLoan = createLoanFromTemplate({
    id: 3,
    templateIndex: 2,
  });

  assert.deepEqual(getLoanRepaymentFeedback(wrongCardLoan), {
    statusLabel: '错卡惩罚解除',
    detailLabel: '每 20 张错卡已停止',
  });
  assert.deepEqual(getLoanRepaymentFeedback(radiusLoan), {
    statusLabel: '刮除范围恢复',
    detailLabel: '刮卡笔刷半径 +1',
  });
  assert.deepEqual(getLoanRepaymentFeedback(automationLoan), {
    statusLabel: '债务已偿清',
    detailLabel: '未启用惩罚已移除',
  });
});

test('only offers a loan phone when the player is broke and the table is empty', () => {
  assert.equal(
    shouldOfferLoanPhone({
      gold: 0,
      plateCount: 0,
      activeScratchCard: false,
      activeLoansCount: 0,
    }),
    true,
  );
  assert.equal(
    shouldOfferLoanPhone({
      gold: 0,
      plateCount: 1,
      activeScratchCard: false,
      activeLoansCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldOfferLoanPhone({
      gold: 0,
      plateCount: 0,
      activeScratchCard: true,
      activeLoansCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldOfferLoanPhone({
      gold: 0,
      plateCount: 0,
      activeScratchCard: false,
      activeLoansCount: 2,
    }),
    true,
  );
});
