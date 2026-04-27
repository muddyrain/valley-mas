import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import {
  headingSchema,
  paragraphSchema,
  setBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark';
import { replaceAll } from '@milkdown/kit/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeOrderedListStarts } from '@/utils/blog';

type HeadingOption = {
  label: string;
  level: number | null;
};

type FloatingToolbarState = {
  top: number;
  left: number;
  activeLabel: string;
};

interface MdxMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  selectionHeadingOptions?: HeadingOption[];
}

const PLACEHOLDER_TEXT = '在这里输入或粘贴 Markdown，标题、列表、代码块会自动识别';
const DEFAULT_HEADING_OPTIONS: HeadingOption[] = [
  { label: '正文', level: null },
  { label: '标题 1', level: 1 },
  { label: '标题 2', level: 2 },
  { label: '标题 3', level: 3 },
  { label: '标题 4', level: 4 },
  { label: '标题 5', level: 5 },
  { label: '标题 6', level: 6 },
];

export function MdxMarkdownEditor({
  value,
  onChange,
  className,
  selectionHeadingOptions,
}: MdxMarkdownEditorProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const floatingToolbarRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const latestMarkdownRef = useRef(normalizeOrderedListStarts(value));
  const valueRef = useRef(normalizeOrderedListStarts(value));
  const onChangeRef = useRef(onChange);
  const pendingSyncedMarkdownRef = useRef<string | null>(null);
  const [floatingToolbarState, setFloatingToolbarState] = useState<FloatingToolbarState | null>(
    null,
  );
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const headingOptions = useMemo(
    () =>
      selectionHeadingOptions && selectionHeadingOptions.length > 0
        ? selectionHeadingOptions
        : DEFAULT_HEADING_OPTIONS,
    [selectionHeadingOptions],
  );

  useEffect(() => {
    valueRef.current = normalizeOrderedListStarts(value);
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const hideFloatingToolbar = useCallback(() => {
    setFloatingToolbarState(null);
    setHeadingMenuOpen(false);
  }, []);

  const updateFloatingToolbar = useCallback(() => {
    const shell = shellRef.current;
    const host = hostRef.current;
    const crepe = crepeRef.current;
    if (!shell || !host || !crepe) {
      hideFloatingToolbar();
      return;
    }

    let nextState: FloatingToolbarState | null = null;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { selection } = view.state;
      if (selection.empty) return;

      const editorRoot = host.querySelector('.ProseMirror');
      const domSelection = window.getSelection();
      if (!editorRoot || !domSelection || domSelection.rangeCount === 0) return;

      const anchorNode = domSelection.anchorNode;
      const focusNode = domSelection.focusNode;
      if (!anchorNode || !focusNode) return;
      if (!editorRoot.contains(anchorNode) || !editorRoot.contains(focusNode)) return;

      const range = domSelection.getRangeAt(0).cloneRange();
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      const shellRect = shell.getBoundingClientRect();
      const rawLeft = rect.left + rect.width / 2 - shellRect.left;
      const left = Math.min(Math.max(rawLeft, 88), Math.max(shellRect.width - 88, 88));
      const top = Math.max(rect.top - shellRect.top - 14, 18);

      const currentNode = selection.$from.parent;
      const currentLevel =
        currentNode.type === headingSchema.type(ctx) ? Number(currentNode.attrs.level || 0) : null;
      const activeOption =
        headingOptions.find((option) => option.level === currentLevel) || headingOptions[0];

      nextState = {
        top,
        left,
        activeLabel: activeOption?.label || '正文',
      };
    });

    if (!nextState) {
      hideFloatingToolbar();
      return;
    }

    const resolvedState = nextState as FloatingToolbarState;
    setFloatingToolbarState((prev) => {
      if (
        prev &&
        prev.top === resolvedState.top &&
        prev.left === resolvedState.left &&
        prev.activeLabel === resolvedState.activeLabel
      ) {
        return prev;
      }
      return resolvedState;
    });
  }, [headingOptions, hideFloatingToolbar]);

  const applyHeading = useCallback(
    (level: number | null) => {
      const crepe = crepeRef.current;
      if (!crepe) return;

      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx);
        if (level === null) {
          commands.call(setBlockTypeCommand.key, {
            nodeType: paragraphSchema.type(ctx),
          });
        } else {
          commands.call(setBlockTypeCommand.key, {
            nodeType: headingSchema.type(ctx),
            attrs: { level },
          });
        }
        ctx.get(editorViewCtx).focus();
      });

      setHeadingMenuOpen(false);
      requestAnimationFrame(() => updateFloatingToolbar());
    },
    [updateFloatingToolbar],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const crepe = new Crepe({
      root: host,
      defaultValue: valueRef.current,
      features: {
        [Crepe.Feature.TopBar]: true,
      },
      featureConfigs: {
        [Crepe.Feature.TopBar]: {
          headingOptions,
        },
        [Crepe.Feature.Placeholder]: {
          text: PLACEHOLDER_TEXT,
          mode: 'doc',
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        const normalizedMarkdown = normalizeOrderedListStarts(markdown);
        const pendingSyncedMarkdown = pendingSyncedMarkdownRef.current;
        latestMarkdownRef.current = normalizedMarkdown;

        if (pendingSyncedMarkdown !== null && normalizedMarkdown === pendingSyncedMarkdown) {
          pendingSyncedMarkdownRef.current = null;
          return;
        }

        if (normalizedMarkdown !== markdown) {
          pendingSyncedMarkdownRef.current = normalizedMarkdown;
          crepe.editor.action(replaceAll(normalizedMarkdown, true));
        }

        pendingSyncedMarkdownRef.current = null;
        if (normalizedMarkdown === valueRef.current) return;
        onChangeRef.current(normalizedMarkdown);
      });
    });

    void crepe
      .create()
      .then(() => {
        if (disposed) {
          void crepe.destroy();
          return;
        }

        crepeRef.current = crepe;
        const currentMarkdown = normalizeOrderedListStarts(crepe.getMarkdown());
        const nextMarkdown = valueRef.current;
        latestMarkdownRef.current = currentMarkdown;

        if (nextMarkdown !== currentMarkdown) {
          pendingSyncedMarkdownRef.current = nextMarkdown;
          latestMarkdownRef.current = nextMarkdown;
          crepe.editor.action(replaceAll(nextMarkdown, true));
        }

        requestAnimationFrame(() => updateFloatingToolbar());
      })
      .catch((error) => {
        console.error('Failed to initialize Milkdown editor.', error);
      });

    return () => {
      disposed = true;
      crepeRef.current = null;
      pendingSyncedMarkdownRef.current = null;
      setFloatingToolbarState(null);
      setHeadingMenuOpen(false);
      host.innerHTML = '';
      void crepe.destroy().catch(() => undefined);
    };
  }, [headingOptions, updateFloatingToolbar]);

  useEffect(() => {
    valueRef.current = normalizeOrderedListStarts(value);
    const crepe = crepeRef.current;
    if (!crepe) {
      latestMarkdownRef.current = valueRef.current;
      return;
    }

    if (valueRef.current === latestMarkdownRef.current) return;

    pendingSyncedMarkdownRef.current = valueRef.current;
    latestMarkdownRef.current = valueRef.current;
    crepe.editor.action(replaceAll(valueRef.current, true));
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scheduleUpdate = () => {
      requestAnimationFrame(() => updateFloatingToolbar());
    };

    const handleSelectionChange = () => {
      const hostNode = hostRef.current;
      const activeElement = document.activeElement;
      const selectionAnchorNode = window.getSelection()?.anchorNode ?? null;
      if (
        floatingToolbarRef.current?.contains(activeElement) ||
        floatingToolbarRef.current?.contains(document.activeElement)
      ) {
        return;
      }
      if (hostNode?.contains(activeElement) || hostNode?.contains(selectionAnchorNode)) {
        scheduleUpdate();
        return;
      }
      hideFloatingToolbar();
    };

    host.addEventListener('mouseup', scheduleUpdate);
    host.addEventListener('keyup', scheduleUpdate);
    host.addEventListener('focusin', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      host.removeEventListener('mouseup', scheduleUpdate);
      host.removeEventListener('keyup', scheduleUpdate);
      host.removeEventListener('focusin', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [hideFloatingToolbar, updateFloatingToolbar]);

  useEffect(() => {
    if (!headingMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (floatingToolbarRef.current?.contains(event.target as Node)) return;
      setHeadingMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [headingMenuOpen]);

  return (
    <div ref={shellRef} className={cn('valley-md-editor-shell', className)}>
      {floatingToolbarState ? (
        <div
          ref={floatingToolbarRef}
          className="absolute z-20 -translate-x-1/2 -translate-y-full"
          style={{
            top: floatingToolbarState.top,
            left: floatingToolbarState.left,
          }}
        >
          <div className="relative flex items-center gap-2 rounded-2xl border border-theme-soft-strong bg-white/96 px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setHeadingMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl bg-theme-soft px-3 py-1.5 text-xs font-medium text-theme-primary transition hover:bg-theme-soft/80"
            >
              <span>{floatingToolbarState.activeLabel}</span>
              <span className="text-[10px] text-theme-primary/70">
                {headingMenuOpen ? '▲' : '▼'}
              </span>
            </button>

            {headingMenuOpen ? (
              <div className="absolute left-0 top-[calc(100%+8px)] min-w-[150px] overflow-hidden rounded-2xl border border-theme-soft-strong bg-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]">
                {headingOptions.map((option) => {
                  const active = option.label === floatingToolbarState.activeLabel;
                  return (
                    <button
                      key={`${option.label}-${option.level ?? 'paragraph'}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyHeading(option.level)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition',
                        active
                          ? 'bg-theme-soft text-theme-primary'
                          : 'text-slate-600 hover:bg-theme-soft/60 hover:text-slate-900',
                      )}
                    >
                      <span>{option.label}</span>
                      {option.level === null ? (
                        <span className="text-[11px] opacity-70">P</span>
                      ) : (
                        <span className="text-[11px] opacity-70">H{option.level}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div ref={hostRef} className="valley-md-editor-root" />
    </div>
  );
}
