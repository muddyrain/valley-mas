import { useEffect, useRef, useState } from 'react';
import { type AppId, useWindowStore } from '../store/windowStore';
import './Dock.css';

interface DockItem {
  id: string;
  label: string;
  icon: string;
  appId?: AppId;
  windowTitle?: string;
}

const DOCK_ITEMS: DockItem[] = [
  {
    id: 'finder',
    label: 'Finder',
    icon: '/dock/finder.png',
    appId: 'about',
    windowTitle: '关于本机',
  },
  { id: 'star', label: '收藏', icon: '/dock/star.png' },
  { id: 'leaf', label: '小岛', icon: '/dock/leaf.png' },
  { id: 'safari', label: 'Safari', icon: '/dock/safari.png' },
  { id: 'mail', label: '邮件', icon: '/dock/mail.png' },
  { id: 'notes', label: '备忘录', icon: '/dock/notes.png', appId: 'notes', windowTitle: '便签' },
  { id: 'photos', label: '照片', icon: '/dock/photos.png' },
  { id: 'music', label: '音乐', icon: '/dock/music.png' },
  { id: 'appstore', label: 'App Store', icon: '/dock/appstore.png' },
  { id: 'settings', label: '系统设置', icon: '/dock/settings.png' },
  { id: 'downloads', label: '下载', icon: '/dock/downloads.png' },
  { id: 'trash', label: '废纸篓', icon: '/dock/trash.png' },
];

const BOUNCE_MS = 600;

export default function Dock() {
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const windows = useWindowStore((s) => s.windows);
  const runningApps = new Set<AppId>(windows.map((w) => w.appId));

  const [bouncingIds, setBouncingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
    };
  }, []);

  function triggerBounce(id: string) {
    setBouncingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      setBouncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, BOUNCE_MS);
  }

  function handleClick(item: DockItem) {
    triggerBounce(item.id);
    if (item.appId) restoreOrFocus(item.appId);
  }

  return (
    <div className="dock">
      <ul className="dock__list">
        {DOCK_ITEMS.map((item) => {
          const isRunning = item.appId ? runningApps.has(item.appId) : false;
          const isBouncing = bouncingIds.has(item.id);
          return (
            <li key={item.id} className="dock__item">
              <button
                type="button"
                className={`dock__btn ${isBouncing ? 'is-bouncing' : ''}`}
                onClick={() => handleClick(item)}
              >
                <img className="dock__icon" src={item.icon} alt={item.label} />
                <span className="dock__tooltip">{item.label}</span>
              </button>
              <span className={`dock__indicator ${isRunning ? 'is-on' : ''}`} aria-hidden />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
