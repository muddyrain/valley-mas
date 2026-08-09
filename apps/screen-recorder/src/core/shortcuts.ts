export type ShortcutSettings = {
  screenshot: string;
  recording: string;
  colorPicker: string;
};

export type KeyboardShortcutInput = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey?: boolean;
};

export const DEFAULT_SHORTCUTS: ShortcutSettings = {
  screenshot: 'Control+Alt+Shift+1',
  recording: 'Control+Alt+Shift+2',
  colorPicker: 'Control+Alt+Shift+3',
};

const MODIFIER_ORDER = ['Control', 'Alt', 'Shift', 'Super'] as const;
const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  shift: 'Shift',
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

export function validateShortcutSettings(value: unknown): ShortcutSettings {
  if (!value || typeof value !== 'object') {
    throw new Error('快捷键设置无效');
  }
  const source = value as Record<string, unknown>;
  const screenshot =
    typeof source.screenshot === 'string' ? normalizeShortcut(source.screenshot) : undefined;
  const recording =
    typeof source.recording === 'string' ? normalizeShortcut(source.recording) : undefined;
  const colorPicker =
    source.colorPicker === undefined
      ? DEFAULT_SHORTCUTS.colorPicker
      : typeof source.colorPicker === 'string'
        ? normalizeShortcut(source.colorPicker)
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

export function shortcutFromKeyboardInput(input: KeyboardShortcutInput): string | undefined {
  const key = normalizeKey(input.key === ' ' ? 'Space' : input.key);
  if (!key) {
    return undefined;
  }
  const parts = [
    input.ctrlKey ? 'Control' : undefined,
    input.altKey ? 'Alt' : undefined,
    input.shiftKey ? 'Shift' : undefined,
    input.metaKey ? 'Super' : undefined,
    key,
  ].filter((part): part is string => Boolean(part));
  return normalizeShortcut(parts.join('+'));
}
