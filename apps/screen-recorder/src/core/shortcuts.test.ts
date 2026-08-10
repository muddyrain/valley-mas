import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  preserveShortcutDraft,
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
    expect(
      shortcutFromKeyboardInput({
        key: '¡',
        code: 'Digit1',
        ctrlKey: false,
        shiftKey: true,
        altKey: true,
      }),
    ).toBe('Alt+Shift+1');
  });

  it('uses the macOS Command accelerator name for the Command key', () => {
    expect(
      shortcutFromKeyboardInput(
        {
          key: 'a',
          code: 'KeyA',
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
          metaKey: true,
        },
        'darwin',
      ),
    ).toBe('Control+Command+A');
  });

  it('migrates a saved macOS Super shortcut to the Command accelerator name', () => {
    expect(
      validateShortcutSettings(
        {
          screenshot: 'Control+Super+A',
          recording: 'Control+Alt+R',
          colorPicker: 'Control+Alt+C',
        },
        'darwin',
      ),
    ).toEqual({
      screenshot: 'Control+Command+A',
      recording: 'Control+Alt+R',
      colorPicker: 'Control+Alt+C',
    });
  });

  it('provides separate defaults for all three capture actions', () => {
    expect(new Set(Object.values(DEFAULT_SHORTCUTS))).toHaveLength(3);
  });

  it('keeps an unsaved shortcut draft when the main process broadcasts persisted settings', () => {
    const draft = {
      screenshot: 'Control+Alt+Shift+8',
      recording: 'Control+Alt+Shift+2',
      colorPicker: 'Control+Alt+Shift+3',
    };

    expect(preserveShortcutDraft(draft, DEFAULT_SHORTCUTS)).toBe(draft);
    expect(preserveShortcutDraft(undefined, DEFAULT_SHORTCUTS)).toEqual(DEFAULT_SHORTCUTS);
  });
});
