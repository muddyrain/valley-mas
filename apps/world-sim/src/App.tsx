import { useEffect } from 'react';
import { REPLAY_SPEED_MULTIPLIER, SIM_SPEED_MULTIPLIER } from '@/shared/types';
import { useWorldSimStore } from '@/state';
import { AppLayout } from '@/ui/layout/AppLayout';

const BASE_TICKS_PER_SECOND = 2;

export default function App() {
  const map = useWorldSimStore((s) => s.map);
  const regenerateMap = useWorldSimStore((s) => s.regenerateMap);

  useEffect(() => {
    if (!map) regenerateMap();
  }, [map, regenerateMap]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let acc = 0;

    const frame = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const state = useWorldSimStore.getState();

      // Phase 11：回放模式优先。replaying + playing 时按 replaySpeed 推 cursor，sim 不前进。
      const isReplaying = state.replayMode === 'replaying';
      if (isReplaying) {
        if (state.replayPlaying && state.replayCursor < state.replayFrames.length) {
          const m = REPLAY_SPEED_MULTIPLIER[state.replaySpeed];
          acc += dt * m * BASE_TICKS_PER_SECOND;
          let budget = 8;
          while (acc >= 1 && budget > 0) {
            const before = useWorldSimStore.getState();
            if (before.replayCursor >= before.replayFrames.length) {
              acc = 0;
              break;
            }
            before.stepReplay(1);
            acc -= 1;
            budget -= 1;
          }
        } else {
          acc = 0;
        }
        rafId = requestAnimationFrame(frame);
        return;
      }

      const multiplier = SIM_SPEED_MULTIPLIER[state.speed];
      const canTick =
        state.worldMode === 'simulation' &&
        state.status === 'running' &&
        !state.paused &&
        multiplier > 0 &&
        state.map != null;

      if (canTick) {
        acc += dt * multiplier * BASE_TICKS_PER_SECOND;
        // 每帧最多推进 8 tick，防止用户切走标签后突然爆推
        let budget = 8;
        while (acc >= 1 && budget > 0) {
          state.advanceTick(1);
          const after = useWorldSimStore.getState();
          if (after.status === 'victory' || after.status === 'stalemate') {
            acc = 0;
            break;
          }
          acc -= 1;
          budget -= 1;
        }
      } else {
        acc = 0;
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <AppLayout />;
}
