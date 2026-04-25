import {
  $createCodeBlockNode,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  type CodeBlockLanguage,
  CodeMirrorEditor,
  CreateLink,
  codeBlockPlugin,
  codeMirrorPlugin,
  createActiveEditorSubscription$,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  imagePlugin,
  ListsToggle,
  lexical,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  type MDXEditorMethods,
  markdownShortcutPlugin,
  quotePlugin,
  realmPlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor';
import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MdxMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CODE_BLOCK_LANGUAGES: CodeBlockLanguage[] = [
  { name: 'Plain Text', alias: ['txt', 'text', 'plaintext', 'plain'], extensions: ['txt'] },
  { name: 'Markdown', alias: ['md', 'markdown'], extensions: ['md'] },
  { name: 'JavaScript', alias: ['js', 'javascript', 'node'], extensions: ['js', 'mjs', 'cjs'] },
  { name: 'TypeScript', alias: ['ts', 'typescript'], extensions: ['ts', 'mts', 'cts'] },
  { name: 'JavaScript (React)', alias: ['jsx'], extensions: ['jsx'] },
  { name: 'TypeScript (React)', alias: ['tsx'], extensions: ['tsx'] },
  { name: 'JSON', alias: ['json'], extensions: ['json'] },
  { name: 'Bash', alias: ['bash', 'sh', 'shell', 'zsh'], extensions: ['sh', 'bash', 'zsh'] },
  { name: 'Python', alias: ['py', 'python'], extensions: ['py'] },
  { name: 'YAML', alias: ['yaml', 'yml'], extensions: ['yaml', 'yml'] },
  { name: 'SQL', alias: ['sql'], extensions: ['sql'] },
  { name: 'CSS', alias: ['css'], extensions: ['css'] },
  { name: 'HTML', alias: ['html'], extensions: ['html', 'htm'] },
];

const LANGUAGE_ALIAS_MAP = new Map<string, string>(
  CODE_BLOCK_LANGUAGES.flatMap((language) => {
    const canonical = language.alias?.[0] ?? language.name.toLowerCase();
    const candidates = new Set([
      canonical,
      language.name.toLowerCase(),
      ...(language.alias ?? []).map((alias) => alias.toLowerCase()),
      ...(language.extensions ?? []).map((extension) => extension.toLowerCase()),
    ]);
    return Array.from(candidates).map((candidate) => [candidate, canonical] as const);
  }),
);

const ZH_CN_EDITOR_TEXT: Record<string, string> = {
  'contentArea.editableMarkdown': '可编辑 Markdown 内容',
  'toolbar.toggleGroup': '切换组',
  'toolbar.undo': '撤销 {{shortcut}}',
  'toolbar.redo': '重做 {{shortcut}}',
  'toolbar.bold': '加粗',
  'toolbar.removeBold': '取消加粗',
  'toolbar.italic': '斜体',
  'toolbar.removeItalic': '取消斜体',
  'toolbar.underline': '下划线',
  'toolbar.removeUnderline': '取消下划线',
  'toolbar.link': '插入链接',
  'toolbar.bulletedList': '无序列表',
  'toolbar.numberedList': '有序列表',
  'toolbar.checkList': '任务列表',
  'toolbar.blockTypes.paragraph': '正文',
  'toolbar.blockTypes.quote': '引用',
  'toolbar.blockTypes.heading': '标题 {{level}}',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': '选择块类型',
  'toolbar.blockTypeSelect.placeholder': '块类型',
  'toolbar.table': '插入表格',
  'toolbar.thematicBreak': '插入分隔线',
  'toolbar.richText': '富文本',
  'toolbar.diffMode': '对比模式',
  'toolbar.source': '源码模式',
};

function applyTemplate(text: string, values?: Record<string, string | number>) {
  if (!values) return text;
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)),
    text,
  );
}

function shouldHandleMarkdownPaste(text: string) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const trimmed = normalized.trim();
  if (!trimmed) return false;

  const markdownSignals = [
    /(^|\n)\s{0,3}(?:> ?)*(```+|~~~+)/,
    /(^|\n)\s{4,}\S/,
    /(^|\n)\s{0,3}#{1,6}\s+\S/,
    /(^|\n)\s*(?:[-*+]\s+\S|\d+\.\s+\S)/,
    /(^|\n)\s*>+\s+\S/,
    /(^|\n)\|.+\|/,
    /(^|\n)\s{0,3}(?:[-*_]\s*){3,}(?:\n|$)/,
    /!\[[^\]]*]\([^)]+\)/,
    /\[[^\]]+]\([^)]+\)/,
    /(^|[^`])`[^`\n]+`(?=[^`]|$)/,
    /(?:\*\*|__)[^*\n_]+(?:\*\*|__)/,
    /(?:^|[^*])\*[^*\n]+\*(?:[^*]|$)/,
  ];

  return markdownSignals.some((pattern) => pattern.test(normalized));
}

