import { create } from 'zustand';

interface LaunchpadStore {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
}

export const useLaunchpadStore = create<LaunchpadStore>((set) => ({
  isOpen: false,
  query: '',
  open: () => set({ isOpen: true, query: '' }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen, query: state.isOpen ? state.query : '' })),
  setQuery: (query) => set({ query }),
}));
