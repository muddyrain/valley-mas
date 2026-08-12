import { describe, expect, it } from 'vitest';
import { resolvePlaybackShortcut } from './playbackShortcuts';

describe('playback shortcuts', () => {
  it('maps Space and the four number keys to player-owned playback controls', () => {
    expect(resolvePlaybackShortcut({ key: ' ', code: 'Space' })).toEqual({ type: 'toggle-pause' });
    expect(resolvePlaybackShortcut({ key: '1', code: 'Digit1' })).toEqual({
      type: 'set-speed',
      speed: 1,
    });
    expect(resolvePlaybackShortcut({ key: '2', code: 'Digit2' })).toEqual({
      type: 'set-speed',
      speed: 2,
    });
    expect(resolvePlaybackShortcut({ key: '3', code: 'Digit3' })).toEqual({
      type: 'set-speed',
      speed: 4,
    });
    expect(resolvePlaybackShortcut({ key: '4', code: 'Digit4' })).toEqual({
      type: 'set-speed',
      speed: 8,
    });
  });

  it('ignores repeats, modifiers, text editing and open dialogs', () => {
    const base = { key: '4', code: 'Digit4' };
    expect(resolvePlaybackShortcut({ ...base, repeat: true })).toBeNull();
    expect(resolvePlaybackShortcut({ ...base, ctrlKey: true })).toBeNull();
    expect(resolvePlaybackShortcut({ ...base, targetTagName: 'INPUT' })).toBeNull();
    expect(resolvePlaybackShortcut({ ...base, targetTagName: 'TEXTAREA' })).toBeNull();
    expect(resolvePlaybackShortcut({ ...base, targetIsContentEditable: true })).toBeNull();
    expect(resolvePlaybackShortcut({ ...base, dialogOpen: true })).toBeNull();
    expect(resolvePlaybackShortcut({ key: '5', code: 'Digit5' })).toBeNull();
  });
});
