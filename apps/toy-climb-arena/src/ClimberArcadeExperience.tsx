/**
 * ClimberArcadeExperience - 单人攀登游戏挂载组件（精简版）
 * 所有 HUD / 菜单渲染均由 GameHUD.ts 负责。
 */

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { CLIMBER_CHARACTER_OPTIONS } from './characterRig';
import { CLIMBER_LEVELS } from './climberLevels';
import { createClimberPrototype } from './createClimberPrototype';
import { GameHUD } from './hud/GameHUD';
import type { ClimberCharacterId, ClimberPrototypeController } from './types';

const SHELL_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background: '#1a0f00',
};

export interface ClimberArcadeExperienceProps {
  title?: string;
}

export function ClimberArcadeExperience(_props: ClimberArcadeExperienceProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<ClimberPrototypeController | null>(null);
  const hudRef = useRef<GameHUD | null>(null);
  const pendingRelockRef = useRef(false);

  const charOptions = CLIMBER_CHARACTER_OPTIONS;
  const [charIdx, setCharIdx] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const activeCharId = (charOptions[charIdx]?.id ?? 'woodendoll') as ClimberCharacterId;

  const toggleFullscreen = useCallback(async () => {
    const host = shellRef.current;
    if (!host) return;
    try {
      if (document.fullscreenElement === host) {
        await document.exitFullscreen();
      } else {
        pendingRelockRef.current = true;
        await host.requestFullscreen();
        controllerRef.current?.requestPointerLock();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const host = shellRef.current;
      const active = Boolean(host && document.fullscreenElement === host);
      setFullscreen(active);
      hudRef.current?.setFullscreen(active);
      if (active && pendingRelockRef.current) {
        pendingRelockRef.current = false;
        controllerRef.current?.requestPointerLock();
      }
    };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    controllerRef.current?.setAudioEnabled(audioEnabled);
    hudRef.current?.setAudioEnabled(audioEnabled);
  }, [audioEnabled]);

  useEffect(() => {
    const shell = shellRef.current;
    const level = CLIMBER_LEVELS[0];
    if (!shell || !level) return;

    const hud = new GameHUD(
      {
        onResume: () => controllerRef.current?.requestPointerLock(),
        onReset: () => {
          controllerRef.current?.reset();
          controllerRef.current?.requestPointerLock();
        },
        onSelectCharacter: (idx) => setCharIdx(idx),
        onAudioToggle: () => {
          setAudioEnabled((prev) => {
            const next = !prev;
            controllerRef.current?.setAudioEnabled(next);
            hud.setAudioEnabled(next);
            return next;
          });
        },
        onFullscreen: () => {
          void toggleFullscreen();
        },
      },
      { audioEnabled },
    );
    hud.setCharOptions(charOptions, charIdx);
    hud.setFullscreen(fullscreen);
    shell.appendChild(hud.canvas);
    hudRef.current = hud;

    const controller = createClimberPrototype({
      mount: shell,
      level,
      characterId: activeCharId,
      audioEnabled,
      onStats: (s) => hud.updateStats(s),
      onPointerLockChange: (locked) => {
        hud.setPointerLocked(locked);
        if (locked) hud.setHasEntered(true);
      },
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      hud.dispose();
      if (hud.canvas.parentElement === shell) shell.removeChild(hud.canvas);
      controllerRef.current = null;
      hudRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIdx]);

  return <div ref={shellRef} style={SHELL_STYLE} />;
}
