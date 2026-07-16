import { Braces, Plus, Variable } from 'lucide-react';
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  getWorkflowVariableOption,
  splitWorkflowTemplate,
  type TemplateSegment,
  type WorkflowVariableOption,
} from './workflowVariables';

interface TextSelection {
  start: number;
  end: number;
}

interface EditorHistoryEntry {
  value: string;
  selection: TextSelection;
}

interface VariableDraft extends TextSelection {
  query: string;
}

interface VariableTokenEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: WorkflowVariableOption[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

function readRawValue(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
  if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'BR') return '\n';
  return Array.from(node.childNodes, readRawValue).join('');
}

function getSelectionOffsets(root: HTMLElement): TextSelection | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const toOffset = (container: Node, offset: number) => {
    const before = document.createRange();
    before.setStart(root, 0);
    before.setEnd(container, offset);
    return readRawValue(before.cloneContents()).length;
  };

  return {
    start: toOffset(range.startContainer, range.startOffset),
    end: toOffset(range.endContainer, range.endOffset),
  };
}

function getSelectionPosition(root: HTMLElement, offset: number): [Node, number] {
  let consumed = 0;
  const textNodes = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textNodes.nextNode();
  while (textNode) {
    const next = consumed + (textNode.textContent || '').length;
    if (offset <= next) {
      return [textNode, Math.max(0, offset - consumed)];
    }
    consumed = next;
    textNode = textNodes.nextNode();
  }
  return [root, root.childNodes.length];
}

function restoreSelection(root: HTMLElement, selection: TextSelection) {
  const nextSelection = window.getSelection();
  if (!nextSelection) return;
  const range = document.createRange();
  const [startNode, startOffset] = getSelectionPosition(root, selection.start);
  const [endNode, endOffset] = getSelectionPosition(root, selection.end);
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  nextSelection.removeAllRanges();
  nextSelection.addRange(range);
}

function getVariableTokenClassName(option?: WorkflowVariableOption) {
  return cn(
    'font-medium',
    option
      ? 'text-blue-600 dark:text-blue-400'
      : 'rounded-sm bg-destructive/10 text-destructive underline decoration-dotted',
  );
}

function createVariableTokenElement(segment: Extract<TemplateSegment, { type: 'variable' }>) {
  const token = document.createElement('span');
  token.dataset.variableToken = segment.token;
  token.title = segment.token;
  token.className = getVariableTokenClassName(segment.option);
  token.textContent = segment.token;
  return token;
}

function renderEditorContents(editor: HTMLElement, segments: TemplateSegment[]) {
  const contents = document.createDocumentFragment();
  for (const segment of segments) {
    contents.append(
      segment.type === 'text'
        ? document.createTextNode(segment.value)
        : createVariableTokenElement(segment),
    );
  }
  editor.replaceChildren(contents);
}

function syncVariableTokenStyles(editor: HTMLElement, options: WorkflowVariableOption[]) {
  for (const token of editor.querySelectorAll<HTMLElement>('[data-variable-token]')) {
    const value = token.textContent || '';
    token.dataset.variableToken = value;
    token.title = value;
    token.className = getVariableTokenClassName(getWorkflowVariableOption(value, options));
  }
}

function hasMatchingVariableElements(editor: HTMLElement, segments: TemplateSegment[]) {
  const expectedTokens = segments.filter(
    (segment): segment is Extract<TemplateSegment, { type: 'variable' }> =>
      segment.type === 'variable',
  );
  const tokenElements = Array.from(editor.querySelectorAll<HTMLElement>('[data-variable-token]'));
  return (
    tokenElements.length === expectedTokens.length &&
    expectedTokens.every((segment, index) => tokenElements[index]?.textContent === segment.token)
  );
}

function findVariableDraft(value: string, cursor: number): VariableDraft | null {
  const start = value.lastIndexOf('{{', Math.max(0, cursor - 1));
  if (start < 0) return null;

  const previousClose = value.lastIndexOf('}}', Math.max(0, cursor - 1));
  if (previousClose >= start) return null;

  const closingStart = value.indexOf('}}', cursor);
  const end = closingStart < 0 ? cursor : closingStart + 2;
  const queryEnd = closingStart < 0 ? cursor : closingStart;
  return {
    start,
    end,
    query: value.slice(start + 2, queryEnd).trim(),
  };
}

