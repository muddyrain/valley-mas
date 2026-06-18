import { create } from 'zustand';

export interface ControlCenterState {
  isOpen: boolean;
  wifi: boolean;
  bluetooth: boolean;
  airdrop: boolean;
  doNotDisturb: boolean;
  brightness: number; // 0-100
  volume: number; // 0-100
}

interface ControlCenterStore extends ControlCenterState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setBoolean: (key: 'wifi' | 'bluetooth' | 'airdrop' | 'doNotDisturb', value: boolean) => void;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
}

export const useControlCenterStore = create<ControlCenterStore>((set) => ({
  isOpen: false,
  wifi: true,
  bluetooth: true,
  airdrop: false,
  doNotDisturb: false,
  brightness: 78,
  volume: 56,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setBoolean: (key, value) => set({ [key]: value } as Partial<ControlCenterState>),
  setBrightness: (value) => set({ brightness: clamp(value) }),
  setVolume: (value) => set({ volume: clamp(value) }),
}));

function clamp(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}
