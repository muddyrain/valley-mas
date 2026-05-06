import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BASIC_CARD_UNLOCK_GOLD,
  canAffordWorkPlate,
  getBoundedPlatePosition,
  getNextUnlockMilestone,
  getRandomPlateSpawnPosition,
  getUnlockMilestoneById,
  getUnlockMilestoneProgress,
  getWorkLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  INITIAL_GOLD,
  isPointInsideCircleBounds,
  rollWorkReward,
  shouldCloseCleaningOverlay,
  shouldOpenPlateFromClick,
  shouldOpenPlateFromPointerUp,
  shouldShowScratchUnlockNotice,
  shouldShowWorkRiskNotice,
  shouldUnlockTrashCan,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  WORK_BROKEN_PLATE_PENALTY,
  WORK_PLATE_COST,
} from './game';
import { scratchLegendConfig } from './game-config';

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
  assert.equal(getWorkLevelProgress(0), 0);
  assert.equal(getWorkLevelProgress(4), 0.4);
  assert.equal(getWorkLevelProgress(10), 0);
  assert.equal(getWorkLevelProgress(18), 0.8);
  assert.equal(getWorkLevelProgress(100), 1);
});

test('caps work level at the phase one max level', () => {
  assert.equal(getWorkLevel(0), 0);
  assert.equal(getWorkLevel(9), 0);
  assert.equal(getWorkLevel(10), 1);
  assert.equal(getWorkLevel(99), 9);
  assert.equal(getWorkLevel(100), 10);
  assert.equal(getWorkLevel(148), 10);
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
  assert.equal(BASIC_CARD_UNLOCK_GOLD, 10);
  assert.equal(shouldShowScratchUnlockNotice(9, false), false);
  assert.equal(shouldShowScratchUnlockNotice(10, false), true);
  assert.equal(shouldShowScratchUnlockNotice(10, true), false);
});

test('reads cumulative gold milestones from config', () => {
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const nextMilestone = getUnlockMilestoneById('next-feature');

  assert.equal(scratchMilestone?.totalGoldEarned, 10);
  assert.equal(nextMilestone?.totalGoldEarned, 50);
  assert.equal(getNextUnlockMilestone(0)?.id, 'scratch-mode');
  assert.equal(getNextUnlockMilestone(10)?.id, 'next-feature');
  assert.equal(getNextUnlockMilestone(50), null);
});

test('uses cumulative gold to calculate the next unlock progress', () => {
  const scratchMilestone = getUnlockMilestoneById('scratch-mode');
  const nextMilestone = getUnlockMilestoneById('next-feature');

  assert.equal(getUnlockMilestoneProgress(0, scratchMilestone ?? null), 0);
  assert.equal(getUnlockMilestoneProgress(5, scratchMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(25, nextMilestone ?? null), 0.5);
  assert.equal(getUnlockMilestoneProgress(80, null), 1);
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

  assert.equal(normalReward.total, 3);
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

  assert.equal(protectedReward.total, 3);
  assert.equal(protectedReward.isBroken, false);
});

test('auto unlocks the trash can after three cleaned plates and risk phone after level one', () => {
  assert.equal(TRASH_CAN_UNLOCK_AFTER_PLATES, 3);
  assert.equal(shouldUnlockTrashCan(2, false), false);
  assert.equal(shouldUnlockTrashCan(3, false), true);
  assert.equal(shouldUnlockTrashCan(3, true), false);
  assert.equal(shouldShowWorkRiskNotice(0, false), false);
  assert.equal(shouldShowWorkRiskNotice(1, false), true);
  assert.equal(shouldShowWorkRiskNotice(1, true), false);
});
