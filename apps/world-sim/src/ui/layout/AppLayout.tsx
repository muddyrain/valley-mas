import { useCallback, useEffect } from 'react';
import { useWorldSimStore } from '@/state';
import { MapCanvas } from '@/ui/canvas/MapCanvas';
import { LogPanel } from '@/ui/logpanel/LogPanel';
import { ReplayBar } from '@/ui/replaybar/ReplayBar';
import { Sidebar } from '@/ui/sidebar/Sidebar';
import { TopBar } from '@/ui/topbar/TopBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const hudVisible = useWorldSimStore((s) => s.hudVisible);
  const toggleHud = useWorldSimStore((s) => s.toggleHud);

  // 快捷键：H 切换 HUD，1-7 切换速度
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 跳过输入框
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // 跳过带修饰键的组合键，避免与浏览器默认快捷键冲突
      // Ctrl+H(历史)/Cmd+H(隐藏窗口)/Ctrl+1~8(切换标签) 等
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHud();
        return;
      }
      // 1-7 对应 SIM_SPEED_TIERS: paused/0.5x/1x/2x/4x/8x/16x
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 7) {
        e.preventDefault();
        const tiers = ['paused', '0.5x', '1x', '2x', '4x', '8x', '16x'] as const;
        useWorldSimStore.getState().setSpeed(tiers[n - 1]);
      }
    },
    [toggleHud],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={styles.root} data-hud-visible={hudVisible}>
      {hudVisible && (
        <header className={styles.topbar}>
          <TopBar />
        </header>
      )}
      <main className={styles.main}>
        <div className={styles.canvas}>
          <MapCanvas />
          {!hudVisible && (
            <div className={styles.hudHint}>
              按 <kbd>H</kbd> 恢复 HUD
            </div>
          )}
        </div>
        {hudVisible && (
          <aside className={styles.sidebar}>
            <Sidebar />
          </aside>
        )}
      </main>
      {hudVisible && (
        <div className={styles.replaybar}>
          <ReplayBar />
        </div>
      )}
      {hudVisible && (
        <footer className={styles.logbar}>
          <LogPanel />
        </footer>
      )}
    </div>
  );
}
