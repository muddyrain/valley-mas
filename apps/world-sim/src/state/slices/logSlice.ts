import type { StateCreator } from 'zustand';
import type { LogEvent } from '@/shared/types';

export const MAX_LOG_ENTRIES = 1000;

export interface LogSlice {
  logs: LogEvent[];
  appendLog: (event: LogEvent) => void;
  clearLogs: () => void;
}

export const createLogSlice: StateCreator<LogSlice, [], [], LogSlice> = (set) => ({
  logs: [],
  appendLog: (event) =>
    set((s) => {
      const next = s.logs.length >= MAX_LOG_ENTRIES ? s.logs.slice(-MAX_LOG_ENTRIES + 1) : s.logs;
      return { logs: [...next, event] };
    }),
  clearLogs: () => set({ logs: [] }),
});
