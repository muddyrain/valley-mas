import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface LayoutState {
  sidebarCollapsed: boolean;
  aiPanelOpen: boolean;
  aiPanelWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleAIPanel: () => void;
  setAIPanelOpen: (open: boolean) => void;
  setAIPanelWidth: (width: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      aiPanelOpen: true,
      aiPanelWidth: 380,

      toggleSidebar: () => {
        set({ sidebarCollapsed: !get().sidebarCollapsed });
      },
      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },
      toggleAIPanel: () => {
        set({ aiPanelOpen: !get().aiPanelOpen });
      },
      setAIPanelOpen: (open) => {
        set({ aiPanelOpen: open });
      },
      setAIPanelWidth: (width) => {
        set({ aiPanelWidth: Math.max(280, Math.min(560, width)) });
      },
    }),
    {
      name: 'valley_layout',
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
    },
  ),
);
