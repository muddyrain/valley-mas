import { useEffect } from 'react';
import { useControlCenterStore } from '../store/controlCenterStore';
import { useLaunchpadStore } from '../store/launchpadStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useSpotlightStore } from '../store/spotlightStore';

export default function DesktopGlobalEvents() {
  const toggleSpotlight = useSpotlightStore((s) => s.toggle);
  const closeSpotlight = useSpotlightStore((s) => s.close);
  const closeLaunchpad = useLaunchpadStore((s) => s.close);
  const closeControlCenter = useControlCenterStore((s) => s.close);
  const closeNotificationCenter = useNotificationCenterStore((s) => s.close);
  const setOnline = useControlCenterStore((s) => s.setOnline);

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
      if (cmdOrCtrl && (e.key === 'k' || e.key === 'K' || e.code === 'Space')) {
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
    closeControlCenter,
    closeLaunchpad,
    closeNotificationCenter,
    closeSpotlight,
    toggleSpotlight,
  ]);

  return null;
}
