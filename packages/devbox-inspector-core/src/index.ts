export const INSPECTOR_DATA_PATH_ATTR = 'data-insp-path';

export interface ParsedInspection {
  relativePath: string;
  line: number;
  column: number;
  extra: string;
}

export type ModifierKey = 'meta' | 'alt' | 'ctrl' | 'shift';

export const MODIFIER_LABELS: Record<ModifierKey, string> = {
  meta: '⌘ Command',
  alt: '⌥ Option / Alt',
  ctrl: '⌃ Control',
  shift: '⇧ Shift',
};

export const DEFAULT_EDITOR_TEMPLATE = 'vscode://file{path}:{line}:{col}';
export const DEFAULT_MODIFIERS: readonly ModifierKey[] = ['alt'];

export interface EditorPreset {
  id: string;
  label: string;
  template: string;
}

export const EDITOR_PRESETS: readonly EditorPreset[] = [
  { id: 'vscode', label: 'VS Code', template: DEFAULT_EDITOR_TEMPLATE },
  { id: 'zed', label: 'Zed', template: 'zed://file{path}:{line}:{col}' },
  { id: 'cursor', label: 'Cursor', template: 'cursor://file{path}:{line}:{col}' },
  { id: 'trae', label: 'Trae', template: 'trae://file{path}:{line}:{col}' },
];

function isIntegerSegment(segment: string): boolean {
  return segment !== '' && /^\d+$/.test(segment);
}

export function parseInspectionValue(rawValue: unknown): ParsedInspection | null {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  const parts = rawValue.split(':');
  for (let index = parts.length - 1; index >= 2; index -= 1) {
    if (!isIntegerSegment(parts[index - 1]) || !isIntegerSegment(parts[index])) {
      continue;
    }

    const relativePath = parts.slice(0, index - 1).join(':');
    if (!relativePath) {
      continue;
    }

    return {
      relativePath,
      line: Number(parts[index - 1]),
      column: Number(parts[index]),
      extra: parts.slice(index + 1).join(':'),
    };
  }

  return null;
}

export function isAbsoluteWorkspaceRoot(root: string): boolean {
  return typeof root === 'string' && root.trim().startsWith('/');
}

function joinAbsolutePath(workspaceRoot: string, relativePath: string): string {
  return `${workspaceRoot.replace(/\/+$/, '')}/${relativePath.replace(/^\/+/, '')}`;
}

export function buildOpenUrl(
  template: string,
  parts: { path: string; relPath: string; line: number; col: number },
): string {
  return template
    .replace(/\{path\}/g, parts.path)
    .replace(/\{relPath\}/g, parts.relPath)
    .replace(/\{line\}/g, String(parts.line))
    .replace(/\{col\}/g, String(parts.col));
}

export function matchesModifiers(
  event: { metaKey: boolean; altKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  required: readonly ModifierKey[],
): boolean {
  if (required.length === 0) {
    return false;
  }

  const held = {
    meta: event.metaKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
  };

  return required.every((modifier) => held[modifier]);
}

export type OpenTargetResult =
  | {
      ok: true;
      url: string;
      parsed: ParsedInspection;
    }
  | {
      ok: false;
      reason: 'invalid-value';
      parsed?: undefined;
    }
  | {
      ok: false;
      reason: 'no-workspace-root';
      parsed: ParsedInspection;
    }
  | {
      ok: false;
      reason: 'no-template';
      parsed: ParsedInspection;
    };

export function resolveOpenTarget(
  rawValue: unknown,
  workspaceRoot: string,
  template: string,
): OpenTargetResult {
  const parsed = parseInspectionValue(rawValue);
  if (!parsed) {
    return { ok: false, reason: 'invalid-value' };
  }
  if (!isAbsoluteWorkspaceRoot(workspaceRoot)) {
    return { ok: false, reason: 'no-workspace-root', parsed };
  }
  if (!template.trim()) {
    return { ok: false, reason: 'no-template', parsed };
  }

  return {
    ok: true,
    parsed,
    url: buildOpenUrl(template, {
      path: joinAbsolutePath(workspaceRoot, parsed.relativePath),
      relPath: parsed.relativePath,
      line: parsed.line,
      col: parsed.column,
    }),
  };
}

export function findInspectableElement(startNode: Node | null, attrName: string): Element | null {
  let current: Node | null = startNode;

  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE && (current as Element).hasAttribute(attrName)) {
      return current as Element;
    }

    if (current.parentNode) {
      current = current.parentNode;
      continue;
    }

    const root = typeof current.getRootNode === 'function' ? current.getRootNode() : null;
    const host = (root as ShadowRoot | null)?.host ?? null;
    current = host && host !== current ? host : null;
  }

  return null;
}
