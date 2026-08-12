import { type SimulationSpeed, speedForShortcut } from './runtimeRules';

export type PlaybackShortcutAction =
  | { type: 'toggle-pause' }
  | { type: 'set-speed'; speed: SimulationSpeed };

export interface PlaybackShortcutInput {
  key: string;
  code: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  targetTagName?: string;
  targetIsContentEditable?: boolean;
  dialogOpen?: boolean;
}

export function resolvePlaybackShortcut(
  input: PlaybackShortcutInput,
): PlaybackShortcutAction | null {
  const tagName = input.targetTagName?.toUpperCase();
  if (
    input.repeat ||
    input.ctrlKey ||
    input.metaKey ||
    input.altKey ||
    input.dialogOpen ||
    input.targetIsContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  ) {
    return null;
  }
  if (input.code === 'Space' || input.key === ' ') return { type: 'toggle-pause' };
  const speed = speedForShortcut(input.key);
  return speed === null ? null : { type: 'set-speed', speed };
}
