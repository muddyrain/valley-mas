import { type MouseEvent, useEffect, useState } from 'react';

interface ClockGateProps {
  unreadCount: number;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

function formatClock(d: Date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 周${week[d.getDay()]} ${hh}:${mm}`;
}

export default function ClockGate({ unreadCount, onClick }: ClockGateProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <button
      type="button"
      className="menu-bar__btn menu-bar__btn--clock"
      onClick={onClick}
      title="通知中心"
    >
      {formatClock(now)}
      {unreadCount > 0 && <span className="menu-bar__badge">{Math.min(unreadCount, 99)}</span>}
    </button>
  );
}
