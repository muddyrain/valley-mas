import { create } from 'zustand';

type BluetoothStatus = 'unsupported' | 'ready' | 'connected' | 'denied';
type ShareStatus = 'unsupported' | 'ready' | 'shared' | 'cancelled';

export interface ControlCenterState {
  isOpen: boolean;
  isOnline: boolean;
  bluetoothStatus: BluetoothStatus;
  shareStatus: ShareStatus;
  doNotDisturb: boolean;
  brightness: number; // 0-100
  volume: number; // 0-100
}

interface ControlCenterStore extends ControlCenterState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOnline: (value: boolean) => void;
  setDoNotDisturb: (value: boolean) => void;
  requestBluetoothDevice: () => Promise<void>;
  shareDesktop: () => Promise<void>;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
}

const browserNavigator = globalThis.navigator as
  | (Navigator & {
      bluetooth?: {
        requestDevice: (options: { acceptAllDevices: boolean }) => Promise<unknown>;
      };
      share?: (data: ShareData) => Promise<void>;
    })
  | undefined;

export const useControlCenterStore = create<ControlCenterStore>((set) => ({
  isOpen: false,
  isOnline: browserNavigator?.onLine ?? true,
  bluetoothStatus: browserNavigator?.bluetooth ? 'ready' : 'unsupported',
  shareStatus: browserNavigator?.share ? 'ready' : 'unsupported',
  doNotDisturb: false,
  brightness: 78,
  volume: 56,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOnline: (value) => set({ isOnline: value }),
  setDoNotDisturb: (value) => set({ doNotDisturb: value }),
  requestBluetoothDevice: async () => {
    if (!browserNavigator?.bluetooth) {
      set({ bluetoothStatus: 'unsupported' });
      return;
    }
    try {
      await browserNavigator.bluetooth.requestDevice({ acceptAllDevices: true });
      set({ bluetoothStatus: 'connected' });
    } catch {
      set({ bluetoothStatus: 'denied' });
    }
  },
  shareDesktop: async () => {
    if (!browserNavigator?.share) {
      set({ shareStatus: 'unsupported' });
      return;
    }
    try {
      await browserNavigator.share({
        title: 'Desktop OS',
        text: '在线桌面系统',
        url: window.location.href,
      });
      set({ shareStatus: 'shared' });
    } catch {
      set({ shareStatus: 'cancelled' });
    }
  },
  setBrightness: (value) => set({ brightness: clamp(value) }),
  setVolume: (value) => set({ volume: clamp(value) }),
}));

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}
