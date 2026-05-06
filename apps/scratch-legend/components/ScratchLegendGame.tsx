'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CleaningCanvas } from '@/components/CleaningCanvas';
import {
  BASIC_CARD_UNLOCK_GOLD,
  canAffordWorkPlate,
  getBoundedPlatePosition,
  getNextUnlockMilestone,
  getRandomPlateSpawnPosition,
  getUnlockMilestoneProgress,
  getWorkLevel,
  getWorkLevelProgress,
  getWorkRewardAmountForLevel,
  INITIAL_GOLD,
  isBrokenPlateEnabled,
  isPointInsideCircleBounds,
  type PlatePosition,
  type PlayerState,
  rollWorkReward,
  shouldCloseCleaningOverlay,
  shouldOpenPlateFromPointerUp,
  shouldShowScratchUnlockNotice,
  shouldShowWorkRiskNotice,
  shouldUnlockTrashCan,
  TRASH_CAN_UNLOCK_AFTER_PLATES,
  WORK_ACTION_DURATION_MS,
  WORK_BROKEN_PLATE_CHANCE,
  WORK_BROKEN_PLATE_PENALTY,
  WORK_PLATE_COST,
  WORK_SAFE_REWARD_CHANCE,
  type WorkPhase,
  type WorkReward,
} from '@/lib/game';
import { scratchLegendConfig } from '@/lib/game-config';

const initialPlayer: PlayerState = {
  gold: INITIAL_GOLD,
  lifetimeGoldEarned: 0,
  plateCleaned: 0,
  cardsScratched: 0,
  loseStreak: 0,
  workLevel: 0,
};

const DESKTOP_PLATE_SIZE = scratchLegendConfig.work.plate.desktopSize;
const PLATE_ENTER_ANIMATION_MS = scratchLegendConfig.work.plate.enterAnimationMs;
const PLATE_DRAG_HOLD_MS = scratchLegendConfig.work.drag.holdMs;
const PLATE_DRAG_MOVE_THRESHOLD = scratchLegendConfig.work.drag.moveThreshold;

type WorkPlate = {
  id: number;
  reward: WorkReward;
  position: PlatePosition;
  seed: number;
};

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

type SidebarTab = 'cards' | 'tools';
type UnlockToast = 'trash' | 'scratch' | null;

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LockedCard({
  title,
  subtitle,
  price,
}: {
  title: string;
  subtitle: string;
  price: string;
}) {
  return (
    <div className="locked-card" aria-disabled="true">
      <div className="ticket-icon">▧</div>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <em>{price}</em>
    </div>
  );
}

