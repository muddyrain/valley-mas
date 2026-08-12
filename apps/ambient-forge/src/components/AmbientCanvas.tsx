import { useEffect, useRef } from 'react';
import type { AmbientInputs } from '../core/ambient-inputs';
import type { NpcInteractionHudState } from '../core/npc-interactions';
import type { WorldControlState } from '../core/playable-world';
import type { QualityLevel } from '../core/quality';
import type { ThunderEvent } from '../core/weather-lifecycle';
import { type AmbientDebugStats, AmbientEngine } from '../engine/AmbientEngine';

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

interface AmbientCanvasProps {
  debug: boolean;
  quality: QualityLevel;
  getInputs: () => AmbientInputs;
  onReady: (engine: AmbientEngine | null) => void;
  onStats: (stats: AmbientDebugStats) => void;
  onWorldControlState: (state: WorldControlState) => void;
  onNpcInteractionState: (state: NpcInteractionHudState) => void;
  onThunder: (event: ThunderEvent) => void;
}

export function AmbientCanvas({
  debug,
  quality,
  getInputs,
  onReady,
  onStats,
  onWorldControlState,
  onNpcInteractionState,
  onThunder,
}: AmbientCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AmbientEngine | null>(null);
  const initialQualityRef = useRef(quality);
  const getInputsRef = useRef(getInputs);
  const onStatsRef = useRef(onStats);
  const onWorldControlStateRef = useRef(onWorldControlState);
  const onNpcInteractionStateRef = useRef(onNpcInteractionState);
  const onThunderRef = useRef(onThunder);
  getInputsRef.current = getInputs;
  onStatsRef.current = onStats;
  onWorldControlStateRef.current = onWorldControlState;
  onNpcInteractionStateRef.current = onNpcInteractionState;
  onThunderRef.current = onThunder;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const engine = new AmbientEngine({
      mount,
      debug,
      quality: initialQualityRef.current,
      getInputs: () => getInputsRef.current(),
      onStats: (stats) => onStatsRef.current(stats),
      onWorldControlState: (state) => onWorldControlStateRef.current(state),
      onNpcInteractionState: (state) => onNpcInteractionStateRef.current(state),
      onThunder: (event) => onThunderRef.current(event),
    });
    engineRef.current = engine;
    window.render_game_to_text = () => JSON.stringify(engine.getSceneState());
    onReady(engine);
    return () => {
      onReady(null);
      delete window.render_game_to_text;
      engine.dispose();
      engineRef.current = null;
    };
  }, [debug, onReady]);

  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);

  return <div ref={mountRef} className="ambient-stage" aria-hidden="true" />;
}