function getMatchingVariableOptions(options: WorkflowVariableOption[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;
  return options.filter((option) =>
    `${option.nodeLabel} ${option.field} ${option.token}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

interface VariableOptionListProps {
  options: WorkflowVariableOption[];
  heading: string;
  emptyText?: string;
  onSelect: (option: WorkflowVariableOption) => void;
}

interface VariableOptionDetailsProps {
  option: WorkflowVariableOption;
  icon: ReactNode;
  showToken?: boolean;
  highlighted?: boolean;
}

function VariableOptionDetails({
  option,
  icon,
  showToken = false,
  highlighted = false,
}: VariableOptionDetailsProps) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', (showToken || highlighted) && 'font-medium')}>
          {option.nodeLabel} · {option.field}
        </span>
        {showToken && (
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {option.token}
          </span>
        )}
      </span>
      <span
        className={cn(
          'font-mono text-xs text-muted-foreground',
          highlighted && 'rounded-full bg-primary/10 px-2 py-0.5 text-primary',
        )}
      >
        {option.type}
      </span>
    </>
  );
}

function VariableOptionList({ options, heading, emptyText, onSelect }: VariableOptionListProps) {
  if (options.length === 0) {
    return emptyText ? (
      <div className="px-2 py-3 text-xs text-muted-foreground">{emptyText}</div>
    ) : null;
  }

  return (
    <CommandGroup heading={heading}>
      {options.map((option) => (
        <CommandItem
          key={option.token}
          value={`${option.nodeLabel} ${option.field} ${option.token}`}
          onSelect={() => onSelect(option)}
        >
          <VariableOptionDetails
            option={option}
            icon={<Variable className="text-blue-600 dark:text-blue-400" />}
          />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function InlineVariableOptionList({
  options,
  emptyText,
  onSelect,
}: Omit<VariableOptionListProps, 'heading'>) {
  if (options.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      {options.map((option) => (
        <Button
          key={option.token}
          type="button"
          variant="outline"
          className="h-auto w-full justify-start rounded-xl border-border bg-background px-4 py-3 text-left shadow-xs hover:border-primary/45 hover:bg-primary/5 hover:text-foreground hover:shadow-sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(option)}
        >
          <VariableOptionDetails
            option={option}
            icon={<Plus className="text-primary" />}
            showToken
            highlighted
          />
        </Button>
      ))}
    </div>
  );
}

export function VariableTokenEditor({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  compact = false,
}: VariableTokenEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<TextSelection | null>(null);
  const pickerSelectionRef = useRef<TextSelection>({ start: value.length, end: value.length });
  const undoStackRef = useRef<EditorHistoryEntry[]>([]);
  const redoStackRef = useRef<EditorHistoryEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inlineVariableQuery, setInlineVariableQuery] = useState<string | null>(null);
  const segments = splitWorkflowTemplate(value, options);
  const matchingInlineOptions = useMemo(
    () =>
      inlineVariableQuery === null ? [] : getMatchingVariableOptions(options, inlineVariableQuery),
    [inlineVariableQuery, options],
  );

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getSelectionOffsets(editor);
    if (selection) pickerSelectionRef.current = selection;
    setInlineVariableQuery(null);
  }, []);

  const applyText = useCallback(
    (nextValue: string, selection: TextSelection, previousSelection?: TextSelection) => {
      if (nextValue !== value) {
        const editor = editorRef.current;
        const currentSelection = previousSelection || (editor ? getSelectionOffsets(editor) : null);
        undoStackRef.current.push({
          value,
          selection: currentSelection || pickerSelectionRef.current,
        });
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
        redoStackRef.current = [];
      }
      pendingSelectionRef.current = selection;
      onChange(nextValue);
    },
    [onChange, value],
  );

  const insertText = useCallback(
    (text: string) => {
      const editor = editorRef.current;
      const selection = editor ? getSelectionOffsets(editor) : null;
      const current = selection || pickerSelectionRef.current;
      const nextValue = `${value.slice(0, current.start)}${text}${value.slice(current.end)}`;
      const nextPosition = current.start + text.length;
      applyText(nextValue, { start: nextPosition, end: nextPosition }, current);
    },
    [applyText, value],
  );

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const needsValueSync = readRawValue(editor) !== value;
    const needsVariableSync = !needsValueSync && !hasMatchingVariableElements(editor, segments);
    const needsDOMSync = needsValueSync || needsVariableSync;
    if (needsDOMSync) {
      renderEditorContents(editor, segments);
    }

    const selection = pendingSelectionRef.current;
    if (!selection) return;
    pendingSelectionRef.current = null;
    if (needsDOMSync && document.activeElement === editor) {
      restoreSelection(editor, selection);
    }
  }, [segments, value]);

  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getSelectionOffsets(editor);
    if (!selection) return;
    pickerSelectionRef.current = selection;
    const nextValue = readRawValue(editor);
    if (nextValue.slice(0, selection.start).endsWith('{{')) {
      const placeholderStart = selection.start - 2;
      const placeholder = `${nextValue.slice(0, placeholderStart)}{{}}${nextValue.slice(selection.end)}`;
      pickerSelectionRef.current = { start: placeholderStart, end: placeholderStart + 4 };
      setInlineVariableQuery('');
      applyText(placeholder, { start: placeholderStart + 2, end: placeholderStart + 2 }, selection);
      return;
    }

    const draft = findVariableDraft(nextValue, selection.start);
    if (draft) {
      pickerSelectionRef.current = draft;
      setInlineVariableQuery(draft.query);
    } else {
      setInlineVariableQuery(null);
    }
    syncVariableTokenStyles(editor, options);
    applyText(nextValue, selection, selection);
  }, [applyText, options]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      insertText(event.clipboardData.getData('text/plain'));
    },
    [insertText],
  );

  const handleCopy = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', readRawValue(range.cloneContents()));
  }, []);

  const handleCut = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      const selection = editor ? getSelectionOffsets(editor) : null;
      if (!selection || selection.start === selection.end) return;
      handleCopy(event);
      const nextValue = `${value.slice(0, selection.start)}${value.slice(selection.end)}`;
      applyText(nextValue, { start: selection.start, end: selection.start }, selection);
    },
    [applyText, handleCopy, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        const source = event.shiftKey ? redoStackRef.current : undoStackRef.current;
        const target = source.pop();
        if (!target) return;

        event.preventDefault();
        const editor = editorRef.current;
        const currentSelection = editor ? getSelectionOffsets(editor) : null;
        const destination = event.shiftKey ? undoStackRef.current : redoStackRef.current;
        destination.push({ value, selection: currentSelection || pickerSelectionRef.current });
        pendingSelectionRef.current = target.selection;
        pickerSelectionRef.current = target.selection;
        setInlineVariableQuery(null);
        onChange(target.value);
        return;
      }
      if (event.key === 'Escape' && inlineVariableQuery !== null) {
        event.preventDefault();
        setInlineVariableQuery(null);
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!compact) insertText('\n');
    },
    [compact, inlineVariableQuery, insertText, onChange, value],
  );

  const handleSelectOption = useCallback(
    (option: WorkflowVariableOption) => {
      const selection = pickerSelectionRef.current;
      const nextValue = `${value.slice(0, selection.start)}${option.token}${value.slice(selection.end)}`;
      const nextPosition = selection.start + option.token.length;
      const nextSelection = { start: nextPosition, end: nextPosition };
      applyText(nextValue, nextSelection, selection);
      setInlineVariableQuery(null);
      setPickerOpen(false);
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        pendingSelectionRef.current = null;
        restoreSelection(editor, nextSelection);
      });
    },
    [applyText, value],
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-input bg-transparent shadow-xs',
        className,
      )}
    >
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline={!compact}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={placeholder}
        className={cn(
          compact
            ? 'min-h-9 whitespace-pre-wrap break-words px-3 py-2 text-sm leading-5 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-3 focus-visible:ring-ring/50'
            : 'min-h-24 whitespace-pre-wrap break-words px-2.5 py-2 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
      />
      {inlineVariableQuery !== null && (
        <Popover
          open
          modal={false}
          onOpenChange={(open) => {
            if (!open) setInlineVariableQuery(null);
          }}
        >
          <PopoverTrigger
            nativeButton={false}
            render={<span aria-hidden="true" className="block h-px" />}
          />
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={10}
            initialFocus={false}
            finalFocus={false}
            className="w-[min(34rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl! border-primary/25 p-0 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Braces className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">选择变量</p>
                  <p className="text-xs text-muted-foreground">上游节点输出</p>
                </div>
              </div>
              <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                {matchingInlineOptions.length} 项
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto pt-3">
              <p className="px-4 pb-2 text-xs font-medium text-muted-foreground">
                {inlineVariableQuery ? '匹配结果' : '可用变量'}
              </p>
              <InlineVariableOptionList
                options={matchingInlineOptions}
                emptyText="未找到匹配变量"
                onSelect={handleSelectOption}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
      {!compact && (
        <div className="flex items-center justify-between border-t border-input bg-muted/30 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">仅可引用上游节点输出</span>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              render={<Button type="button" variant="ghost" size="xs" />}
              onMouseDown={rememberSelection}
            >
              <Braces />
              插入变量
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 gap-0 overflow-hidden p-0">
              <Command>
                <CommandInput placeholder="搜索变量" />
                <CommandList>
                  <CommandEmpty>暂无可用上游变量</CommandEmpty>
                  <VariableOptionList
                    options={options}
                    heading="上游变量"
                    onSelect={handleSelectOption}
                  />
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
