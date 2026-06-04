import { useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export type PwaShareResult = 'shared' | 'copied' | 'unsupported';

type PwaStatusSnapshot = {
  canInstall: boolean;
  checkingUpdate: boolean;
  clipboardSupported: boolean;
  iosInstallHint: boolean;
  installed: boolean;
  refreshing: boolean;
  shareSupported: boolean;
  serviceWorkerReady: boolean;
  updateAvailable: boolean;
};

type MutablePwaState = PwaStatusSnapshot & {
  installPrompt: BeforeInstallPromptEvent | null;
};

const isBrowser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const listeners = new Set<() => void>();
let initialized = false;

const fallbackSnapshot: PwaStatusSnapshot = {
  canInstall: false,
  checkingUpdate: false,
  clipboardSupported: false,
  iosInstallHint: false,
  installed: false,
  refreshing: false,
  shareSupported: false,
  serviceWorkerReady: false,
  updateAvailable: false,
};

const pwaState: MutablePwaState = {
  ...fallbackSnapshot,
  installPrompt: null,
};
let currentSnapshot = fallbackSnapshot;

const isStandalone = () =>
  isBrowser &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as NavigatorWithStandalone).standalone === true));

const isAppleTouchDevice = () =>
  isBrowser &&
  (/iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1));

const getShareUrl = () => (isBrowser ? window.location.origin || window.location.href : '');

const emit = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const setPwaState = (patch: Partial<MutablePwaState>) => {
  Object.assign(pwaState, patch);
  currentSnapshot = {
    canInstall: Boolean(pwaState.installPrompt),
    checkingUpdate: pwaState.checkingUpdate,
    clipboardSupported: pwaState.clipboardSupported,
    iosInstallHint: pwaState.iosInstallHint,
    installed: pwaState.installed,
    refreshing: pwaState.refreshing,
    shareSupported: pwaState.shareSupported,
    serviceWorkerReady: pwaState.serviceWorkerReady,
    updateAvailable: pwaState.updateAvailable,
  };
  emit();
};

const getSnapshot = (): PwaStatusSnapshot => currentSnapshot;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  initPwaStatus();

  return () => {
    listeners.delete(listener);
  };
};

function initPwaStatus() {
  if (initialized || !isBrowser) {
    return;
  }

  initialized = true;
  setPwaState({
    clipboardSupported: Boolean(navigator.clipboard?.writeText),
    installed: isStandalone(),
    iosInstallHint: isAppleTouchDevice(),
    shareSupported: 'share' in navigator,
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setPwaState({ installPrompt: event as BeforeInstallPromptEvent });
  });

  window.addEventListener('appinstalled', () => {
    setPwaState({ installed: true, installPrompt: null });
  });

  let reloadingForUpdate = false;
  const handleControllerChange = () => {
    if (reloadingForUpdate) {
      return;
    }

    reloadingForUpdate = true;
    window.location.reload();
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        setPwaState({ serviceWorkerReady: true });

        if (registration.waiting && navigator.serviceWorker.controller) {
          setPwaState({ updateAvailable: true });
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setPwaState({ updateAvailable: true });
            }
          });
        });
      })
      .catch(() => setPwaState({ serviceWorkerReady: false }));

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
  }
}

const promptInstall = async () => {
  if (!pwaState.installPrompt) {
    return;
  }

  await pwaState.installPrompt.prompt();
  const choice = await pwaState.installPrompt.userChoice;

  if (choice.outcome === 'accepted') {
    setPwaState({ installed: true });
  }

  setPwaState({ installPrompt: null });
};

const checkForUpdate = async () => {
  if (!isBrowser || !('serviceWorker' in navigator)) {
    return false;
  }

  setPwaState({ checkingUpdate: true });

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return false;
    }

    await registration.update();
    const hasWaitingWorker = Boolean(registration.waiting && navigator.serviceWorker.controller);
    if (hasWaitingWorker) {
      setPwaState({ updateAvailable: true });
    }

    return hasWaitingWorker || pwaState.updateAvailable;
  } finally {
    setPwaState({ checkingUpdate: false });
  }
};

const refreshApp = async () => {
  if (!isBrowser) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  setPwaState({ refreshing: true });
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }

  window.location.reload();
};

const shareApp = async (): Promise<PwaShareResult> => {
  if (!isBrowser) {
    return 'unsupported';
  }

  const shareData = {
    title: '生活迹 Life Trace',
    text: '一起用 Life Trace 记录计划、提醒和生活踪迹。',
    url: getShareUrl(),
  };

  if ('share' in navigator) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== 'AbortError') {
        throw error;
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareData.url);
    return 'copied';
  }

  return 'unsupported';
};

export function usePwaStatus() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => fallbackSnapshot);

  return {
    ...snapshot,
    checkForUpdate,
    promptInstall,
    refreshApp,
    shareApp,
  };
}
