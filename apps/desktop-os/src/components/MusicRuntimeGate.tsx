import { useMusicStore } from '../store/musicStore';
import { useWindowStore } from '../store/windowStore';
import MusicRuntime from './MusicRuntime';
import { shouldRunMusicRuntime } from './runtimeGatePolicy';

export default function MusicRuntimeGate() {
  const runtimeEnabled = useMusicStore((s) => s.runtimeEnabled);
  const isMusicWindowRunning = useWindowStore((s) => s.runningAppIds.includes('music'));
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isBuffering = useMusicStore((s) => s.isBuffering);

  if (!shouldRunMusicRuntime({ runtimeEnabled, isMusicWindowRunning, isPlaying, isBuffering })) {
    return null;
  }

  return <MusicRuntime />;
}
