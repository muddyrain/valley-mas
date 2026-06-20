import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FocusMode = 'work' | 'short' | 'long';
export type FocusStatus = 'idle' | 'running' | 'paused';
export type RandomizerMode = 'list' | 'dice' | 'coin';

export interface CalcHistoryItem {
  id: string;
  expression: string;
  result: string;
}

export interface RandomizerHistoryItem {
  id: string;
  mode: RandomizerMode;
  result: string;
}

export interface GameBest {
  moves?: number;
  seconds?: number;
  score?: number;
}

export interface FocusCompletion {
  id: string;
  mode: FocusMode;
  completedAt: number;
}

export interface ClipboardSnippet {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: number;
}

export interface ConverterRecentItem {
  id: string;
  label: string;
  result: string;
}

export interface PaletteColor {
  id: string;
  hex: string;
}

export interface StopwatchRecord {
  id: string;
  label: string;
  seconds: number;
}

export interface PlushGardenState {
  water: number;
  blooms: number;
  decorations: string[];
  lastWateredAt: number | null;
}

interface ToolStore {
  calcHistory: CalcHistoryItem[];
  addCalcHistory: (expression: string, result: string) => void;
  clearCalcHistory: () => void;

  randomizerItems: string[];
  randomizerMode: RandomizerMode;
  randomizerHistory: RandomizerHistoryItem[];
  setRandomizerItems: (items: string[]) => void;
  setRandomizerMode: (mode: RandomizerMode) => void;
  addRandomizerHistory: (mode: RandomizerMode, result: string) => void;
  clearRandomizerHistory: () => void;

  focusMode: FocusMode;
  focusStatus: FocusStatus;
  focusDurationSeconds: number;
  focusRemainingSeconds: number;
  focusStartedAt: number | null;
  focusCompletedCount: number;
  lastFocusCompletion: FocusCompletion | null;
  setFocusMode: (mode: FocusMode) => void;
  startFocusTimer: () => void;
  pauseFocusTimer: (now?: number) => void;
  resetFocusTimer: (mode?: FocusMode) => void;
  syncFocusTimer: (now?: number) => void;

  plushMatchBest: GameBest | null;
  deskTidyBest: GameBest | null;
  beadSortBest: GameBest | null;
  cloudBounceBest: GameBest | null;
  recordPlushMatchBest: (moves: number, seconds: number) => void;
  recordDeskTidyBest: (score: number) => void;
  recordBeadSortBest: (moves: number, seconds: number) => void;
  recordCloudBounceBest: (score: number) => void;

  clipboardSnippets: ClipboardSnippet[];
  addClipboardSnippet: (text: string) => void;
  removeClipboardSnippet: (id: string) => void;
  toggleClipboardSnippetPinned: (id: string) => void;
  clearClipboardSnippets: () => void;

  converterRecent: ConverterRecentItem[];
  addConverterRecent: (label: string, result: string) => void;
  clearConverterRecent: () => void;

  textLabDraft: string;
  setTextLabDraft: (draft: string) => void;

  paletteColors: PaletteColor[];
  addPaletteColor: (hex: string) => void;
  removePaletteColor: (id: string) => void;

  stopwatchRecords: StopwatchRecord[];
  addStopwatchRecord: (label: string, seconds: number) => void;
  clearStopwatchRecords: () => void;

  plushGarden: PlushGardenState;
  waterPlushGarden: () => void;
  harvestPlushGarden: () => string | null;
  resetPlushGarden: () => void;
}

