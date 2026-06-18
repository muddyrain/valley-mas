import { useEffect, useRef } from 'react';
import ControlCenter from './components/ControlCenter';
import Dock from './components/Dock';
import MenuBar from './components/MenuBar';
import NotificationCenter from './components/NotificationCenter';
import Wallpaper from './components/Wallpaper';
import WindowManager from './components/window/WindowManager';
import Spotlight from './spotlight/Spotlight';
import { useControlCenterStore } from './store/controlCenterStore';
import { useNotificationCenterStore } from './store/notificationCenterStore';
import { useSpotlightStore } from './store/spotlightStore';
import { useWindowStore } from './store/windowStore';
import './App.css';

export default function App() {
  const openWindow = useWindowStore((s) => s.openWindow);
  const toggleSpotlight = useSpotlightStore((s) => s.toggle);
  const closeSpotlight = useSpotlightStore((s) => s.close);
  const closeControlCenter = useControlCenterStore((s) => s.close);
  const closeNotificationCenter = useNotificationCenterStore((s) => s.close);
  const bootRef = useRef(false);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    openWindow('about', { title: '关于本机', width: 520, height: 360 });
  }, [openWindow]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      // ⌘K / Ctrl+K：网页通用命令面板快捷键（⌘Space 会被 macOS 系统聚焦截走）
      if (cmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        toggleSpotlight();
        return;
      }
      // Ctrl+Space 备用（⌘Space 会被系统截走，留给非 mac 或备用）
      if (cmdOrCtrl && e.code === 'Space') {
        e.preventDefault();
        toggleSpotlight();
        return;
      }
      if (e.key === 'Escape') {
        closeSpotlight();
        closeControlCenter();
        closeNotificationCenter();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSpotlight, closeSpotlight, closeControlCenter, closeNotificationCenter]);

  return (
    <div className="desktop">
      <Wallpaper />
      <MenuBar />
      <WindowManager />
      <Dock />
      <Spotlight />
      <ControlCenter />
      <NotificationCenter />
    </div>
  );
}
