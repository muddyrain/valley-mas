import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  bulletListSchema,
  emphasisSchema,
  listItemSchema,
  orderedListSchema,
  toggleEmphasisCommand,
} from '@milkdown/kit/preset/commonmark';
import { liftListItem, wrapInList } from '@milkdown/kit/prose/schema-list';
import { replaceAll } from '@milkdown/kit/utils';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { normalizeHtmlImageTags, normalizeOrderedListStarts } from '@/utils/blog';

type HeadingOption = {
  label: string;
  level: number | null;
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

const TOP_BAR_ITEM_LABELS = [
  '加粗',
  '斜体',
  '删除线',
  '行内代码',
  '无序列表',
  '有序列表',
  '任务列表',
  '插入链接',
  '插入图片',
  '插入表格',
  '插入代码块',
  '插入公式',
  '插入引用',
  '插入分隔线',
] as const;

type ListKind = 'bullet' | 'ordered' | 'task';

function getActiveListKind(ctx: Ctx): ListKind | null {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  const listItemType = listItemSchema.type(ctx);
  const bulletListType = bulletListSchema.type(ctx);
  const orderedListType = orderedListSchema.type(ctx);
  let listItemChecked: boolean | null | undefined;
  let listKind: Exclude<ListKind, 'task'> | null = null;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === listItemType && listItemChecked === undefined) {
      listItemChecked = node.attrs.checked as boolean | null;
    }
    if (node.type === bulletListType && listKind === null) listKind = 'bullet';
    if (node.type === orderedListType && listKind === null) listKind = 'ordered';
  }

  if (listKind === 'bullet' && listItemChecked !== undefined && listItemChecked !== null)
    return 'task';
  return listKind;
}

function findListItemDepth(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { $from } = view.state.selection;
  const listItemType = listItemSchema.type(ctx);

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type === listItemType) return depth;
  }

  return null;
}

function setCurrentListItemChecked(ctx: Ctx, checked: boolean | null) {
  const view = ctx.get(editorViewCtx);
  const itemDepth = findListItemDepth(ctx);
  if (itemDepth === null) return false;

  const { $from } = view.state.selection;
  const item = $from.node(itemDepth);
  const itemPosition = $from.before(itemDepth);
  view.dispatch(
    view.state.tr.setNodeMarkup(itemPosition, undefined, {
      ...item.attrs,
      checked,
    }),
  );
  return true;
}

