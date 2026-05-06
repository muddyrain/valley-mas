'use client';

import { useMemo, useState } from 'react';
import { CleaningCanvas } from '@/components/CleaningCanvas';
import {
  BASIC_CARD_COST,
  type PlayerState,
  rollWorkReward,
  WORK_ACTION_DURATION_MS,
  type WorkPhase,
  type WorkReward,
} from '@/lib/game';

const initialPlayer: PlayerState = {
  gold: 0,
  plateCleaned: 0,
  cardsScratched: 0,
  loseStreak: 0,
  workLevel: 0,
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

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
  const [cleanProgress, setCleanProgress] = useState(0);
  const [reward, setReward] = useState<WorkReward>(() => rollWorkReward());
  const [plateSeed, setPlateSeed] = useState(0);
  const [cleaningStartedAt, setCleaningStartedAt] = useState<number | null>(null);

  const basicCardProgress = Math.min(1, player.gold / BASIC_CARD_COST);
  const displayedProgress = phase === 'claimable' ? 1 : cleanProgress;
  const canStartWork = phase === 'idle';
  const isCleaningView = phase === 'cleaning' || phase === 'claimable';

  const statusLabel = useMemo(() => {
    if (phase === 'idle') {
      return '等待接单';
    }
    if (phase === 'plateSpawned') {
      return '盘子已上桌';
    }
    if (phase === 'cleaning') {
      return '清洁中';
    }
    return '可领取';
  }, [phase]);

  function startWork() {
    if (!canStartWork) {
      return;
    }

    setReward(rollWorkReward());
    setCleanProgress(0);
    setPlateSeed((value) => value + 1);
    setPhase('plateSpawned');
  }

  function openCleaningView() {
    if (phase === 'plateSpawned') {
      setCleanProgress(0);
      setCleaningStartedAt(Date.now());
      setPhase('cleaning');
    }
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

    setPlayer((current) => ({
      ...current,
      gold: current.gold + reward.total,
      plateCleaned: current.plateCleaned + 1,
    }));
    setCleanProgress(0);
    setPhase('idle');
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
                {player.gold}/{BASIC_CARD_COST}
              </span>
              <div className="progress-track">
                <div
                  className="progress-fill amber"
                  style={{ width: `${basicCardProgress * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="tab-row">
            <button className="tab active" type="button">
              刮刮卡
            </button>
            <button className="tab" type="button" disabled>
              辅助道具
            </button>
          </div>

          <button
            className={`work-card ${canStartWork ? '' : 'busy'}`}
            type="button"
            onClick={startWork}
          >
            <span className="work-icon">
              <span className="mini-plate" />
              <span className="mini-sponge" />
            </span>
            <span className="work-copy">
              <strong>日常工作</strong>
              <em>${reward.total}</em>
              <small>等级 {player.workLevel}</small>
            </span>
            <span className="work-meter" aria-hidden="true">
              <span style={{ width: `${Math.max(18, displayedProgress * 100)}%` }} />
            </span>
          </button>

          <div className="sidebar-note">
            <strong>下一目标</strong>
            <span>攒够 ${BASIC_CARD_COST} 解锁低级刮刮卡</span>
          </div>
        </aside>

        <section className="table-stage">
          <div className="stage-topbar">
            <StatusPill label="状态" value={statusLabel} />
            <StatusPill label="已洗盘子" value={`${player.plateCleaned}`} />
            <StatusPill label="刮卡次数" value={`${player.cardsScratched}`} />
          </div>

          <div className="wood-table">
            <div className="phone" aria-hidden="true" />

            {phase === 'idle' && (
              <div className="idle-hint">
                <strong>从左侧选择日常工作</strong>
                <span>先赚启动金，再去买第一张刮刮卡。</span>
              </div>
            )}

            {phase === 'plateSpawned' && (
              <button
                className="small-dirty-plate"
                type="button"
                onClick={openCleaningView}
                aria-label="点击脏盘子开始清洁"
              >
                <span />
              </button>
            )}

            {isCleaningView && (
              <div className="cleaning-view">
                <div className="plate-shell">
                  <div className="plate" key={plateSeed}>
                    <div className="plate-rim" />
                    <CleaningCanvas
                      active={phase === 'cleaning'}
                      onProgressChange={setCleanProgress}
                      onComplete={completeCleaning}
                    />
                  </div>
                  <button
                    className="claim-button"
                    type="button"
                    onClick={claimReward}
                    disabled={phase !== 'claimable'}
                  >
                    ${reward.total}
                  </button>
                </div>

                <div className="work-info-card">
                  <strong>日常工作</strong>
                  <span>挣得不多，都是辛苦钱</span>
                  <div className="info-line">
                    <em>中奖率</em>
                    <b>100%</b>
                  </div>
                  <div className="info-line">
                    <em>基础收益</em>
                    <b>${reward.total}</b>
                  </div>
                  <div className="info-line">
                    <em>清洁进度</em>
                    <b>{formatPercent(displayedProgress)}</b>
                  </div>
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
              <strong>等级 {player.workLevel + 1}</strong>
            </div>
            <div className="upgrade-row">
              <span>中奖率</span>
              <strong>100%</strong>
            </div>
            <div className="upgrade-row">
              <span>基础收益</span>
              <strong>${reward.total}</strong>
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
