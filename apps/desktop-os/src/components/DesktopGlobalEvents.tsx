import { useEffect } from 'react';
import { useBrowserStore } from '../store/browserStore';
import { useControlCenterStore } from '../store/controlCenterStore';
import { useLaunchpadStore } from '../store/launchpadStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useSpotlightStore } from '../store/spotlightStore';
import { useWindowStore } from '../store/windowStore';

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

  useEffect(() => {
    function isInsideAddressBar(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('[data-safari-address-input]'));
    }

    function focusSafariAddressBar() {
      if (typeof document === 'undefined') return;
      const input = document.querySelector<HTMLInputElement>('[data-safari-address-input]');
      if (!input) return;
      input.focus();
      input.select();
    }

    function onSafariShortcut(e: KeyboardEvent) {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!cmdOrCtrl) return;
      if (useWindowStore.getState().focusedAppId !== 'safari') return;

      const key = e.key.toLowerCase();
      if (key !== 't' && key !== 'w' && key !== 'l' && key !== 'r') return;

      if (key !== 'l' && isInsideAddressBar(e.target)) return;

      const browser = useBrowserStore.getState();
      if (key === 't') {
        e.preventDefault();
        browser.newTab();
        return;
      }
      if (key === 'w') {
        e.preventDefault();
        browser.closeTab(browser.activeTabId);
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        focusSafariAddressBar();
        return;
      }
      if (key === 'r') {
        e.preventDefault();
        browser.refresh();
      }
    }

    window.addEventListener('keydown', onSafariShortcut);
    return () => window.removeEventListener('keydown', onSafariShortcut);
  }, []);

  return null;
}