function syncTopBarListState(ctx: Ctx) {
  requestAnimationFrame(() => {
    const view = ctx.get(editorViewCtx);
    if (view.isDestroyed) return;

    const activeListKind = getActiveListKind(ctx);
    const host = view.dom.closest('.valley-md-editor-shell');
    const listKindByLabel: Record<string, ListKind> = {
      无序列表: 'bullet',
      有序列表: 'ordered',
      任务列表: 'task',
    };
    host
      ?.querySelectorAll<HTMLButtonElement>('.milkdown-top-bar .top-bar-item')
      .forEach((button) => {
        const listKind = listKindByLabel[button.getAttribute('aria-label') ?? ''];
        if (!listKind) return;
        const isActive = listKind === activeListKind;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
  });
}

function toggleList(ctx: Ctx, target: ListKind) {
  const view = ctx.get(editorViewCtx);
  const current = getActiveListKind(ctx);
  const listItemType = listItemSchema.type(ctx);

  if (current === target) {
    liftListItem(listItemType)(view.state, view.dispatch);
    syncTopBarListState(ctx);
    view.focus();
    return;
  }

  if (current !== null) {
    liftListItem(listItemType)(view.state, view.dispatch);
    const targetListType =
      target === 'ordered' ? orderedListSchema.type(ctx) : bulletListSchema.type(ctx);
    wrapInList(targetListType)(view.state, view.dispatch);
    if (target === 'task') setCurrentListItemChecked(ctx, false);
    syncTopBarListState(ctx);
    view.focus();
    return;
  }

  const targetListType =
    target === 'ordered' ? orderedListSchema.type(ctx) : bulletListSchema.type(ctx);
  wrapInList(targetListType)(view.state, view.dispatch);
  if (target === 'task') setCurrentListItemChecked(ctx, false);
  syncTopBarListState(ctx);
  view.focus();
}

function toggleItalicForSelectionOrCurrentWord(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  const { state } = view;
  const { selection } = state;
  const markType = emphasisSchema.type(ctx);

  if (!selection.empty || !selection.$from.parent.isTextblock) {
    ctx.get(commandsCtx).call(toggleEmphasisCommand.key);
    view.focus();
    return;
  }

  const text = selection.$from.parent.textContent;
  let start = selection.$from.parentOffset;
  let end = start;
  const isWordCharacter = (character: string) => /[\p{L}\p{N}_]/u.test(character);

  if (start > 0 && isWordCharacter(text[start - 1] ?? '')) start -= 1;
  while (start > 0 && isWordCharacter(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && isWordCharacter(text[end] ?? '')) end += 1;

  if (start === end) {
    ctx.get(commandsCtx).call(toggleEmphasisCommand.key);
    view.focus();
    return;
  }

  const from = selection.$from.start() + start;
  const to = selection.$from.start() + end;
  const removeMark = state.doc.rangeHasMark(from, to, markType);
  const transaction = removeMark
    ? state.tr.removeMark(from, to, markType)
    : state.tr.addMark(from, to, markType.create());
  const storedMarks = (state.storedMarks ?? selection.$from.marks()).filter(
    (mark) => mark.type !== markType,
  );
  transaction.setStoredMarks(removeMark ? storedMarks : [...storedMarks, markType.create()]);
  view.dispatch(transaction);
  view.focus();
}

function replaceExactText(root: Element, source: string, target: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.textContent?.trim() === source) {
      currentNode.textContent = currentNode.textContent.replace(source, target);
      return;
    }
    currentNode = walker.nextNode();
  }
}

function normalizeEditorMarkdown(value: string) {
  return normalizeOrderedListStarts(normalizeHtmlImageTags(value));
}

export function MdxMarkdownEditor({
  value,
  onChange,
  className,
  selectionHeadingOptions,
}: MdxMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const latestMarkdownRef = useRef(normalizeEditorMarkdown(value));
  const valueRef = useRef(normalizeEditorMarkdown(value));
  const onChangeRef = useRef(onChange);
  const pendingSyncedMarkdownRef = useRef<string | null>(null);
  const headingOptions = useMemo(
    () =>
      selectionHeadingOptions && selectionHeadingOptions.length > 0
        ? selectionHeadingOptions
        : DEFAULT_HEADING_OPTIONS,
    [selectionHeadingOptions],
  );

  useEffect(() => {
    const normalizedValue = normalizeEditorMarkdown(value);
    valueRef.current = normalizedValue;
    if (normalizedValue !== value) onChangeRef.current(normalizedValue);
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const applyTopBarTooltips = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const topBar = host.querySelector('.milkdown-top-bar');
    if (!topBar) return;

    const buttons = topBar.querySelectorAll<HTMLButtonElement>('.top-bar-item');
    buttons.forEach((button, index) => {
      const label = TOP_BAR_ITEM_LABELS[index];
      if (!label) return;

      button.setAttribute('aria-label', label);
      button.setAttribute('data-tooltip', label);
      if (index <= 7) {
        button.setAttribute('aria-pressed', String(button.classList.contains('active')));
      }
      button.removeAttribute('title');
    });
  }, []);

  const localizeEditorChrome = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    host.querySelectorAll('.milkdown-code-block .language-button').forEach((button) => {
      replaceExactText(button, 'Text', '纯文本');
    });
    host.querySelectorAll('.milkdown-code-block .tools-button-group button').forEach((button) => {
      replaceExactText(button, 'Copy', '复制');
    });
    host
      .querySelectorAll<HTMLButtonElement>(
        ".milkdown-table-block .line-handle[data-role='x-line-drag-handle'] .add-button",
      )
      .forEach((button) => {
        button.setAttribute('aria-label', '在此新增行');
        button.setAttribute('title', '在此新增行');
      });
    host
      .querySelectorAll<HTMLButtonElement>(
        ".milkdown-table-block .line-handle[data-role='y-line-drag-handle'] .add-button",
      )
      .forEach((button) => {
        button.setAttribute('aria-label', '在此新增列');
        button.setAttribute('title', '在此新增列');
      });
    host
      .querySelectorAll<HTMLElement>(
        ".milkdown-table-block .cell-handle[data-role='col-drag-handle']",
      )
      .forEach((handle) => {
        handle.setAttribute('aria-label', '拖动列');
      });
    host
      .querySelectorAll<HTMLElement>(
        ".milkdown-table-block .cell-handle[data-role='row-drag-handle']",
      )
      .forEach((handle) => {
        handle.setAttribute('aria-label', '拖动行');
      });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let topBarObserver: MutationObserver | null = null;
    let editorChromeObserver: MutationObserver | null = null;
    const crepe = new Crepe({
      root: host,
      defaultValue: valueRef.current,
      features: {
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.Toolbar]: false,
      },
      featureConfigs: {
        [Crepe.Feature.TopBar]: {
          headingOptions,
          buildTopBar: (builder) => {
            const formattingItems = builder.getGroup('formatting').group.items;
            const italicItem = formattingItems.find((item) => item.key === 'italic');
            if (italicItem) italicItem.onRun = toggleItalicForSelectionOrCurrentWord;

            const listItems = builder.getGroup('list').group.items;
            listItems.forEach((item) => {
              if (item.key === 'bullet-list') {
                item.active = (ctx) => getActiveListKind(ctx) === 'bullet';
                item.onRun = (ctx) => toggleList(ctx, 'bullet');
              }
              if (item.key === 'ordered-list') {
                item.active = (ctx) => getActiveListKind(ctx) === 'ordered';
                item.onRun = (ctx) => toggleList(ctx, 'ordered');
              }
              if (item.key === 'task-list') {
                item.active = (ctx) => getActiveListKind(ctx) === 'task';
                item.onRun = (ctx) => toggleList(ctx, 'task');
              }
            });
          },
        },
        [Crepe.Feature.Placeholder]: {
          text: PLACEHOLDER_TEXT,
          mode: 'doc',
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        const normalizedMarkdown = normalizeEditorMarkdown(markdown);
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
        const currentMarkdown = normalizeEditorMarkdown(crepe.getMarkdown());
        const nextMarkdown = valueRef.current;
        latestMarkdownRef.current = currentMarkdown;

        if (nextMarkdown !== currentMarkdown) {
          pendingSyncedMarkdownRef.current = nextMarkdown;
          latestMarkdownRef.current = nextMarkdown;
          crepe.editor.action(replaceAll(nextMarkdown, true));
        }

        applyTopBarTooltips();
        localizeEditorChrome();

        const topBar = host.querySelector('.milkdown-top-bar');
        if (topBar) {
          topBarObserver = new MutationObserver(applyTopBarTooltips);
          topBarObserver.observe(topBar, {
            attributes: true,
            attributeFilter: ['class'],
            childList: true,
            subtree: true,
          });
        }
        editorChromeObserver = new MutationObserver(localizeEditorChrome);
        editorChromeObserver.observe(host, { childList: true, subtree: true });
      })
      .catch((error) => {
        console.error('Failed to initialize Milkdown editor.', error);
      });

    return () => {
      disposed = true;
      topBarObserver?.disconnect();
      editorChromeObserver?.disconnect();
      crepeRef.current = null;
      pendingSyncedMarkdownRef.current = null;
      host.innerHTML = '';
      void crepe.destroy().catch(() => undefined);
    };
  }, [applyTopBarTooltips, headingOptions, localizeEditorChrome]);

  useEffect(() => {
    valueRef.current = normalizeEditorMarkdown(value);
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

  return (
    <div className={cn('valley-md-editor-shell', className)}>
      <div ref={hostRef} className="valley-md-editor-root" />
    </div>
  );
}
