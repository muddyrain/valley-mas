import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  shortcutFromKeyboardInput,
  validateShortcutSettings,
} from './shortcuts';

describe('shortcut settings', () => {
  it('accepts supported accelerators and normalizes modifier order', () => {
    expect(
      validateShortcutSettings({
        screenshot: 'shift+control+s',
        recording: 'Alt+F9',
        colorPicker: 'Control+Alt+C',
      }),
    ).toEqual({
      screenshot: 'Control+Shift+S',
      recording: 'Alt+F9',
      colorPicker: 'Control+Alt+C',
    });
  });

  it('preserves legacy screenshot and recording shortcuts while adding the color picker default', () => {
    expect(
      validateShortcutSettings({ screenshot: 'Control+Alt+A', recording: 'Control+Alt+R' }),
    ).toEqual({
      screenshot: 'Control+Alt+A',
      recording: 'Control+Alt+R',
      colorPicker: DEFAULT_SHORTCUTS.colorPicker,
    });
  });

  it('rejects duplicate, modifier-only, and unsafe single-key shortcuts', () => {
    expect(() =>
      validateShortcutSettings({
        screenshot: 'Control+S',
        recording: 'control+s',
        colorPicker: 'Control+Alt+C',
      }),
    ).toThrow('快捷键不能重复');
    expect(() =>
      validateShortcutSettings({
        screenshot: 'Control+Shift',
        recording: 'Alt+F9',
        colorPicker: 'Control+Alt+C',
      }),
    ).toThrow('截图快捷键无效');
    expect(() =>
      validateShortcutSettings({
        screenshot: 'S',
        recording: 'Alt+F9',
        colorPicker: 'Control+Alt+C',
      }),
    ).toThrow('截图快捷键无效');
    expect(() =>
      validateShortcutSettings({
        screenshot: 'Control+Alt+A',
        recording: 'Control+Alt+R',
        colorPicker: 'control+alt+a',
      }),
    ).toThrow('快捷键不能重复');
  });

  it('converts a keyboard event into an Electron accelerator', () => {
    expect(
      shortcutFromKeyboardInput({ key: 'S', ctrlKey: true, shiftKey: true, altKey: false }),
    ).toBe('Control+Shift+S');
    expect(
      shortcutFromKeyboardInput({ key: 'F9', ctrlKey: false, shiftKey: false, altKey: false }),
    ).toBe('F9');
  });

  it('provides separate defaults for all three capture actions', () => {
    expect(new Set(Object.values(DEFAULT_SHORTCUTS))).toHaveLength(3);
  });
});
