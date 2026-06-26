import { useMusicStore } from '../store/musicStore';
import MusicRuntime from './MusicRuntime';

export default function MusicRuntimeGate() {
  const runtimeEnabled = useMusicStore((s) => s.runtimeEnabled);

  if (!runtimeEnabled) return null;

  return <MusicRuntime />;
}
