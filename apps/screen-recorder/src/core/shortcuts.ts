export type ShortcutSettings = {
  screenshot: string;
  recording: string;
  colorPicker: string;
};

export type KeyboardShortcutInput = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey?: boolean;
};

function normalizeKeyboardCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^Key[A-Z]$/.test(value)) return value.slice(3);
  if (/^Digit[0-9]$/.test(value)) return value.slice(5);
  return undefined;
}

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  screenshot: 'Control+Alt+Shift+1',
  recording: 'Control+Alt+Shift+2',
  colorPicker: 'Control+Alt+Shift+3',
};

const MODIFIER_ORDER = ['Control', 'Alt', 'Shift', 'Command', 'Super'] as const;
const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
  command: 'Command',
  cmd: 'Command',
  super: 'Super',
  meta: 'Super',
  win: 'Super',
};
const NAMED_KEYS: Record<string, string> = {
  printscreen: 'PrintScreen',
  space: 'Space',
  tab: 'Tab',
  insert: 'Insert',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
};

function normalizeKey(value: string): string | undefined {
  const trimmed = value.trim();
  if (/^[a-z0-9]$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  if (/^f(?:[1-9]|1\d|2[0-4])$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return NAMED_KEYS[trimmed.toLowerCase()];
}

export function normalizeShortcut(value: string): string | undefined {
  if (value.length === 0 || value.length > 64) {
    return undefined;
  }
  const parts = value.split('+').map((part) => part.trim());
  const modifiers = new Set<(typeof MODIFIER_ORDER)[number]>();
  let key: string | undefined;
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    const normalizedKey = normalizeKey(part);
    if (!normalizedKey || key) {
      return undefined;
    }
    key = normalizedKey;
  }
  if (!key) {
    return undefined;
  }
  const isFunctionKey = /^F(?:[1-9]|1\d|2[0-4])$/.test(key) || key === 'PrintScreen';
  if (modifiers.size === 0 && !isFunctionKey) {
    return undefined;
  }
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), key].join('+');
}

function normalizeShortcutForPlatform(value: string, platform: string): string | undefined {
  const platformValue =
    platform === 'darwin'
      ? value
          .split('+')
          .map((part) => (/^(?:super|meta|win)$/i.test(part.trim()) ? 'Command' : part))
          .join('+')
      : value;
  return normalizeShortcut(platformValue);
}

export function validateShortcutSettings(value: unknown, platform = 'other'): ShortcutSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('快捷键设置无效');
  }
  const source = value as Record<string, unknown>;
  const screenshot =
    typeof source.screenshot === 'string'
      ? normalizeShortcutForPlatform(source.screenshot, platform)
      : undefined;
  const recording =
    typeof source.recording === 'string'
      ? normalizeShortcutForPlatform(source.recording, platform)
      : undefined;
  const colorPicker =
    source.colorPicker === undefined
      ? DEFAULT_SHORTCUTS.colorPicker
      : typeof source.colorPicker === 'string'
        ? normalizeShortcutForPlatform(source.colorPicker, platform)
        : undefined;
  if (!screenshot) {
    throw new Error('截图快捷键无效');
  }
  if (!recording) {
    throw new Error('录屏快捷键无效');
  }
  if (!colorPicker) {
    throw new Error('吸色快捷键无效');
  }
  const normalized = [screenshot, recording, colorPicker].map((shortcut) => shortcut.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('快捷键不能重复');
  }
  return { screenshot, recording, colorPicker };
}

export function shortcutFromKeyboardInput(
  input: KeyboardShortcutInput,
  platform = 'other',
): string | undefined {
  const key =
    normalizeKeyboardCode(input.code) ?? normalizeKey(input.key === ' ' ? 'Space' : input.key);
  if (!key) {
    return undefined;
  }
  const parts = [
    input.ctrlKey ? 'Control' : undefined,
    input.altKey ? 'Alt' : undefined,
    input.shiftKey ? 'Shift' : undefined,
    input.metaKey ? (platform === 'darwin' ? 'Command' : 'Super') : undefined,
    key,
  ].filter((part): part is string => Boolean(part));
  return normalizeShortcut(parts.join('+'));
}

export function preserveShortcutDraft(
  current: ShortcutSettings | undefined,
  persisted: ShortcutSettings,
): ShortcutSettings {
  return current ?? { ...persisted };
}