export function ScratchLegendGame() {
  const [player, setPlayer] = useState<PlayerState>(initialPlayer);
  const [phase, setPhase] = useState<WorkPhase>('idle');
  const [, setCleanProgress] = useState(0);
  const [plates, setPlates] = useState<WorkPlate[]>([]);
  const [activePlateId, setActivePlateId] = useState<number | null>(null);
  const [cleaningStartedAt, setCleaningStartedAt] = useState<number | null>(null);
  const [draggingPlateId, setDraggingPlateId] = useState<number | null>(null);
  const [liftedPlateId, setLiftedPlateId] = useState<number | null>(null);
  const [enteringPlateIds, setEnteringPlateIds] = useState<number[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('cards');
  const [trashCanUnlocked, setTrashCanUnlocked] = useState(false);
  const [workRiskMessageDismissed, setWorkRiskMessageDismissed] = useState(false);
  const [scratchMessageDismissed, setScratchMessageDismissed] = useState(false);
  const [unlockToast, setUnlockToast] = useState<UnlockToast>(null);
  const [trashHoverPlateId, setTrashHoverPlateId] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const trashCanRef = useRef<HTMLDivElement | null>(null);
  const cleaningPlateRef = useRef<HTMLDivElement | null>(null);
  const platePointerRef = useRef<PlatePointerState | null>(null);
  const nextPlateIdRef = useRef(1);
  const plateEnterTimerRefs = useRef<number[]>([]);
  const unlockToastTimerRef = useRef<number | null>(null);
  const scratchUnlockToastShownRef = useRef(false);

  const nextUnlockMilestone = getNextUnlockMilestone(player.lifetimeGoldEarned);
  const finalUnlockMilestone =
    scratchLegendConfig.progression.unlockMilestones[
      scratchLegendConfig.progression.unlockMilestones.length - 1
    ];
  const unlockProgressTarget =
    nextUnlockMilestone?.totalGoldEarned ?? finalUnlockMilestone.totalGoldEarned;
  const unlockProgressCurrent = Math.min(player.lifetimeGoldEarned, unlockProgressTarget);
  const scratchUnlockProgress = getUnlockMilestoneProgress(
    player.lifetimeGoldEarned,
    nextUnlockMilestone,
  );
  const workLevel = getWorkLevel(player.plateCleaned);
  const workLevelProgress = getWorkLevelProgress(player.plateCleaned);
  const previewRewardAmount = getWorkRewardAmountForLevel(workLevel);
  const brokenPlateEnabled = isBrokenPlateEnabled(workLevel);
  const workSafeRewardPercent = `${Math.round(
    (brokenPlateEnabled ? WORK_SAFE_REWARD_CHANCE : 1) * 100,
  )}%`;
  const workBrokenPlatePercent = `${Math.round(WORK_BROKEN_PLATE_CHANCE * 100)}%`;
  const canStartWork =
    (phase === 'idle' || phase === 'plateSpawned') && canAffordWorkPlate(player.gold);
  const isCleaningView = phase === 'cleaning' || phase === 'claimable';
  const activePlate = activePlateId ? plates.find((plate) => plate.id === activePlateId) : null;
  const activeReward = activePlate?.reward ?? {
    base: previewRewardAmount,
    total: previewRewardAmount,
    isCrit: false,
    isBroken: false,
  };
  const workRiskNoticeVisible = shouldShowWorkRiskNotice(workLevel, workRiskMessageDismissed);
  const scratchUnlockNoticeVisible = shouldShowScratchUnlockNotice(
    player.lifetimeGoldEarned,
    scratchMessageDismissed,
  );
  const phoneNoticeVisible = workRiskNoticeVisible || scratchUnlockNoticeVisible;

  const statusLabel = useMemo(() => {
    if (phase === 'idle' && plates.length === 0) {
      return '等待接单';
    }
    if (phase === 'plateSpawned') {
      return `待洗盘子 ${plates.length}`;
    }
    if (phase === 'cleaning') {
      return '清洁中';
    }
    return '可领取';
  }, [phase, plates.length]);

  useEffect(() => {
    return () => {
      if (platePointerRef.current?.holdTimer) {
        clearTimeout(platePointerRef.current.holdTimer);
      }

      for (const timer of plateEnterTimerRefs.current) {
        window.clearTimeout(timer);
      }

      if (unlockToastTimerRef.current) {
        window.clearTimeout(unlockToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      shouldShowScratchUnlockNotice(player.lifetimeGoldEarned, scratchMessageDismissed) &&
      !scratchUnlockToastShownRef.current
    ) {
      scratchUnlockToastShownRef.current = true;
      if (unlockToastTimerRef.current) {
        window.clearTimeout(unlockToastTimerRef.current);
      }

      setUnlockToast('scratch');
      unlockToastTimerRef.current = window.setTimeout(() => {
        setUnlockToast(null);
        unlockToastTimerRef.current = null;
      }, 1800);
    }
  }, [player.lifetimeGoldEarned, scratchMessageDismissed]);

  useEffect(() => {
    if (shouldUnlockTrashCan(player.plateCleaned, trashCanUnlocked)) {
      setTrashCanUnlocked(true);
      if (unlockToastTimerRef.current) {
        window.clearTimeout(unlockToastTimerRef.current);
      }

      setUnlockToast('trash');
      unlockToastTimerRef.current = window.setTimeout(() => {
        setUnlockToast(null);
        unlockToastTimerRef.current = null;
      }, 1800);
    }
  }, [player.plateCleaned, trashCanUnlocked]);

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

    setPlates((current) =>
      current.map((plate) => (plate.id === plateId ? { ...plate, position } : plate)),
    );
  }

  function isPointerOverTrashCan(clientX: number, clientY: number) {
    const trashBounds = trashCanRef.current?.getBoundingClientRect();

    if (!trashBounds || !trashCanUnlocked) {
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

  function startWork() {
    if (!canStartWork) {
      return;
    }

    const plateId = nextPlateIdRef.current;
    const goldAfterCost = player.gold - WORK_PLATE_COST;
    const plateReward = rollWorkReward({
      workOrderIndex: plateId - 1,
      gold: goldAfterCost,
      workLevel,
    });

    setCleanProgress(0);
    setPlayer((current) => ({
      ...current,
      gold: current.gold - WORK_PLATE_COST,
    }));
    setPlates((current) => [
      ...current,
      {
        id: plateId,
        reward: plateReward,
        position: getRandomPlateSpawnPosition(),
        seed: plateId,
      },
    ]);
    nextPlateIdRef.current += 1;
    setEnteringPlateIds((current) => [...current, plateId]);
    const enterTimer = window.setTimeout(() => {
      setEnteringPlateIds((current) => current.filter((id) => id !== plateId));
    }, PLATE_ENTER_ANIMATION_MS);
    plateEnterTimerRefs.current.push(enterTimer);
    setPhase('plateSpawned');
  }

  function openCleaningView(plateId: number) {
    if (phase === 'plateSpawned') {
      resetPlatePointer();
      setCleanProgress(0);
      setActivePlateId(plateId);
      setCleaningStartedAt(Date.now());
      setPhase('cleaning');
    }
  }

  function closeCleaningView() {
    if (!activePlateId) {
      return;
    }

    setCleanProgress(0);
    setActivePlateId(null);
    setCleaningStartedAt(null);
    setPhase(plates.length > 0 ? 'plateSpawned' : 'idle');
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

  function handlePlatePointerDown(event: React.PointerEvent<HTMLButtonElement>, plate: WorkPlate) {
    if (phase !== 'plateSpawned') {
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
      setPlates((current) => {
        const remainingPlates = current.filter((plate) => plate.id !== pointerState.plateId);
        setPhase(remainingPlates.length > 0 ? 'plateSpawned' : 'idle');
        return remainingPlates;
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

  function completeCleaning() {
    const elapsed = Date.now() - (cleaningStartedAt ?? Date.now());
    const delay = Math.max(0, WORK_ACTION_DURATION_MS - elapsed);

    window.setTimeout(() => {
      setPhase('claimable');
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

    setPlayer((current) => ({
      ...current,
      gold: Math.max(0, current.gold + claimedPlate.reward.total),
      lifetimeGoldEarned: current.lifetimeGoldEarned + Math.max(0, claimedPlate.reward.total),
      plateCleaned: current.plateCleaned + 1,
      workLevel: getWorkLevel(current.plateCleaned + 1),
    }));
    setPlates((current) => {
      const remainingPlates = current.filter((plate) => plate.id !== claimedPlate.id);
      setPhase(remainingPlates.length > 0 ? 'plateSpawned' : 'idle');
      return remainingPlates;
    });
    setActivePlateId(null);
    setCleanProgress(0);
  }

  return (
    <main className="scratch-shell">
      <section className="game-frame" aria-label="刮出传说游戏界面">
        <aside className="left-panel">
          <div className="coin-board">
            <div className="coin-row">
              <span className="coin-icon">$</span>
              <strong>{player.gold}</strong>
            </div>
            <div className="ticket-progress">
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

              <div className="sidebar-note">
                <strong>下一目标</strong>
                <span>
                  {nextUnlockMilestone
                    ? `累计赚到 ${nextUnlockMilestone.totalGoldEarned} 金币解锁${nextUnlockMilestone.label}`
                    : '累计金币里程碑已全部达成'}
                </span>
              </div>
            </>
          ) : (
            <div className="tool-panel">
              {trashCanUnlocked ? (
                <div className="tool-card available">
                  <span className="tool-icon trash-preview" />
                  <div>
                    <strong>垃圾桶</strong>
                    <span>已解锁，可把桌面脏盘子拖进去直接处理掉。</span>
                  </div>
                  <em>已解锁</em>
                </div>
              ) : (
                <>
                  <div className="tool-card locked placeholder">
                    <span className="tool-lock">锁</span>
                    <div>
                      <strong>未解锁</strong>
                      <span>清洁 {TRASH_CAN_UNLOCK_AFTER_PLATES} 个盘子后自动解锁垃圾桶。</span>
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
          </div>

          <div className="wood-table" ref={tableRef}>
            <div className={`phone ${phoneNoticeVisible ? 'ringing' : ''}`} aria-hidden="true">
              <span className="phone-dial" />
            </div>

            {phase === 'idle' && (
              <div className="idle-hint">
                <strong>从左侧选择日常工作</strong>
                <span>先赚启动金，再去买第一张刮刮卡。</span>
              </div>
            )}

            {phase === 'plateSpawned' &&
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

            {trashCanUnlocked && (
              <div
                ref={trashCanRef}
                className={`trash-can ${trashHoverPlateId ? 'open' : ''}`}
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
                <strong>{unlockToast === 'trash' ? '已解锁' : '刮刮乐模式已解锁'}</strong>
                <span>{unlockToast === 'trash' ? '垃圾桶' : '等待阶段二开启'}</span>
              </div>
            )}

            {phoneNoticeVisible && (
              <div className="phone-message">
                {scratchUnlockNoticeVisible ? (
                  <>
                    <strong>电话提醒</strong>
                    <span>
                      你已经累计赚到 {BASIC_CARD_UNLOCK_GOLD} 金币了，刮刮乐模式可以解锁了，
                      阶段二会开始接上主玩法。
                    </span>
                    <button type="button" onClick={() => setScratchMessageDismissed(true)}>
                      我知道了
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
                        <b>-${WORK_BROKEN_PLATE_PENALTY}</b>
                      </div>
                    </div>
                    <button type="button" onClick={() => setWorkRiskMessageDismissed(true)}>
                      我知道了
                    </button>
                  </>
                )}
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
                      active={isCleaningView}
                      onProgressChange={setCleanProgress}
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
                    {activeReward.total >= 0
                      ? `$${activeReward.total}`
                      : `-$${Math.abs(activeReward.total)}`}
                  </button>
                </div>

                <div className="work-info-card" data-cleaning-control="true">
                  <strong>日常工作</strong>
                  <span>{activeReward.isBroken ? '这次盘子被擦坏了' : '挣得不多，都是辛苦钱'}</span>
                  <div className="info-line">
                    <em>中奖率</em>
                    <b>{workSafeRewardPercent}</b>
                  </div>
                  <div className="info-line">
                    <em>{activeReward.isBroken ? '碎盘扣除' : '基础收益'}</em>
                    <b>
                      {activeReward.total >= 0
                        ? `$${activeReward.total}`
                        : `-$${Math.abs(activeReward.total)}`}
                    </b>
                  </div>
                  {brokenPlateEnabled && (
                    <div className="info-line">
                      <em>碎盘概率</em>
                      <b>
                        {workBrokenPlatePercent} / -${WORK_BROKEN_PLATE_PENALTY}
                      </b>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="right-panel">
          <section className="upgrade-panel">
            <h2>工作面板</h2>
            <div className="upgrade-row">
              <span>日常工作</span>
              <strong>等级 {workLevel}</strong>
            </div>
            <div className="upgrade-row">
              <span>中奖率</span>
              <strong>{workSafeRewardPercent}</strong>
            </div>
            <div className="upgrade-row">
              <span>基础收益</span>
              <strong>${previewRewardAmount}</strong>
            </div>
            <div className="upgrade-row">
              <span>盘子成本</span>
              <strong>${WORK_PLATE_COST}</strong>
            </div>
            <button className="upgrade-button" type="button" disabled>
              升级 $10
            </button>
            <p>升级效果将在后续阶段解锁。</p>
          </section>

          <section className="locked-section">
            <h2>未解锁</h2>
            <LockedCard title="普通刮刮卡" subtitle="最高奖金 $1,000" price="$100" />
            <LockedCard title="黄金刮刮卡" subtitle="最高奖金 $100,000" price="$1,000" />
            <LockedCard title="自动刮卡" subtitle="后续阶段解锁" price="锁定" />
          </section>
        </aside>
      </section>
    </main>
  );
}
