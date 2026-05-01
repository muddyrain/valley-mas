'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  playEntranceSound,
  playShutterSound,
  playSpeakSound,
  startBgMusic,
  stopBgMusic,
} from '@/lib/audioEngine';

interface AudioContextValue {
  audioEnabled: boolean;
  toggleAudio: () => void;
  playEntrance: () => void;
  playSpeak: () => void;
  playShutter: () => void;
}

const AudioCtx = createContext<AudioContextValue>({
  audioEnabled: false,
  toggleAudio: () => {},
  playEntrance: () => {},
  playSpeak: () => {},
  playShutter: () => {},
});

export function AudioProvider({ children }: { children: ReactNode }) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  // 防止 SSR 阶段访问 Web Audio API
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      stopBgMusic();
    };
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      if (next) {
        startBgMusic();
      } else {
        stopBgMusic();
      }
      return next;
    });
  }, []);

  const playEntrance = useCallback(() => {
    if (audioEnabled) playEntranceSound();
  }, [audioEnabled]);

  const playSpeak = useCallback(() => {
    if (audioEnabled) playSpeakSound();
  }, [audioEnabled]);

  const playShutter = useCallback(() => {
    if (audioEnabled) playShutterSound();
  }, [audioEnabled]);

  return (
    <AudioCtx.Provider value={{ audioEnabled, toggleAudio, playEntrance, playSpeak, playShutter }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  return useContext(AudioCtx);
}
