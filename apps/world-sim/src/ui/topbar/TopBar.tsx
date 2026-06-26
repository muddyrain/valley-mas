import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatGameTime, SIM_SPEED_TIERS, type SimSpeedTier } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import styles from './TopBar.module.css';

const SPEED_SHORTCUTS: Record<SimSpeedTier, string> = {
  paused: '暂停',
  '0.5x': '0.5x (数字键2)',
  '1x': '1x (数字键3)',
  '2x': '2x (数字键4)',
  '4x': '4x (数字键5)',
  '8x': '8x (数字键6)',
  '16x': '16x (数字键7)',
};

export function TopBar() {
  const tick = useWorldSimStore((s) => s.tick);
  const speed = useWorldSimStore((s) => s.speed);
  const paused = useWorldSimStore((s) => s.paused);
  const status = useWorldSimStore((s) => s.status);
  const winnerFactionId = useWorldSimStore((s) => s.winnerFactionId);
  const factions = useWorldSimStore((s) => s.factions);
  const setSpeed = useWorldSimStore((s) => s.setSpeed);
  const togglePaused = useWorldSimStore((s) => s.togglePaused);
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
          <Button onClick={resetBattle} className={styles.primaryBtn}>
            重新开局
          </Button>
        ) : (
          <Button
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
          </Button>
        )}
        <ToggleGroup
          type="single"
          value={speed}
          onValueChange={(v) => v && setSpeed(v as SimSpeedTier)}
          className={styles.speedGroup}
          spacing={0}
        >
          {SIM_SPEED_TIERS.map((tier: SimSpeedTier) => (
            <Tooltip key={tier}>
              <TooltipTrigger asChild>
                <ToggleGroupItem value={tier} className={styles.speedBtn}>
                  {tier === 'paused' ? '||' : tier}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent side="bottom" className={styles.tooltip}>
                {SPEED_SHORTCUTS[tier]}
              </TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Button onClick={resetBattle} className={styles.dangerBtn} title="清空占领并回到 idle">
          重置战局
        </Button>
      </div>
      <div className={styles.right}>
        <ToggleGroup
          type="single"
          value={worldMode}
          onValueChange={(v) => v && setWorldMode(v as 'edit' | 'simulation')}
          className={styles.modeGroup}
          title="切换 Edit / Simulation 模式"
          spacing={0}
        >
          <ToggleGroupItem value="edit" className={styles.modeBtn}>
            Edit
          </ToggleGroupItem>
          <ToggleGroupItem value="simulation" className={styles.modeBtn}>
            Simulation
          </ToggleGroupItem>
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={toggleHud}>
              隐藏 HUD
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className={styles.tooltip}>
            录屏模式（按 H 切换）
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
