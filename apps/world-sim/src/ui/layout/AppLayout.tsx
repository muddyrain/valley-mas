import { useWorldSimStore } from '@/state';
import { MapCanvas } from '@/ui/canvas/MapCanvas';
import { LogPanel } from '@/ui/logpanel/LogPanel';
import { ReplayBar } from '@/ui/replaybar/ReplayBar';
import { Sidebar } from '@/ui/sidebar/Sidebar';
import { TopBar } from '@/ui/topbar/TopBar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const hudVisible = useWorldSimStore((s) => s.hudVisible);

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
