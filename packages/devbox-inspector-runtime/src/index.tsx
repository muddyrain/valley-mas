import {
  DEFAULT_EDITOR_TEMPLATE,
  DEFAULT_MODIFIERS,
  findInspectableElement,
  INSPECTOR_DATA_PATH_ATTR,
  type ModifierKey,
  matchesModifiers,
  type OpenTargetResult,
  type ParsedInspection,
  parseInspectionValue,
  resolveOpenTarget,
} from '@valley/devbox-inspector-core';
import { type ReactElement, useEffect } from 'react';

const OVERLAY_ID = '__devbox_inspector_overlay__';
const TOOLTIP_ID = '__devbox_inspector_tooltip__';

function ensureOverlay(): { overlay: HTMLElement; tooltip: HTMLElement } {
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: 'fixed',
      boxSizing: 'border-box',
      border: '2px solid #8b5cf6',
      background: 'rgba(139, 92, 246, 0.22)',
      boxShadow: '0 0 0 1px rgba(139, 92, 246, 0.35), 0 4px 16px rgba(139, 92, 246, 0.35)',
      borderRadius: '4px',
      zIndex: '2147483646',
      pointerEvents: 'none',
      display: 'none',
    });
    document.documentElement.appendChild(overlay);
  }

  let tooltip = document.getElementById(TOOLTIP_ID);
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    Object.assign(tooltip.style, {
      position: 'fixed',
      maxWidth: '520px',
      padding: '6px 8px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '12px',
      lineHeight: '1.4',
      color: '#ecfeff',
      background: 'rgba(15, 23, 42, 0.94)',
      border: '1px solid rgba(167, 139, 250, 0.7)',
      borderRadius: '6px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      display: 'none',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    });
    document.documentElement.appendChild(tooltip);
  }

  return { overlay: overlay as HTMLElement, tooltip: tooltip as HTMLElement };
}

function renderTooltip(
  tooltip: HTMLElement,
  parsed: ParsedInspection | null,
  workspaceRoot: string,
): void {
  tooltip.textContent = '';
  if (!parsed) {
    tooltip.textContent = '未识别 data-insp-path';
    return;
  }

  const rootLine = document.createElement('div');
  rootLine.textContent = workspaceRoot || '⚠️ 未配置 workspaceRoot，点击会提示';
  Object.assign(rootLine.style, {
    fontSize: '11px',
    color: workspaceRoot ? 'rgba(226, 232, 240, 0.6)' : '#fbbf24',
  });

  const relLine = document.createElement('div');
  relLine.textContent = `${parsed.relativePath}:${parsed.line}:${parsed.column}`;
  Object.assign(relLine.style, {
    marginTop: '2px',
    fontWeight: '600',
    color: '#ede9fe',
  });

  tooltip.append(rootLine, relLine);
}

function showTooltipFor(
  overlay: HTMLElement,
  tooltip: HTMLElement,
  el: Element,
  workspaceRoot: string,
): void {
  const parsed = resolveInfo(el);
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 && rect.height <= 0) {
    hideInspectorUI();
    return;
  }

  overlay.style.display = 'block';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;

  renderTooltip(tooltip, parsed, workspaceRoot);
  tooltip.style.display = 'block';
  tooltip.style.left = `${Math.max(8, rect.left)}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;

  requestAnimationFrame(() => {
    if (tooltip.style.display === 'none') {
      return;
    }
    const nextTop = rect.top - tooltip.getBoundingClientRect().height - 8;
    if (nextTop >= 8) {
      tooltip.style.top = `${nextTop}px`;
    }
  });
}

function hideInspectorUI(): void {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(TOOLTIP_ID)?.remove();
}

function resolveInfo(el: Element): ParsedInspection | null {
  return parseInspectionValue(el.getAttribute(INSPECTOR_DATA_PATH_ATTR));
}

export interface InspectorRuntimeProps {
  enabled?: boolean;
  workspaceRoot?: string;
  template?: string;
  modifiers?: readonly ModifierKey[];
  onOpen?: (url: string) => void;
  onInvalid?: () => void;
  onNoTemplate?: () => void;
  onNoWorkspaceRoot?: () => void;
}

export function InspectorRuntime({
  enabled = false,
  workspaceRoot = '',
  template = DEFAULT_EDITOR_TEMPLATE,
  modifiers = DEFAULT_MODIFIERS,
  onOpen,
  onInvalid,
  onNoTemplate,
  onNoWorkspaceRoot,
}: InspectorRuntimeProps): ReactElement | null {
  useEffect(() => {
    if (!enabled) {
      hideInspectorUI();
      return;
    }

    const onMouseMove = (event: MouseEvent): void => {
      const { overlay, tooltip } = ensureOverlay();
      if (!matchesModifiers(event, modifiers)) {
        hideInspectorUI();
        return;
      }

      const start = ((event.composedPath?.()[0] as Node | undefined) ??
        event.target) as Node | null;
      const target = findInspectableElement(start, INSPECTOR_DATA_PATH_ATTR);
      if (!target) {
        hideInspectorUI();
        return;
      }
      showTooltipFor(overlay, tooltip, target, workspaceRoot);
    };

    const onClick = (event: MouseEvent): void => {
      if (!matchesModifiers(event, modifiers)) {
        return;
      }

      const start = ((event.composedPath?.()[0] as Node | undefined) ??
        event.target) as Node | null;
      const target = findInspectableElement(start, INSPECTOR_DATA_PATH_ATTR);
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const result: OpenTargetResult = resolveOpenTarget(
        target.getAttribute(INSPECTOR_DATA_PATH_ATTR),
        workspaceRoot,
        template,
      );

      if (result.ok) {
        (onOpen ?? ((url: string) => window.location.assign(url)))(result.url);
      } else if (result.reason === 'no-workspace-root') {
        (
          onNoWorkspaceRoot ??
          (() => {
            // eslint-disable-next-line no-console
            console.warn('[data-inspector] Missing workspaceRoot', result.parsed);
          })
        )();
      } else if (result.reason === 'no-template') {
        (
          onNoTemplate ??
          (() => {
            // eslint-disable-next-line no-console
            console.warn('[data-inspector] Missing editor template', result.parsed);
          })
        )();
      } else {
        (
          onInvalid ??
          (() => {
            // eslint-disable-next-line no-console
            console.warn(
              '[data-inspector] Invalid data-insp-path',
              target.getAttribute(INSPECTOR_DATA_PATH_ATTR),
            );
          })
        )();
      }

      hideInspectorUI();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', onClick, true);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('click', onClick, true);
      hideInspectorUI();
    };
  }, [
    enabled,
    modifiers,
    onInvalid,
    onNoTemplate,
    onNoWorkspaceRoot,
    onOpen,
    template,
    workspaceRoot,
  ]);

  return null;
}