export const FOCUS_DURATIONS: Record<FocusMode, number> = {
  work: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

export const FOCUS_LABELS: Record<FocusMode, string> = {
  work: '专注',
  short: '短休息',
  long: '长休息',
};

export const useToolStore = create<ToolStore>()(
  persist(
    (set, get) => ({
      calcHistory: [],
      addCalcHistory: (expression, result) =>
        set((state) => ({
          calcHistory: [
            { id: `calc-${Date.now()}`, expression, result },
            ...state.calcHistory,
          ].slice(0, 12),
        })),
      clearCalcHistory: () => set({ calcHistory: [] }),

      randomizerItems: ['写代码', '看资源', '休息一下'],
      randomizerMode: 'list',
      randomizerHistory: [],
      setRandomizerItems: (items) => set({ randomizerItems: items }),
      setRandomizerMode: (mode) => set({ randomizerMode: mode }),
      addRandomizerHistory: (mode, result) =>
        set((state) => ({
          randomizerHistory: [
            { id: `random-${Date.now()}`, mode, result },
            ...state.randomizerHistory,
          ].slice(0, 10),
        })),
      clearRandomizerHistory: () => set({ randomizerHistory: [] }),

      focusMode: 'work',
      focusStatus: 'idle',
      focusDurationSeconds: FOCUS_DURATIONS.work,
      focusRemainingSeconds: FOCUS_DURATIONS.work,
      focusStartedAt: null,
      focusCompletedCount: 0,
      lastFocusCompletion: null,
      setFocusMode: (mode) =>
        set({
          focusMode: mode,
          focusStatus: 'idle',
          focusDurationSeconds: FOCUS_DURATIONS[mode],
          focusRemainingSeconds: FOCUS_DURATIONS[mode],
          focusStartedAt: null,
        }),
      startFocusTimer: () => {
        const state = get();
        set({
          focusStatus: 'running',
          focusStartedAt:
            Date.now() - (state.focusDurationSeconds - state.focusRemainingSeconds) * 1000,
        });
      },
      pauseFocusTimer: (now = Date.now()) => {
        const state = get();
        if (state.focusStatus !== 'running' || state.focusStartedAt === null) return;
        const elapsed = Math.floor((now - state.focusStartedAt) / 1000);
        set({
          focusStatus: 'paused',
          focusStartedAt: null,
          focusRemainingSeconds: Math.max(0, state.focusDurationSeconds - elapsed),
        });
      },
      resetFocusTimer: (mode) => {
        const nextMode = mode ?? get().focusMode;
        set({
          focusMode: nextMode,
          focusStatus: 'idle',
          focusDurationSeconds: FOCUS_DURATIONS[nextMode],
          focusRemainingSeconds: FOCUS_DURATIONS[nextMode],
          focusStartedAt: null,
        });
      },
      syncFocusTimer: (now = Date.now()) => {
        const state = get();
        if (state.focusStatus !== 'running' || state.focusStartedAt === null) return;
        const elapsed = Math.floor((now - state.focusStartedAt) / 1000);
        const remaining = Math.max(0, state.focusDurationSeconds - elapsed);
        if (remaining > 0) {
          set({ focusRemainingSeconds: remaining });
          return;
        }
        set({
          focusStatus: 'idle',
          focusStartedAt: null,
          focusRemainingSeconds: state.focusDurationSeconds,
          focusCompletedCount: state.focusCompletedCount + 1,
          lastFocusCompletion: {
            id: `focus-${now}`,
            mode: state.focusMode,
            completedAt: now,
          },
        });
      },

      plushMatchBest: null,
      deskTidyBest: null,
      beadSortBest: null,
      cloudBounceBest: null,
      recordPlushMatchBest: (moves, seconds) =>
        set((state) => {
          const best = state.plushMatchBest;
          if (best?.moves && best.moves < moves) return {};
          if (best?.moves === moves && best.seconds && best.seconds <= seconds) return {};
          return { plushMatchBest: { moves, seconds } };
        }),
      recordDeskTidyBest: (score) =>
        set((state) => {
          if (state.deskTidyBest?.score && state.deskTidyBest.score >= score) return {};
          return { deskTidyBest: { score } };
        }),
      recordBeadSortBest: (moves, seconds) =>
        set((state) => {
          const best = state.beadSortBest;
          if (best?.moves && best.moves < moves) return {};
          if (best?.moves === moves && best.seconds && best.seconds <= seconds) return {};
          return { beadSortBest: { moves, seconds } };
        }),
      recordCloudBounceBest: (score) =>
        set((state) => {
          if (state.cloudBounceBest?.score && state.cloudBounceBest.score >= score) return {};
          return { cloudBounceBest: { score } };
        }),

      clipboardSnippets: [],
      addClipboardSnippet: (text) => {
        const value = text.trim();
        if (!value) return;
        set((state) => ({
          clipboardSnippets: [
            { id: `clip-${Date.now()}`, text: value, pinned: false, createdAt: Date.now() },
            ...state.clipboardSnippets.filter((item) => item.text !== value),
          ].slice(0, 24),
        }));
      },
      removeClipboardSnippet: (id) =>
        set((state) => ({
          clipboardSnippets: state.clipboardSnippets.filter((item) => item.id !== id),
        })),
      toggleClipboardSnippetPinned: (id) =>
        set((state) => ({
          clipboardSnippets: state.clipboardSnippets.map((item) =>
            item.id === id ? { ...item, pinned: !item.pinned } : item,
          ),
        })),
      clearClipboardSnippets: () => set({ clipboardSnippets: [] }),

      converterRecent: [],
      addConverterRecent: (label, result) =>
        set((state) => ({
          converterRecent: [
            { id: `convert-${Date.now()}`, label, result },
            ...state.converterRecent,
          ].slice(0, 10),
        })),
      clearConverterRecent: () => set({ converterRecent: [] }),

      textLabDraft: '',
      setTextLabDraft: (draft) => set({ textLabDraft: draft }),

      paletteColors: [
        { id: 'palette-sage', hex: '#8FB45E' },
        { id: 'palette-sky', hex: '#A8D4EA' },
        { id: 'palette-butter', hex: '#F4D97A' },
      ],
      addPaletteColor: (hex) =>
        set((state) => ({
          paletteColors: [
            { id: `palette-${Date.now()}`, hex },
            ...state.paletteColors.filter((item) => item.hex !== hex),
          ].slice(0, 18),
        })),
      removePaletteColor: (id) =>
        set((state) => ({
          paletteColors: state.paletteColors.filter((item) => item.id !== id),
        })),

      stopwatchRecords: [],
      addStopwatchRecord: (label, seconds) =>
        set((state) => ({
          stopwatchRecords: [
            { id: `stopwatch-${Date.now()}`, label, seconds },
            ...state.stopwatchRecords,
          ].slice(0, 8),
        })),
      clearStopwatchRecords: () => set({ stopwatchRecords: [] }),

      plushGarden: {
        water: 0,
        blooms: 0,
        decorations: [],
        lastWateredAt: null,
      },
      waterPlushGarden: () =>
        set((state) => ({
          plushGarden: {
            ...state.plushGarden,
            water: Math.min(9, state.plushGarden.water + 1),
            lastWateredAt: Date.now(),
          },
        })),
      harvestPlushGarden: () => {
        const state = get();
        if (state.plushGarden.water < 3) return null;
        const blooms = state.plushGarden.blooms + 1;
        const nextDecoration = nextGardenDecoration(blooms, state.plushGarden.decorations);
        set({
          plushGarden: {
            water: state.plushGarden.water - 3,
            blooms,
            decorations: nextDecoration
              ? [...state.plushGarden.decorations, nextDecoration]
              : state.plushGarden.decorations,
            lastWateredAt: state.plushGarden.lastWateredAt,
          },
        });
        return nextDecoration;
      },
      resetPlushGarden: () =>
        set({
          plushGarden: {
            water: 0,
            blooms: 0,
            decorations: [],
            lastWateredAt: null,
          },
        }),
    }),
    {
      name: 'desktop-os-mini-apps',
      partialize: (state) => ({
        calcHistory: state.calcHistory,
        randomizerItems: state.randomizerItems,
        randomizerMode: state.randomizerMode,
        randomizerHistory: state.randomizerHistory,
        focusMode: state.focusMode,
        focusStatus: state.focusStatus,
        focusDurationSeconds: state.focusDurationSeconds,
        focusRemainingSeconds: state.focusRemainingSeconds,
        focusStartedAt: state.focusStartedAt,
        focusCompletedCount: state.focusCompletedCount,
        lastFocusCompletion: state.lastFocusCompletion,
        plushMatchBest: state.plushMatchBest,
        deskTidyBest: state.deskTidyBest,
        beadSortBest: state.beadSortBest,
        cloudBounceBest: state.cloudBounceBest,
        clipboardSnippets: state.clipboardSnippets,
        converterRecent: state.converterRecent,
        textLabDraft: state.textLabDraft,
        paletteColors: state.paletteColors,
        stopwatchRecords: state.stopwatchRecords,
        plushGarden: state.plushGarden,
      }),
    },
  ),
);

export function formatTimer(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const GARDEN_DECORATIONS = ['小花牌', '云朵灯', '叶子垫', '星星风铃'];

function nextGardenDecoration(blooms: number, decorations: string[]) {
  if (blooms % 3 !== 0) return null;
  return GARDEN_DECORATIONS.find((item) => !decorations.includes(item)) ?? null;
}
