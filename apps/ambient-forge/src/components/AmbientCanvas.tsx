import { useEffect, useRef } from 'react';
import type { AmbientInputs } from '../core/ambient-inputs';
import type { CameraTourState } from '../core/camera-tour';
import type { NpcCameraState } from '../core/npc';
import type { QualityLevel } from '../core/quality';
import type { ThunderEvent } from '../core/weather-lifecycle';
import { type AmbientDebugStats, AmbientEngine } from '../engine/AmbientEngine';

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}

interface AmbientCanvasProps {
  quality: QualityLevel;
  getInputs: () => AmbientInputs;
  onReady: (engine: AmbientEngine | null) => void;
  onStats: (stats: AmbientDebugStats) => void;
  onCameraState: (state: CameraTourState) => void;
  onNpcCameraState: (state: NpcCameraState) => void;
  onThunder: (event: ThunderEvent) => void;
}

export function AmbientCanvas({
  quality,
  getInputs,
  onReady,
  onStats,
  onCameraState,
  onNpcCameraState,
  onThunder,
}: AmbientCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AmbientEngine | null>(null);
  const initialQualityRef = useRef(quality);
  const getInputsRef = useRef(getInputs);
  const onStatsRef = useRef(onStats);
  const onCameraStateRef = useRef(onCameraState);
  const onNpcCameraStateRef = useRef(onNpcCameraState);
  const onThunderRef = useRef(onThunder);
  getInputsRef.current = getInputs;
  onStatsRef.current = onStats;
  onCameraStateRef.current = onCameraState;
  onNpcCameraStateRef.current = onNpcCameraState;
  onThunderRef.current = onThunder;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const engine = new AmbientEngine({
      mount,
      quality: initialQualityRef.current,
      getInputs: () => getInputsRef.current(),
      onStats: (stats) => onStatsRef.current(stats),
      onCameraState: (state) => onCameraStateRef.current(state),
      onNpcCameraState: (state) => onNpcCameraStateRef.current(state),
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
  }, [onReady]);

  useEffect(() => {
    engineRef.current?.setQuality(quality);
  }, [quality]);

  return <div ref={mountRef} className="ambient-stage" aria-hidden="true" />;
}
