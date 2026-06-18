import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

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
        <span className="menu-bar__icon">🔍</span>
        <span className="menu-bar__icon">🔋</span>
        <span className="menu-bar__icon">📶</span>
        <span className="menu-bar__clock">{formatClock(now)}</span>
      </div>
    </div>
  );
}