function normalizeMarkdownPaste(text: string) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function normalizeCodeBlockCode(code: string) {
  const normalized = normalizeMarkdownPaste(code).replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
  return normalized
    .split('\n')
    .map((line) => {
      const visibleContent = line.replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, '');
      return visibleContent ? line : '';
    })
    .join('\n');
}

function normalizeCodeBlockLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return '';
  return LANGUAGE_ALIAS_MAP.get(normalized) ?? normalized;
}

function inferCodeBlockLanguage(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return '';

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // ignore invalid JSON guesses
    }
  }

  if (
    /^\s*<(!DOCTYPE|html|div|span|section|main|article|header|footer|script|style)\b/i.test(trimmed)
  ) {
    return 'html';
  }

  if (
    /^\s*(interface|type)\b/m.test(trimmed) ||
    /:\s*[A-Z][A-Za-z0-9_<>,[\]? ]*(?=[=;,)])/m.test(trimmed)
  ) {
    return 'ts';
  }

  if (/^\s*(const|let|var|import|export|function)\b/m.test(trimmed) || /=>/.test(trimmed)) {
    return 'js';
  }

  if (/^\s*(def|class|import|from)\b/m.test(trimmed) && /:\s*(#.*)?$/m.test(trimmed)) {
    return 'py';
  }

  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/im.test(trimmed)) {
    return 'sql';
  }

  if (/^\s*[-\w"']+\s*:\s*.+/m.test(trimmed) && !/[{};]/.test(trimmed)) {
    return 'yaml';
  }

  if (/^\s*(npm|pnpm|yarn|git|cd|ls|cp|mv|rm)\b/m.test(trimmed) || /^#!/.test(trimmed)) {
    return 'bash';
  }

  return '';
}

function hasMarkdownCodeBlock(text: string) {
  const normalized = normalizeMarkdownPaste(text);
  return /(^|\n)\s{0,3}(?:```+|~~~+)/.test(normalized) || /(^|\n)(?: {4}|\t)\S/.test(normalized);
}

function getCodeBlockLanguage(className: string) {
  const matched = className.match(/(?:^|\s)(?:language|lang)-([A-Za-z0-9_+-]+)/);
  return matched?.[1] || '';
}

function restoreMarkdownFromHtml(html: string) {
  if (!html || !/<pre[\s>]/i.test(html)) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return '';

  body.querySelectorAll('br').forEach((element) => {
    element.replaceWith(doc.createTextNode('\n'));
  });

  body.querySelectorAll('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    const rawCode = code?.textContent ?? pre.textContent ?? '';
    const normalizedCode = normalizeMarkdownPaste(rawCode).replace(/\n+$/g, '');
    const language = getCodeBlockLanguage(code?.className ?? pre.className);
    const fencedBlock = `\n\n\`\`\`${language}\n${normalizedCode}\n\`\`\`\n\n`;
    pre.replaceWith(doc.createTextNode(fencedBlock));
  });

  return normalizeMarkdownPaste(body.innerText || body.textContent || '');
}

function getClipboardMarkdownText(clipboardData?: DataTransfer | null) {
  const html = clipboardData?.getData('text/html') || '';
  const htmlMarkdown = restoreMarkdownFromHtml(html);
  if (htmlMarkdown.trim()) return htmlMarkdown;
  return normalizeMarkdownPaste(clipboardData?.getData('text/plain') || '');
}

type MarkdownPasteSegment =
  | { type: 'markdown'; text: string }
  | { type: 'code'; code: string; language: string };

function splitMarkdownPasteSegments(markdown: string): MarkdownPasteSegment[] {
  const normalized = normalizeMarkdownPaste(markdown);
  const segments: MarkdownPasteSegment[] = [];
  const codeBlockPattern =
    /(^|\n)(?<fence>`{3,}|~{3,})(?<language>[^\n`]*)\n(?<code>[\s\S]*?)\n\k<fence>(?=\n|$)/g;
  let cursor = 0;

  for (const match of normalized.matchAll(codeBlockPattern)) {
    const matchIndex = match.index ?? 0;
    const blockStart = match[1] ? matchIndex + match[1].length : matchIndex;
    const leadingMarkdown = normalized.slice(cursor, blockStart);
    if (leadingMarkdown.trim()) {
      segments.push({ type: 'markdown', text: leadingMarkdown });
    }

    segments.push({
      type: 'code',
      code: normalizeCodeBlockCode(match.groups?.code ?? '').replace(/\n+$/g, ''),
      language: normalizeCodeBlockLanguage(match.groups?.language ?? ''),
    });
    cursor = blockStart + match[0].length - (match[1]?.length ?? 0);
  }

  const trailingMarkdown = normalized.slice(cursor);
  if (trailingMarkdown.trim()) {
    segments.push({ type: 'markdown', text: trailingMarkdown });
  }

  return segments;
}

