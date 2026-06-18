import { useEffect, useRef } from 'react';
import { useControlCenterStore } from '../store/controlCenterStore';
import { type Notification, useNotificationCenterStore } from '../store/notificationCenterStore';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const isOpen = useNotificationCenterStore((s) => s.isOpen);
  const close = useNotificationCenterStore((s) => s.close);
  const notifications = useNotificationCenterStore((s) => s.notifications);
  const dismiss = useNotificationCenterStore((s) => s.dismiss);
  const clearAll = useNotificationCenterStore((s) => s.clearAll);

  const brightness = useControlCenterStore((s) => s.brightness);
  const volume = useControlCenterStore((s) => s.volume);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  const today = formatToday(new Date());

  if (!isOpen) return null;

  return (
    <div ref={panelRef} className="notification-center" role="dialog" aria-label="通知中心">
      <div className="nc__date">
        <span className="nc__date-week">{today.week}</span>
        <span className="nc__date-day">{today.day}</span>
        <span className="nc__date-month">{today.monthLong}</span>
      </div>

      <section className="nc__section">
        <header className="nc__section-header">
          <span>通知</span>
          {notifications.length > 0 && (
            <button type="button" className="nc__clear-all" onClick={clearAll}>
              全部清除
            </button>
          )}
        </header>
        {notifications.length === 0 ? (
          <div className="nc__empty">暂无新通知</div>
        ) : (
          <ul className="nc__list">
            {notifications.map((n) => (
              <NotificationCard key={n.id} item={n} onDismiss={() => dismiss(n.id)} />
            ))}
          </ul>
        )}
      </section>

      <section className="nc__section">
        <header className="nc__section-header">
          <span>小组件</span>
        </header>
        <div className="nc__widgets">
          <Widget
            title="日历"
            subtitle={today.monthShort}
            accent="terracotta"
            image="/widgets/calendar.png"
          >
            <div className="widget-calendar">
              <div className="widget-calendar__day">{today.day}</div>
              <div className="widget-calendar__hint">无日程安排</div>
            </div>
          </Widget>
          <Widget title="天气" subtitle="晴朗" accent="sky" image="/widgets/weather.png">
            <div className="widget-weather">
              <div className="widget-weather__temp">22°</div>
              <div className="widget-weather__hint">最高 26° / 最低 14°</div>
            </div>
          </Widget>
          <Widget title="电池" subtitle="充电中" accent="sage" image="/widgets/battery.png">
            <div className="widget-battery">
              <div className="widget-battery__pct">{Math.round(brightness)}%</div>
              <div className="widget-battery__hint">预计 1 小时充满</div>
            </div>
          </Widget>
          <Widget title="正在播放" subtitle="音乐" accent="butter" image="/widgets/music.png">
            <div className="widget-music">
              <div className="widget-music__track">夏夜的风</div>
              <div className="widget-music__artist">不知名独立音乐人</div>
              <div className="widget-music__bar">
                <div className="widget-music__bar-fill" style={{ width: `${volume}%` }} />
              </div>
            </div>
          </Widget>
        </div>
      </section>
    </div>
  );
}

interface NotificationCardProps {
  item: Notification;
  onDismiss: () => void;
}

function NotificationCard({ item, onDismiss }: NotificationCardProps) {
  return (
    <li className="nc__card">
      <div className="nc__card-head">
        <span className="nc__card-app">{item.app}</span>
        <span className="nc__card-time">{relativeTime(item.minutesAgo)}</span>
        <button type="button" className="nc__card-close" onClick={onDismiss} aria-label="关闭">
          ×
        </button>
      </div>
      <div className="nc__card-title">{item.title}</div>
      <div className="nc__card-body">{item.body}</div>
    </li>
  );
}

interface WidgetProps {
  title: string;
  subtitle?: string;
  accent: 'terracotta' | 'sky' | 'sage' | 'butter';
  image?: string;
  children: React.ReactNode;
}

function Widget({ title, subtitle, accent, image, children }: WidgetProps) {
  return (
    <div className={`widget widget--${accent}`}>
      {image && <img className="widget__bg" src={image} alt="" aria-hidden />}
      <div className="widget__header">
        <span className="widget__title">{title}</span>
        {subtitle && <span className="widget__subtitle">{subtitle}</span>}
      </div>
      <div className="widget__body">{children}</div>
    </div>
  );
}

function relativeTime(min: number) {
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

function formatToday(d: Date) {
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const monthZh = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];
  return {
    week: week[d.getDay()],
    day: String(d.getDate()),
    monthLong: monthZh[d.getMonth()],
    monthShort: `${d.getMonth() + 1}月`,
  };
}
