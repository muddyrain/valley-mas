'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createInitialScratchLegendSave,
  mergeScratchLegendSave,
  type ScratchLegendSave,
  syncScratchLegendSave,
} from './game-save';

export type ScratchLegendSidebarTab = 'cards' | 'tools';

type ScratchLegendStore = {
  // 当前局运行态，后续由 persist 自动写入 localStorage。
  save: ScratchLegendSave;
  // 当前左侧面板标签页，也一并持久化，避免刷新后跳回默认页签。
  sidebarTab: ScratchLegendSidebarTab;
  // persist 是否已经完成水合。
  hasHydrated: boolean;
  // 更新左侧标签页。
  setSidebarTab: (tab: ScratchLegendSidebarTab) => void;
  // 更新整份运行态；内部会自动补齐派生字段并同步解锁。
  updateSave: (
    updater: ScratchLegendSave | ((currentSave: ScratchLegendSave) => ScratchLegendSave),
  ) => void;
  // 重置为一份全新初始存档。
  resetSave: () => void;
};

const STORAGE_KEY = 'scratch_legend_save';

export const useScratchLegendStore = create<ScratchLegendStore>()(
  persist(
    (set) => ({
      save: createInitialScratchLegendSave(),
      sidebarTab: 'cards',
      hasHydrated: false,
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      updateSave: (updater) =>
        set((state) => {
          const nextSave = typeof updater === 'function' ? updater(state.save) : updater;

          return {
            save: syncScratchLegendSave(nextSave),
          };
        }),
      resetSave: () =>
        set({
          save: createInitialScratchLegendSave(),
          sidebarTab: 'cards',
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
      partialize: (state) => ({
        save: state.save,
        sidebarTab: state.sidebarTab,
      }),
      merge: (persistedState, currentState) => {
        const typedPersistedState = persistedState as Partial<ScratchLegendStore> | undefined;

        return {
          ...currentState,
          ...typedPersistedState,
          save: mergeScratchLegendSave(typedPersistedState?.save),
          sidebarTab: typedPersistedState?.sidebarTab ?? currentState.sidebarTab,
        };
      },
      onRehydrateStorage: () => (_state, _error) => {
        useScratchLegendStore.setState((state) => ({
          hasHydrated: true,
          save: syncScratchLegendSave(state.save),
        }));
      },
    },
  ),
);
