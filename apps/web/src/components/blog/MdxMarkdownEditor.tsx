import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeMirrorEditor,
  CreateLink,
  codeBlockPlugin,
  codeMirrorPlugin,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  imagePlugin,
  ListsToggle,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  MDXEditor,
  type MDXEditorMethods,
  markdownShortcutPlugin,
  quotePlugin,
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

export function MdxMarkdownEditor({ value, onChange, className }: MdxMarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const latestMarkdown = useRef(value);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value === latestMarkdown.current) return;
    editorRef.current.setMarkdown(value);
    latestMarkdown.current = value;
  }, [value]);

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
        codeBlockLanguages: {
          '': '纯文本',
          txt: '纯文本',
          text: '纯文本',
          plaintext: '纯文本',
          'N/A': '纯文本',
          'n/a': '纯文本',
          markdown: 'Markdown',
          md: 'Markdown',
          js: 'JavaScript',
          ts: 'TypeScript',
          jsx: 'JavaScript (React)',
          tsx: 'TypeScript (React)',
          json: 'JSON',
          bash: 'Bash',
          sh: 'Shell',
          python: 'Python',
          py: 'Python',
          yaml: 'YAML',
          yml: 'YAML',
          sql: 'SQL',
          css: 'CSS',
          html: 'HTML',
        },
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
  );
}
