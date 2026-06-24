import { formatGameTime, SIM_SPEED_TIERS, type SimSpeedTier } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import styles from './TopBar.module.css';

export function TopBar() {
  const tick = useWorldSimStore((s) => s.tick);
  const speed = useWorldSimStore((s) => s.speed);
  const paused = useWorldSimStore((s) => s.paused);
  const status = useWorldSimStore((s) => s.status);
  const winnerFactionId = useWorldSimStore((s) => s.winnerFactionId);
  const factions = useWorldSimStore((s) => s.factions);
  const setSpeed = useWorldSimStore((s) => s.setSpeed);
  const togglePaused = useWorldSimStore((s) => s.togglePaused);
  const advanceTick = useWorldSimStore((s) => s.advanceTick);
  const resetBattle = useWorldSimStore((s) => s.resetBattle);
  const toggleHud = useWorldSimStore((s) => s.toggleHud);
  const worldMode = useWorldSimStore((s) => s.worldMode);
  const setWorldMode = useWorldSimStore((s) => s.setWorldMode);

  const winner =
    winnerFactionId == null ? null : (factions.find((f) => f.id === winnerFactionId) ?? null);

  const banner = (() => {
    if (status === 'victory') {
      return {
        kind: 'victory' as const,
        text: winner ? `${winner.name}（${winner.leader}）一统天下` : '一统天下',
      };
    }
    if (status === 'stalemate') {
      return {
        kind: 'stalemate' as const,
        text: winner ? `${winner.name} 已无对手，进入僵局` : '各方相持，进入僵局',
      };
    }
    return null;
  })();

  const ended = status === 'victory' || status === 'stalemate';
  const liveFactions = factions.filter((f) => (f.regions ?? 0) > 0).length;
  const isEdit = worldMode === 'edit';
  const canStart = !ended && !isEdit && liveFactions >= 1;

  return (
    <div className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.title}>历史势力争霸沙盘</span>
        <span className={styles.subtitle}>World Sim · Phase 9</span>
      </div>
      <div className={styles.center}>
        <div className={styles.tickGroup}>
          <span className={styles.tickLabel}>时间</span>
          <span className={styles.tickValue}>{formatGameTime(tick)}</span>
        </div>
        {banner ? (
          <span className={styles.banner} data-kind={banner.kind}>
            {banner.text}
          </span>
        ) : (
          <span className={styles.statusChip} data-status={status} data-paused={paused}>
            {status === 'running' ? (paused ? '暂停中' : '推演中') : '待命'}
          </span>
        )}
        {ended ? (
          <button type="button" onClick={resetBattle} className={styles.primaryBtn}>
            重新开局
          </button>
        ) : (
          <button
            type="button"
            onClick={togglePaused}
            disabled={!canStart}
            className={styles.primaryBtn}
            title={
              canStart
                ? paused
                  ? status === 'idle'
                    ? '开始推演'
                    : '继续推演'
                  : '暂停推演'
                : '至少需要一个已出生的势力'
            }
          >
            {paused ? (status === 'idle' ? '▶ 开始' : '▶ 继续') : '⏸ 暂停'}
          </button>
        )}
        <div className={styles.speedGroup}>
          {SIM_SPEED_TIERS.map((tier: SimSpeedTier) => (
            <button
              key={tier}
              type="button"
              data-active={speed === tier}
              className={styles.speedBtn}
              onClick={() => setSpeed(tier)}
            >
              {tier === 'paused' ? '||' : tier}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => advanceTick(1)}
          disabled={ended || !canStart}
          title="手动推进 1 季（调试）"
        >
          +1 季
        </button>
        <button
          type="button"
          onClick={resetBattle}
          className={styles.dangerBtn}
          title="清空占领并回到 idle"
        >
          重置战局
        </button>
      </div>
      <div className={styles.right}>
        <div className={styles.modeGroup} title="切换 Edit / Simulation 模式">
          <button
            type="button"
            className={styles.modeBtn}
            data-active={worldMode === 'edit'}
            onClick={() => setWorldMode('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={styles.modeBtn}
            data-active={worldMode === 'simulation'}
            onClick={() => setWorldMode('simulation')}
          >
            Simulation
          </button>
        </div>
        <button type="button" onClick={toggleHud} title="按 H 隐藏 HUD（录屏模式预留）">
          隐藏 HUD
        </button>
      </div>
    </div>
  );
}
