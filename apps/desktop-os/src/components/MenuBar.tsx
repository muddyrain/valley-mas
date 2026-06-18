import { useEffect, useState } from 'react';
import { useControlCenterStore } from '../store/controlCenterStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useSpotlightStore } from '../store/spotlightStore';
import { type AppId, useWindowStore } from '../store/windowStore';
import './MenuBar.css';

const APP_NAME: Record<AppId, string> = {
  about: 'Finder',
  finder: 'Finder',
  notes: '便签',
};

function formatClock(d: Date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 周${week[d.getDay()]} ${hh}:${mm}`;
}

export default function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  const focusedId = useWindowStore((s) => s.focusedId);
  const focused = useWindowStore((s) => s.windows.find((w) => w.id === s.focusedId));
  const openSpotlight = useSpotlightStore((s) => s.open);
  const toggleControlCenter = useControlCenterStore((s) => s.toggle);
  const closeControlCenter = useControlCenterStore((s) => s.close);
  const wifi = useControlCenterStore((s) => s.wifi);
  const bluetooth = useControlCenterStore((s) => s.bluetooth);
  const toggleNotificationCenter = useNotificationCenterStore((s) => s.toggle);
  const closeNotificationCenter = useNotificationCenterStore((s) => s.close);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  function handleControlCenter(e: React.MouseEvent) {
    e.stopPropagation();
    closeNotificationCenter();
    toggleControlCenter();
  }

  function handleNotificationCenter(e: React.MouseEvent) {
    e.stopPropagation();
    closeControlCenter();
    toggleNotificationCenter();
  }

  const appName = focused ? (APP_NAME[focused.appId] ?? focused.title) : 'Finder';

  return (
    <div className="menu-bar">
      <div className="menu-bar__left">
        <span className="menu-bar__logo">🍎</span>
        <span className="menu-bar__app" key={focusedId ?? 'desktop'}>
          {appName}
        </span>
        <span className="menu-bar__item">文件</span>
        <span className="menu-bar__item">编辑</span>
        <span className="menu-bar__item">显示</span>
        <span className="menu-bar__item">前往</span>
        <span className="menu-bar__item">窗口</span>
        <span className="menu-bar__item">帮助</span>
      </div>
      <div className="menu-bar__right">
        <button type="button" className="menu-bar__btn" onClick={openSpotlight} title="搜索（⌘K）">
          🔍
        </button>
        <button
          type="button"
          className="menu-bar__btn menu-bar__btn--cc"
          onClick={handleControlCenter}
          title="控制中心"
        >
          <span className={wifi ? '' : 'is-dim'}>📶</span>
          <span className={bluetooth ? '' : 'is-dim'}>🔷</span>
          <span>🔋</span>
        </button>
        <button
          type="button"
          className="menu-bar__btn menu-bar__btn--clock"
          onClick={handleNotificationCenter}
          title="通知中心"
        >
          {formatClock(now)}
        </button>
      </div>
    </div>
  );
}
