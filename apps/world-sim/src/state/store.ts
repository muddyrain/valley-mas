import { create } from 'zustand';
import { createEditSlice, type EditSlice } from './slices/editSlice';
import { createFactionSlice, type FactionSlice } from './slices/factionSlice';
import { createLogSlice, type LogSlice } from './slices/logSlice';
import { createMapSlice, type MapSlice } from './slices/mapSlice';
import { createReplaySlice, type ReplaySlice } from './slices/replaySlice';
import { createScenarioSlice, type ScenarioSlice } from './slices/scenarioSlice';
import { createSimSlice, type SimSlice } from './slices/simSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

export type WorldSimStore = SimSlice &
  UiSlice &
  FactionSlice &
  LogSlice &
  MapSlice &
  ScenarioSlice &
  EditSlice &
  ReplaySlice;

/**
 * Valley World Sim 全局 store。Phase 11 加入 replaySlice，
 * 录制每 tick 帧并支持回放/导出。
 */
export const useWorldSimStore = create<WorldSimStore>()((...a) => ({
  ...createSimSlice(...a),
  ...createUiSlice(...a),
  ...createFactionSlice(...a),
  ...createLogSlice(...a),
  ...createMapSlice(...a),
  ...createScenarioSlice(...a),
  ...createEditSlice(...a),
  ...createReplaySlice(...a),
}));
