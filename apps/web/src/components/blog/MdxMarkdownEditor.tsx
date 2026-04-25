import { Crepe } from '@milkdown/crepe';
import { replaceAll } from '@milkdown/kit/utils';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { normalizeOrderedListStarts } from '@/utils/blog';

interface MdxMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const PLACEHOLDER_TEXT = '在这里输入或粘贴 Markdown，标题、列表、代码块会自动识别';

export function MdxMarkdownEditor({ value, onChange, className }: MdxMarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const latestMarkdownRef = useRef(normalizeOrderedListStarts(value));
  const valueRef = useRef(normalizeOrderedListStarts(value));
  const onChangeRef = useRef(onChange);
  const pendingSyncedMarkdownRef = useRef<string | null>(null);

  useEffect(() => {
    valueRef.current = normalizeOrderedListStarts(value);
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
  }, []);

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

  return (
    <div className={cn('valley-md-editor-shell', className)}>
      <div ref={hostRef} className="valley-md-editor-root" />
    </div>
  );
}
