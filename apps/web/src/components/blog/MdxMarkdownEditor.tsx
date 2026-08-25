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

  const applyTopBarTooltipTitles = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    const topBar = host.querySelector('.milkdown-top-bar');
    if (!topBar) return;

    const buttonLikeElements = topBar.querySelectorAll<HTMLElement>('[aria-label]');
    buttonLikeElements.forEach((element) => {
      const label = element.getAttribute('aria-label');
      if (!label) return;
      element.setAttribute('title', label);
      element.setAttribute('data-title', label);
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
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

        applyTopBarTooltipTitles();
      })
      .catch((error) => {
        console.error('Failed to initialize Milkdown editor.', error);
      });

    return () => {
      disposed = true;
      crepeRef.current = null;
      pendingSyncedMarkdownRef.current = null;
      host.innerHTML = '';
      void crepe.destroy().catch(() => undefined);
    };
  }, [applyTopBarTooltipTitles, headingOptions]);

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
