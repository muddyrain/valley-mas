import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceBasicSafeScratchCardProgress,
  BASIC_CARD_UNLOCK_GOLD,
  BASIC_SAFE_CARD_PRICE,
  canAffordWorkPlate,
  canBuyBasicSafeScratchCard,
  canBuyTrashCan,
  createBasicSafeScratchCard,
  createLoanFromTemplate,
  getBasicSafeScratchCardPrizePoolForLevel,
  getBasicSafeScratchCardPrizeTier,
  getBoundedPlatePosition,
  getNextLoanTemplate,
  getNextUnlockMilestone,
  getRandomPlateSpawnPosition,
  getScratchCardLevelProgress,
  getUnlockMilestoneById,
  getUnlockMilestoneCurrentValue,
  getUnlockMilestoneProgress,
  getUnlockMilestoneThreshold,
  getWorkLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  INITIAL_GOLD,
  isPointInsideCircleBounds,
  isScratchCardWinningResult,
  LOAN_PRINCIPAL,
  LOAN_REPAYMENT_AMOUNT,
  repayLoan,
  rollWorkReward,
  settleBasicSafeScratchCard,
  shouldCloseCleaningOverlay,
  shouldOfferLoanPhone,
  shouldOpenPlateFromClick,
  shouldOpenPlateFromPointerUp,
  shouldRevealFullScratchCover,
  shouldShowScratchCover,
  shouldShowScratchUnlockNotice,
  shouldShowWorkRiskNotice,
  shouldUnlockTrashCan,
  TRASH_CAN_PRICE,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  WORK_BROKEN_PLATE_PENALTY,
  WORK_PLATE_COST,
} from './game';
import { scratchLegendConfig } from './game-config';
import {
  createInitialScratchLegendSave,
  getActiveScratchCard,
  getActiveWorkPlate,
  isUnlockMilestoneUnlocked,
  mergeScratchLegendSave,
  syncScratchLegendSave,
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

test('starts the game with enough gold to buy exactly one work plate', () => {
  assert.equal(INITIAL_GOLD, 1);
  assert.equal(WORK_PLATE_COST, 1);
  assert.equal(canAffordWorkPlate(INITIAL_GOLD), true);
  assert.equal(canAffordWorkPlate(0), false);
});

test('unlocks scratch mode notice at ten gold', () => {
  assert.equal(BASIC_CARD_UNLOCK_GOLD, 13);
  assert.equal(shouldShowScratchUnlockNotice(12, false), false);
  assert.equal(shouldShowScratchUnlockNotice(13, false), true);
  assert.equal(shouldShowScratchUnlockNotice(13, true), false);
});

test('reads segmented proficiency milestones from config', () => {
  const trashMilestone = getUnlockMilestoneById('trash-can');
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const nextMilestone = getUnlockMilestoneById('next-feature');

  assert.equal(trashMilestone?.requiredProficiency, 3);
  assert.equal(scratchMilestone?.requiredProficiency, 10);
  assert.equal(nextMilestone?.requiredProficiency, 50);
  assert.equal(getUnlockMilestoneThreshold('trash-can'), 3);
  assert.equal(getUnlockMilestoneThreshold('scratch-mode'), 13);
  assert.equal(getUnlockMilestoneThreshold('next-feature'), 63);
  assert.equal(getNextUnlockMilestone(0)?.id, 'trash-can');
  assert.equal(getNextUnlockMilestone(3)?.id, 'scratch-mode');
  assert.equal(getNextUnlockMilestone(13)?.id, 'next-feature');
});

test('uses segmented proficiency to calculate the next unlock progress', () => {
  const trashMilestone = getUnlockMilestoneById('trash-can');
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const nextMilestone = getUnlockMilestoneById('next-feature');

  assert.equal(getUnlockMilestoneCurrentValue(0, trashMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(3, scratchMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneCurrentValue(8, scratchMilestone ?? null), 5);
  assert.equal(getUnlockMilestoneCurrentValue(13, nextMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneProgress(0, trashMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneProgress(8, scratchMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(38, nextMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(220, null), 1);
});

test('creates a persistable save state with separated player, unlock, notice and workspace data', () => {
  const save = createInitialScratchLegendSave();

  assert.equal(save.version, 1);
  assert.equal(save.player.gold, 1);
  assert.equal(save.player.lifetimeGoldEarned, 0);
  assert.equal(save.unlocks.trashCanUnlocked, false);
  assert.equal(save.unlocks.trashCanPurchased, false);
  assert.equal(save.unlocks.unlockedMilestones['scratch-mode'], false);
  assert.equal(save.notices.workRiskMessageDismissed, false);
  assert.equal(save.workspace.phase, 'idle');
  assert.equal(save.workspace.nextPlateId, 1);
});

test('syncs save state derived unlocks and persisted work level', () => {
  const save = syncScratchLegendSave({
    ...createInitialScratchLegendSave(),
    player: {
      gold: 9,
      lifetimeGoldEarned: 64,
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
  assert.equal(isUnlockMilestoneUnlocked(save, 'next-feature'), true);
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
  assert.equal(save.player.workLevel, 0);
  assert.equal(save.notices.scratchMessageDismissed, true);
  assert.equal(save.notices.workRiskMessageDismissed, false);
  assert.equal(save.workspace.phase, 'plateSpawned');
  assert.equal(save.workspace.nextPlateId, 1);
  assert.equal(isUnlockMilestoneUnlocked(save, 'scratch-mode'), true);
});

test('finds the current active plate from the save workspace', () => {
  const save = createInitialScratchLegendSave();
  save.workspace.plates.push({
    id: 3,
    reward: { base: 2, total: 2, isCrit: false, isBroken: false },
    position: { xPercent: 50, yPercent: 50 },
    seed: 3,
  });
  save.workspace.activePlateId = 3;

  assert.equal(getActiveWorkPlate(save)?.id, 3);
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
    gold: 4,
    workLevel: 2,
    random: () => 0.9,
  });

  assert.equal(brokenReward.total, -WORK_BROKEN_PLATE_PENALTY);
  assert.equal(brokenReward.isBroken, true);

  const protectedReward = rollWorkReward({
    workOrderIndex: 0,
    gold: 3,
    workLevel: 2,
    random: () => 0.99,
  });

  assert.equal(protectedReward.total, getWorkRewardAmountForLevel(2));
  assert.equal(protectedReward.isBroken, false);
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
  assert.equal(shouldShowWorkRiskNotice(0, false), false);
  assert.equal(shouldShowWorkRiskNotice(1, false), true);
  assert.equal(shouldShowWorkRiskNotice(1, true), false);
});

test('uses configured price and unlock gate for the first safe scratch card', () => {
  assert.equal(BASIC_SAFE_CARD_PRICE, scratchLegendConfig.scratchCards.basicSafe.price);
  assert.equal(BASIC_SAFE_CARD_PRICE, 10);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 9, lifetimeGoldEarned: 13 }), false);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 10, lifetimeGoldEarned: 12 }), false);
  assert.equal(canBuyBasicSafeScratchCard({ gold: 10, lifetimeGoldEarned: 13 }), true);
});

test('tracks basic safe scratch card level progress by settled card count', () => {
  const levelOne = getScratchCardLevelProgress('basic-safe', 0);
  const almostLevelTwo = getScratchCardLevelProgress('basic-safe', 2);
  const levelTwo = getScratchCardLevelProgress('basic-safe', 3);

  assert.equal(levelOne.level, 1);
  assert.equal(levelOne.current, 0);
  assert.equal(levelOne.target, 3);
  assert.equal(levelOne.ratio, 0);
  assert.equal(almostLevelTwo.level, 1);
  assert.equal(almostLevelTwo.current, 2);
  assert.equal(almostLevelTwo.target, 3);
  assert.equal(levelTwo.level, 2);
  assert.equal(levelTwo.current, 0);
  assert.equal(levelTwo.target, 10);
});

test('uses level adjusted payouts for the basic safe scratch card prize pool', () => {
  const levelOnePool = getBasicSafeScratchCardPrizePoolForLevel(1);
  const levelTwoPool = getBasicSafeScratchCardPrizePoolForLevel(2);

  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-fire')?.payout, 10);
  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-cash')?.payout, 25);
  assert.equal(levelOnePool.find((tier) => tier.id === 'pair-bag')?.payout, 50);
  assert.equal(levelTwoPool.find((tier) => tier.id === 'pair-fire')?.payout, 13);
  assert.equal(levelTwoPool.find((tier) => tier.id === 'pair-cash')?.payout, 32);
  assert.equal(levelTwoPool.find((tier) => tier.id === 'pair-bag')?.payout, 65);
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
  assert.equal(card.result.payout, 13);
  assert.equal(card.result.hasPenaltySymbol, false);
  assert.equal(card.result.canDiscard, false);
});

test('rolls all local MVP prize tiers from deterministic random values', () => {
  const cases = [
    [0, 'no-pair', 0],
    [0.72, 'pair-fire', 10],
    [0.92, 'pair-cash', 25],
    [0.98, 'pair-bag', 50],
  ] as const;

  for (const [randomValue, tierId, payout] of cases) {
    const tier = getBasicSafeScratchCardPrizeTier(() => randomValue, 1);

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
  assert.equal(shouldRevealFullScratchCover(0.67), false);
  assert.equal(shouldRevealFullScratchCover(0.68), true);
  assert.equal(shouldShowScratchCover('scratching', 0), true);
  assert.equal(shouldShowScratchCover('scratching', 0.68), false);
  assert.equal(shouldShowScratchCover('claimable', 0), false);
});

test('settles a completed two-win card only when a pair appears', () => {
  const player = {
    gold: 10,
    lifetimeGoldEarned: 14,
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
  assert.equal(getScratchCardLevelProgress('basic-safe', nextProgress.cardsSettled).level, 2);
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
  assert.equal(mergedSave.scratchCards.basicSafe.cardsSettled, 4);
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

test('creates a loan from the current template and repays it at the configured amount', () => {
  const loan = createLoanFromTemplate({
    id: 1,
    templateIndex: 0,
  });

  assert.equal(loan.id, 1);
  assert.equal(loan.title, '贷款 #1');
  assert.equal(loan.amount, 300);
  assert.equal(loan.signGold, 5);
  assert.equal(repayLoan(500, loan), 200);
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
