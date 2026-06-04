import { create } from 'zustand';

export type FeedbackToastTone = 'success' | 'info' | 'warning' | 'error';

export type FeedbackToast = {
  id: string;
  message: string;
  tone: FeedbackToastTone;
};

type FeedbackToastState = {
  current: FeedbackToast | null;
  timer: ReturnType<typeof setTimeout> | null;
  showToast: (message: string, tone?: FeedbackToastTone, durationMs?: number) => void;
  dismissToast: () => void;
};

const DEFAULT_DURATION_MS = 2200;

export const useFeedbackToastStore = create<FeedbackToastState>((set, get) => ({
  current: null,
  timer: null,
  showToast: (message, tone = 'success', durationMs = DEFAULT_DURATION_MS) => {
    const activeTimer = get().timer;
    if (activeTimer) {
      globalThis.clearTimeout(activeTimer);
    }

    const nextToast: FeedbackToast = {
      id: `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      tone,
    };

    const timer = globalThis.setTimeout(() => {
      set({ current: null, timer: null });
    }, durationMs);

    set({
      current: nextToast,
      timer,
    });
  },
  dismissToast: () => {
    const activeTimer = get().timer;
    if (activeTimer) {
      globalThis.clearTimeout(activeTimer);
    }
    set({ current: null, timer: null });
  },
}));