function createParagraphNodesFromMarkdown(text: string) {
  const normalized = normalizeMarkdownPaste(text).trim();
  if (!normalized) return [];

  return normalized.split(/\n{2,}/).map((block) => {
    const paragraph = lexical.$createParagraphNode();
    const lines = block.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) {
        paragraph.append(lexical.$createLineBreakNode());
      }
      if (line) {
        paragraph.append(lexical.$createTextNode(line));
      }
    });
    return paragraph;
  });
}

function insertMarkdownCodeBlockNodes(
  editor: { update: (fn: () => void) => void },
  markdown: string,
) {
  const segments = splitMarkdownPasteSegments(markdown);
  if (segments.length === 0) return false;

  editor.update(() => {
    const selection = lexical.$getSelection();
    if (!selection) return;

    const nodes = segments.flatMap((segment, index) => {
      if (segment.type === 'markdown') {
        return createParagraphNodesFromMarkdown(segment.text);
      }

      const nextSegment = segments[index + 1];
      const resolvedLanguage = segment.language || inferCodeBlockLanguage(segment.code) || 'txt';
      const codeBlock = $createCodeBlockNode({
        code: segment.code,
        language: resolvedLanguage,
      });
      if (nextSegment) {
        return [codeBlock];
      }
      return [codeBlock, lexical.$createParagraphNode()];
    });

    if (nodes.length > 0) {
      lexical.$insertNodes(nodes);
    }
  });

  return true;
}

const markdownCodeBlockPastePlugin = realmPlugin({
  init(realm) {
    realm.pub(createActiveEditorSubscription$, (editor) => {
      return editor.registerCommand(
        lexical.PASTE_COMMAND,
        (event: ClipboardEvent | null) => {
          if (!event || event.defaultPrevented) {
            return false;
          }

          const clipboardData = event.clipboardData;
          const items = Array.from(clipboardData?.items || []);
          const hasFiles = items.some((item) => item.kind === 'file');
          if (hasFiles) return false;

          const normalizedText = getClipboardMarkdownText(clipboardData);
          if (!normalizedText || !hasMarkdownCodeBlock(normalizedText)) {
            return false;
          }

          event.preventDefault();
          return insertMarkdownCodeBlockNodes(editor, normalizedText);
        },
        lexical.COMMAND_PRIORITY_CRITICAL,
      );
    });
  },
});

export function MdxMarkdownEditor({ value, onChange, className }: MdxMarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const latestMarkdown = useRef(value);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value === latestMarkdown.current) return;
    editorRef.current.setMarkdown(value);
    latestMarkdown.current = value;
  }, [value]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;

      const clipboardData = event.clipboardData;
      const items = Array.from(clipboardData?.items || []);
      const hasFiles = items.some((item) => item.kind === 'file');
      if (hasFiles) return;

      const normalizedText = getClipboardMarkdownText(clipboardData);
      if (!normalizedText || !shouldHandleMarkdownPaste(normalizedText) || !editorRef.current) {
        return;
      }
      const target = (event.target as HTMLElement | null)?.closest(
        '[contenteditable="true"]',
      ) as HTMLElement | null;
      if (!target) return;

      event.preventDefault();
      editorRef.current.insertMarkdown(normalizedText);
    };

    root.addEventListener('paste', handlePaste);
    return () => root.removeEventListener('paste', handlePaste);
  }, []);

  const plugins = useMemo(
    () => [
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'txt',
        codeBlockEditorDescriptors: [
          {
            priority: 0,
            match: () => true,
            Editor: CodeMirrorEditor,
          },
        ],
      }),
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
      }),
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
      imagePlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      markdownCodeBlockPastePlugin(),
      diffSourcePlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <DiffSourceToggleWrapper>
              <UndoRedo />
              <Separator />
              <BlockTypeSelect />
              <Separator />
              <BoldItalicUnderlineToggles />
              <Separator />
              <ListsToggle options={['bullet', 'number']} />
              <Separator />
              <CreateLink />
            </DiffSourceToggleWrapper>
            <Separator />
            <InsertTable />
            <InsertCodeBlock />
            <InsertThematicBreak />
          </>
        ),
      }),
    ],
    [],
  );

  const translation = useMemo(
    () =>
      (key: string, defaultValue: string, interpolations: Record<string, string | number> = {}) => {
        const template = ZH_CN_EDITOR_TEXT[key] || defaultValue;
        return applyTemplate(template, interpolations);
      },
    [],
  );

  return (
    <div ref={rootRef}>
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(markdown) => {
          latestMarkdown.current = markdown;
          onChange(markdown);
        }}
        plugins={plugins}
        className={cn('valley-mdx-editor-root', className)}
        contentEditableClassName="valley-mdx-editor-content"
        translation={translation}
        spellCheck
      />
    </div>
  );
}
