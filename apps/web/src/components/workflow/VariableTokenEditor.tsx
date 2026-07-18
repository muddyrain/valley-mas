import { Braces, Plus } from 'lucide-react';
import {
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface CaretAnchor {
  getBoundingClientRect: () => DOMRect;
}

interface VariableTokenEditorProps {
  id?: string;
  ariaLabel?: string;
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
  if (node.nodeType === Node.ELEMENT_NODE) {
    const token = (node as HTMLElement).dataset.variableToken;
    if (token) return token;
  }
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

function getElementSelection(root: HTMLElement, element: HTMLElement): TextSelection {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return getSelectionOffsets(root) || { start: 0, end: 0 };
}

function getSelectionPosition(root: HTMLElement, offset: number): [Node, number] {
  let consumed = 0;
  const textNodes = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textNodes.nextNode();
  while (textNode) {
    const token = textNode.parentElement?.closest<HTMLElement>('[data-variable-token]');
    const next = consumed + (token?.dataset.variableToken || textNode.textContent || '').length;
    if (offset <= next) {
      if (token?.parentNode) {
        const tokenIndex = Array.from(token.parentNode.childNodes).indexOf(token);
        return [token.parentNode, offset <= consumed ? tokenIndex : tokenIndex + 1];
      }
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

function getCaretAnchor(root: HTMLElement): CaretAnchor {
  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (root.contains(range.startContainer)) {
      const caretRange = range.cloneRange();
      caretRange.collapse(false);
      const rect = caretRange.getBoundingClientRect();
      if (rect.height > 0 || rect.width > 0) {
        return { getBoundingClientRect: () => caretRange.getBoundingClientRect() };
      }
    }
  }
  return {
    getBoundingClientRect: () => {
      const rect = root.getBoundingClientRect();
      return new DOMRect(rect.left + 12, rect.top + 12, 0, 24);
    },
  };
}

function getVariableTokenClassName(option?: WorkflowVariableOption) {
  return cn(
    'mx-0.5 inline-flex cursor-pointer items-center rounded-sm border px-1 py-px align-baseline font-medium transition-colors',
    option
      ? 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10'
      : 'border-destructive/20 bg-destructive/10 text-destructive underline decoration-dotted',
  );
}

function createVariableTokenElement(segment: Extract<TemplateSegment, { type: 'variable' }>) {
  const token = document.createElement('span');
  token.dataset.variableToken = segment.token;
  token.title = segment.token;
  token.className = getVariableTokenClassName(segment.option);
  token.textContent = segment.option
    ? `${segment.option.nodeLabel} · ${segment.option.field}`
    : segment.token;
  token.contentEditable = 'false';
  token.setAttribute('role', 'button');
  token.setAttribute('aria-label', `更换变量 ${segment.option?.nodeLabel || segment.token}`);
  return token;
}

function getVariableTokenRanges(value: string, options: WorkflowVariableOption[]) {
  let offset = 0;
  return splitWorkflowTemplate(value, options).flatMap((segment) => {
    const start = offset;
    const length = segment.type === 'text' ? segment.value.length : segment.token.length;
    offset += length;
    return segment.type === 'variable' ? [{ start, end: offset }] : [];
  });
}

function getAtomicDeletionSelection(
  value: string,
  selection: TextSelection,
  key: 'Backspace' | 'Delete',
  options: WorkflowVariableOption[],
): TextSelection | null {
  const ranges = getVariableTokenRanges(value, options);
  if (selection.start !== selection.end) {
    const overlapping = ranges.filter(
      (range) => range.start < selection.end && range.end > selection.start,
    );
    if (overlapping.length === 0) return null;
    return {
      start: Math.min(selection.start, ...overlapping.map((range) => range.start)),
      end: Math.max(selection.end, ...overlapping.map((range) => range.end)),
    };
  }
  return (
    ranges.find((range) =>
      key === 'Backspace' ? range.end === selection.start : range.start === selection.start,
    ) || null
  );
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
    const value = token.dataset.variableToken || '';
    const option = getWorkflowVariableOption(value, options);
    token.title = value;
    token.className = getVariableTokenClassName(option);
    token.textContent = option ? `${option.nodeLabel} · ${option.field}` : value;
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
    expectedTokens.every(
      (segment, index) => tokenElements[index]?.dataset.variableToken === segment.token,
    )
  );
}

function findVariableDraft(value: string, cursor: number): VariableDraft | null {
  const start = value.lastIndexOf('{{', Math.max(0, cursor - 1));
  if (start < 0) return null;

  const closingStart = value.indexOf('}}', start + 2);
  if (closingStart >= 0) {
    const end = closingStart + 2;
    if (cursor >= start && cursor <= end) {
      return {
        start,
        end,
        query: value.slice(start + 2, closingStart).trim(),
      };
    }
  }

  const previousClose = value.lastIndexOf('}}', Math.max(0, cursor - 1));
  if (previousClose >= start) return null;

  return {
    start,
    end: cursor,
    query: value.slice(start + 2, cursor).trim(),
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
          <span className="block truncate text-xs text-muted-foreground">
            {option.scope === 'local' ? '本节点已绑定输入' : '来自上游节点输出'}
          </span>
        )}
      </span>
      <span
        className={cn(
          'font-mono text-xs text-muted-foreground',
          highlighted && 'rounded-full bg-muted px-2 py-0.5',
        )}
      >
        {option.type}
      </span>
    </>
  );
}

function InlineVariableOptionList({
  options,
  emptyText,
  onSelect,
}: {
  options: WorkflowVariableOption[];
  emptyText?: string;
  onSelect: (option: WorkflowVariableOption) => void;
}) {
  if (options.length === 0) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-2 px-3 pb-3">
      {options.map((option) => (
        <Button
          key={option.token}
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start gap-3 rounded-lg border border-transparent bg-background px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-accent/55 hover:text-accent-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(option)}
        >
          <VariableOptionDetails
            option={option}
            icon={
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Plus className="size-4" />
              </span>
            }
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
  ariaLabel,
  value,
  onChange,
  options,
  placeholder,
  className,
  compact = false,
}: VariableTokenEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<TextSelection | null>(null);
  const pickerSelectionRef = useRef<TextSelection>({ start: value.length, end: value.length });
  const undoStackRef = useRef<EditorHistoryEntry[]>([]);
  const redoStackRef = useRef<EditorHistoryEntry[]>([]);
  const inlineSearchStartRef = useRef<number | null>(null);
  const lastInlineVariableQueryRef = useRef('');
  const suppressNextFocusRef = useRef(false);
  const [inlineVariableQuery, setInlineVariableQuery] = useState<string | null>(null);
  const [isPickerContentMounted, setIsPickerContentMounted] = useState(false);
  const [pickerSearchMode, setPickerSearchMode] = useState(false);
  const [caretAnchor, setCaretAnchor] = useState<CaretAnchor | null>(null);
  const isPickerOpen = inlineVariableQuery !== null;
  if (inlineVariableQuery !== null) {
    lastInlineVariableQueryRef.current = inlineVariableQuery;
  }
  const pickerQuery = inlineVariableQuery ?? lastInlineVariableQueryRef.current;
  const segments = useMemo(() => splitWorkflowTemplate(value, options), [options, value]);
  const matchingInlineOptions = useMemo(
    () => (isPickerContentMounted ? getMatchingVariableOptions(options, pickerQuery) : []),
    [isPickerContentMounted, options, pickerQuery],
  );

  useLayoutEffect(() => {
    if (isPickerOpen) setIsPickerContentMounted(true);
  }, [isPickerOpen]);

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
    setCaretAnchor(getCaretAnchor(editor));
    pickerSelectionRef.current = selection;
    const nextValue = readRawValue(editor);
    const searchStart = inlineSearchStartRef.current;
    if (searchStart !== null && selection.start >= searchStart) {
      const searchEnd = compact ? nextValue.length : selection.start;
      pickerSelectionRef.current = { start: searchStart, end: searchEnd };
      setInlineVariableQuery(nextValue.slice(searchStart, searchEnd).trim());
      applyText(nextValue, selection, selection);
      return;
    }
    if (nextValue.slice(0, selection.start).endsWith('{{')) {
      const placeholderStart = selection.start - 2;
      pickerSelectionRef.current = { start: placeholderStart, end: selection.end };
      setPickerSearchMode(false);
      setInlineVariableQuery('');
      applyText(nextValue, selection, selection);
      return;
    }

    const draft = findVariableDraft(nextValue, selection.start);
    if (draft) {
      pickerSelectionRef.current = draft;
      setPickerSearchMode(false);
      setInlineVariableQuery(draft.query);
    } else {
      inlineSearchStartRef.current = null;
      setInlineVariableQuery(null);
    }
    syncVariableTokenStyles(editor, options);
    applyText(nextValue, selection, selection);
  }, [applyText, compact, options]);

  const openPickerFromCaret = useCallback(
    (editor: HTMLDivElement, allowEmpty: boolean) => {
      const selection = getSelectionOffsets(editor);
      if (!selection) return;
      const currentValue = readRawValue(editor);
      const draft = findVariableDraft(currentValue, selection.start);
      if (draft) {
        pickerSelectionRef.current = draft;
        inlineSearchStartRef.current = null;
        setCaretAnchor(getCaretAnchor(editor));
        setPickerSearchMode(false);
        setInlineVariableQuery(draft.query);
        return;
      }
      if (!allowEmpty) return;
      inlineSearchStartRef.current = null;
      pickerSelectionRef.current = selection;
      setCaretAnchor(getCaretAnchor(editor));
      const selectedToken = getVariableTokenRanges(currentValue, options).some(
        (range) => range.start === selection.start && range.end === selection.end,
      );
      setPickerSearchMode(selectedToken);
      setInlineVariableQuery('');
    },
    [options],
  );

  const openPickerFromButton = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getSelectionOffsets(editor) || pickerSelectionRef.current;
    const currentValue = readRawValue(editor);
    const draft = findVariableDraft(currentValue, selection.start);
    pickerSelectionRef.current = draft || selection;
    inlineSearchStartRef.current = null;
    setCaretAnchor(getCaretAnchor(editor));
    setPickerSearchMode(true);
    setInlineVariableQuery('');
  }, []);

  const handleEditorFocus = useCallback(
    (_event: FocusEvent<HTMLDivElement>) => {
      if (suppressNextFocusRef.current) {
        suppressNextFocusRef.current = false;
        return;
      }
      window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (editor) openPickerFromCaret(editor, compact);
      });
    },
    [compact, openPickerFromCaret],
  );

  const handleEditorClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      const target = event.target instanceof Element ? event.target : null;
      const token = target?.closest<HTMLElement>('[data-variable-token]');
      if (!editor) return;
      if (!token || !editor.contains(token)) {
        openPickerFromCaret(editor, compact);
        return;
      }
      event.preventDefault();
      const tokenSelection = getElementSelection(editor, token);
      pickerSelectionRef.current = tokenSelection;
      inlineSearchStartRef.current = tokenSelection.start;
      setCaretAnchor({ getBoundingClientRect: () => token.getBoundingClientRect() });
      setPickerSearchMode(true);
      setInlineVariableQuery('');
    },
    [compact, openPickerFromCaret],
  );

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
        inlineSearchStartRef.current = null;
        setInlineVariableQuery(null);
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const editor = editorRef.current;
        const selection = editor ? getSelectionOffsets(editor) : null;
        if (selection) {
          const deletion = getAtomicDeletionSelection(value, selection, event.key, options);
          if (deletion) {
            event.preventDefault();
            const nextValue = `${value.slice(0, deletion.start)}${value.slice(deletion.end)}`;
            applyText(nextValue, { start: deletion.start, end: deletion.start }, selection);
            inlineSearchStartRef.current = null;
            setPickerSearchMode(false);
            setInlineVariableQuery(null);
            return;
          }
        }
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!compact) insertText('\n');
    },
    [applyText, compact, inlineVariableQuery, insertText, onChange, options, value],
  );

  const handleSelectOption = useCallback(
    (option: WorkflowVariableOption) => {
      const selection = pickerSelectionRef.current;
      const nextValue = `${value.slice(0, selection.start)}${option.token}${value.slice(selection.end)}`;
      const nextPosition = selection.start + option.token.length;
      const nextSelection = { start: nextPosition, end: nextPosition };
      applyText(nextValue, nextSelection, selection);
      inlineSearchStartRef.current = null;
      setInlineVariableQuery(null);
      suppressNextFocusRef.current = true;
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
      ref={containerRef}
      className={cn(
        'overflow-hidden rounded-md border border-input bg-transparent shadow-xs',
        className,
      )}
    >
      <div className="relative">
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-label={ariaLabel}
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
          onFocus={handleEditorFocus}
          onClick={handleEditorClick}
          onKeyDown={handleKeyDown}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
        />
        <Popover
          open={isPickerOpen}
          modal={false}
          onOpenChange={(open, eventDetails) => {
            if (!open) {
              const target = eventDetails.event.target;
              if (
                eventDetails.reason === 'outside-press' &&
                target instanceof Node &&
                containerRef.current?.contains(target)
              ) {
                eventDetails.cancel();
                return;
              }
              inlineSearchStartRef.current = null;
              setInlineVariableQuery(null);
            }
          }}
          onOpenChangeComplete={(open) => {
            if (!open) {
              setIsPickerContentMounted(false);
              setPickerSearchMode(false);
            }
          }}
        >
          <PopoverTrigger
            nativeButton={false}
            render={
              <span aria-hidden="true" className="pointer-events-none absolute size-px opacity-0" />
            }
          />
          {isPickerContentMounted && (
            <PopoverContent
              anchor={caretAnchor}
              align="start"
              side="bottom"
              sideOffset={10}
              initialFocus={pickerSearchMode ? undefined : false}
              finalFocus={false}
              className="w-[min(34rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-xl! border-border p-0 shadow-md"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Braces className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">选择变量</p>
                    <p className="text-xs text-muted-foreground">本节点输入与上游输出</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {matchingInlineOptions.length} 项
                </span>
              </div>
              {pickerSearchMode ? (
                <div className="border-b border-border p-3">
                  <Input
                    autoFocus
                    aria-label="筛选变量"
                    value={pickerQuery}
                    placeholder="输入节点名或变量名"
                    onChange={(event) => setInlineVariableQuery(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="max-h-72 overflow-y-auto pt-3">
                <p className="px-4 pb-2 text-xs font-medium text-muted-foreground">
                  {pickerQuery ? '匹配结果' : '可用变量'}
                </p>
                <InlineVariableOptionList
                  options={matchingInlineOptions}
                  emptyText="未找到匹配变量"
                  onSelect={handleSelectOption}
                />
              </div>
            </PopoverContent>
          )}
        </Popover>
      </div>
      {!compact && (
        <div className="flex items-center justify-between border-t border-input bg-muted/30 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">可引用本节点输入与上游输出</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openPickerFromButton}
          >
            <Braces />
            插入变量
          </Button>
        </div>
      )}
    </div>
  );
}
