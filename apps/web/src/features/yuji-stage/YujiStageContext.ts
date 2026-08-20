import { createContext, useContext } from 'react';
import type { PointerBus, ScrollBus } from './stageBus';
import type { StagePerformanceTier } from './stagePerformance';

export interface StageCoverRegistration {
  element: HTMLElement;
  id: string;
  src: string;
}

export interface YujiStageContextValue {
  covers: StageCoverRegistration[];
  loadProgress: number;
  pointerBus: PointerBus;
  registerCover: (cover: StageCoverRegistration) => () => void;
  scrollBus: ScrollBus;
  tier: StagePerformanceTier;
  webglReady: boolean;
}

export const YujiStageContext = createContext<YujiStageContextValue | null>(null);

export function useYujiStage() {
  return useContext(YujiStageContext);
}
