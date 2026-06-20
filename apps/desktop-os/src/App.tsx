import { type CSSProperties, useEffect } from 'react';
import ControlCenter from './components/ControlCenter';
import Dock from './components/Dock';
import FocusTimerRuntime from './components/FocusTimerRuntime';
import Launchpad from './components/Launchpad';
import MenuBar from './components/MenuBar';
import MusicRuntime from './components/MusicRuntime';
import NotificationCenter from './components/NotificationCenter';
import Wallpaper from './components/Wallpaper';
import WindowManager from './components/window/WindowManager';
import Spotlight from './spotlight/Spotlight';
import { useAuthStore } from './store/authStore';
import { useControlCenterStore } from './store/controlCenterStore';
import { useDockStore } from './store/dockStore';
import { useLaunchpadStore } from './store/launchpadStore';
import { useNotificationCenterStore } from './store/notificationCenterStore';
import { useResourceStore } from './store/resourceStore';
import { useSpotlightStore } from './store/spotlightStore';
import './App.css';

export default function App() {
  const toggleSpotlight = useSpotlightStore((s) => s.toggle);
  const closeSpotlight = useSpotlightStore((s) => s.close);
  const closeLaunchpad = useLaunchpadStore((s) => s.close);
  const closeControlCenter = useControlCenterStore((s) => s.close);
  const closeNotificationCenter = useNotificationCenterStore((s) => s.close);
  const refreshUnreadCount = useNotificationCenterStore((s) => s.refreshUnreadCount);
  const resetNotifications = useNotificationCenterStore((s) => s.resetServerState);
  const brightness = useControlCenterStore((s) => s.brightness);
  const setOnline = useControlCenterStore((s) => s.setOnline);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadCurrentUser = useAuthStore((s) => s.loadCurrentUser);
  const loadDockPreferences = useDockStore((s) => s.loadPreferences);
  const clearDockServerSync = useDockStore((s) => s.clearServerSync);
  const loadResources = useResourceStore((s) => s.loadResources);

  useEffect(() => {
    void loadCurrentUser();
    void loadResources();
  }, [loadCurrentUser, loadResources]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      clearDockServerSync();
      resetNotifications();
      return;
    }

    void loadDockPreferences(token);
    void refreshUnreadCount(token);
    const timer = window.setInterval(() => {
      void refreshUnreadCount(token);
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [
    clearDockServerSync,
    isAuthenticated,
    loadDockPreferences,
    refreshUnreadCount,
    resetNotifications,
    token,
  ]);

  useEffect(() => {
    function syncOnline() {
      setOnline(navigator.onLine);
    }
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, [setOnline]);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if (e.defaultPrevented) return;
      e.preventDefault();
    }
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      // ⌘K / Ctrl+K：网页通用命令面板快捷键（⌘Space 会被 macOS 系统聚焦截走）
      if (cmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        closeLaunchpad();
        toggleSpotlight();
        return;
      }
      // Ctrl+Space 备用（⌘Space 会被系统截走，留给非 mac 或备用）
      if (cmdOrCtrl && e.code === 'Space') {
        e.preventDefault();
        closeLaunchpad();
        toggleSpotlight();
        return;
      }
      if (e.key === 'Escape') {
        closeLaunchpad();
        closeSpotlight();
        closeControlCenter();
        closeNotificationCenter();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    toggleSpotlight,
    closeLaunchpad,
    closeSpotlight,
    closeControlCenter,
    closeNotificationCenter,
  ]);

  return (
    <div
      className="desktop"
      style={{ '--wallpaper-brightness': String(0.82 + brightness / 400) } as CSSProperties}
    >
      <Wallpaper />
      <FocusTimerRuntime />
      <MusicRuntime />
      <MenuBar />
      <WindowManager />
      <Launchpad />
      <Dock />
      <Spotlight />
      <ControlCenter />
      <NotificationCenter />
    </div>
  );
}
