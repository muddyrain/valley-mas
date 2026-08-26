import { Crepe } from '@milkdown/crepe';
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
      button.removeAttribute('title');
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let topBarObserver: MutationObserver | null = null;
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

        const topBar = host.querySelector('.milkdown-top-bar');
        if (topBar) {
          topBarObserver = new MutationObserver(applyTopBarTooltips);
          topBarObserver.observe(topBar, { childList: true, subtree: true });
        }
      })
      .catch((error) => {
        console.error('Failed to initialize Milkdown editor.', error);
      });

    return () => {
      disposed = true;
      topBarObserver?.disconnect();
      crepeRef.current = null;
      pendingSyncedMarkdownRef.current = null;
      host.innerHTML = '';
      void crepe.destroy().catch(() => undefined);
    };
  }, [applyTopBarTooltips, headingOptions]);

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
