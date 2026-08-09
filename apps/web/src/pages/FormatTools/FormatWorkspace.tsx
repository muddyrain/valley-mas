import {
  type ConverterCategory,
  type ConverterDirection,
  runFormatTool,
  type TextCase,
} from '@valley/format-tools';
import { Clipboard, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';

export interface ToolCatalogItem {
  id: string;
  label: string;
  description: string;
  category: 'image' | ConverterCategory;
  keywords: string[];
  kind: 'format' | 'image';
  supportsReverse: boolean;
  forwardLabel: string;
  reverseLabel?: string;
  inputPlaceholder?: string;
}

interface NormalizeOptionsState extends Record<string, boolean> {
  trimLines: boolean;
  trimDocument: boolean;
  collapseBlankLines: boolean;
  collapseInlineWhitespace: boolean;
  removeEmptyLines: boolean;
}

interface FormatOptionsProps {
  tool: ToolCatalogItem;
  direction: ConverterDirection;
  setDirection: (direction: ConverterDirection) => void;
  pointer: string;
  setPointer: (pointer: string) => void;
  textCase: TextCase;
  setTextCase: (textCase: TextCase) => void;
  normalizeOptions: NormalizeOptionsState;
  setNormalizeOptions: (options: NormalizeOptionsState) => void;
}

export function FormatWorkspace({
  tool,
  categoryLabel,
}: {
  tool: ToolCatalogItem;
  categoryLabel: string;
}) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [direction, setDirection] = useState<ConverterDirection>('forward');
  const [pointer, setPointer] = useState('');
  const [textCase, setTextCase] = useState<TextCase>('camel');
  const [normalizeOptions, setNormalizeOptions] = useState<NormalizeOptionsState>({
    trimLines: true,
    trimDocument: true,
    collapseBlankLines: true,
    collapseInlineWhitespace: false,
    removeEmptyLines: false,
  });

  const runTool = async () => {
    if (!input) {
      setError('请先输入要处理的内容。');
      return;
    }

    setIsRunning(true);
    setError('');
    const options =
      tool.id === 'json-pointer'
        ? { pointer }
        : tool.id === 'text-case'
          ? { case: textCase }
          : tool.id === 'text-normalize'
            ? normalizeOptions
            : undefined;
    const result = await runFormatTool({
      toolId: tool.id,
      input,
      direction,
      options,
    });
    setIsRunning(false);

    if (!result.ok) {
      setOutput('');
      setError(result.error ?? '处理失败，请检查输入内容。');
      return;
    }
    setOutput(result.output);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError('');
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-border border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-xl tracking-tight text-balance">{tool.label}</h2>
            <Badge variant="outline">{categoryLabel}</Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground text-sm leading-6 text-pretty">
            {tool.description}
          </p>
        </div>
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        <FormatOptions
          tool={tool}
          direction={direction}
          setDirection={setDirection}
          pointer={pointer}
          setPointer={setPointer}
          textCase={textCase}
          setTextCase={setTextCase}
          normalizeOptions={normalizeOptions}
          setNormalizeOptions={setNormalizeOptions}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="format-tool-input">输入</Label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {input.length} 字符
              </span>
            </div>
            <Textarea
              id="format-tool-input"
              aria-label="输入内容"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={tool.inputPlaceholder ?? '输入要处理的内容'}
              className="min-h-80 resize-y font-mono text-sm leading-6"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="format-tool-output">结果</Label>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={copyOutput}
                disabled={!output}
              >
                <Clipboard aria-hidden="true" />
                复制
              </Button>
            </div>
            <Textarea
              id="format-tool-output"
              aria-label="处理结果"
              value={output}
              readOnly
              placeholder="处理结果会显示在这里"
              className="min-h-80 resize-y bg-muted/30 font-mono text-sm leading-6"
              spellCheck={false}
            />
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={clearAll}>
            <Trash2 aria-hidden="true" />
            清空
          </Button>
          <Button type="button" onClick={runTool} disabled={isRunning}>
            {isRunning ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            执行处理 · {direction === 'reverse' ? tool.reverseLabel : tool.forwardLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FormatOptions({
  tool,
  direction,
  setDirection,
  pointer,
  setPointer,
  textCase,
  setTextCase,
  normalizeOptions,
  setNormalizeOptions,
}: FormatOptionsProps) {
  if (tool.supportsReverse) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <span className="px-2 font-medium text-muted-foreground text-xs">转换方向</span>
        <Button
          type="button"
          size="sm"
          variant={direction === 'forward' ? 'secondary' : 'ghost'}
          onClick={() => setDirection('forward')}
        >
          {tool.forwardLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={direction === 'reverse' ? 'secondary' : 'ghost'}
          onClick={() => setDirection('reverse')}
        >
          {tool.reverseLabel}
        </Button>
      </div>
    );
  }

  if (tool.id === 'json-pointer') {
    return (
      <div className="max-w-lg space-y-2">
        <Label htmlFor="json-pointer">JSON Pointer</Label>
        <Input
          id="json-pointer"
          value={pointer}
          onChange={(event) => setPointer(event.target.value)}
          placeholder="例如 /user/name"
        />
      </div>
    );
  }

  if (tool.id === 'text-case') {
    return (
      <div className="max-w-xs space-y-2">
        <Label htmlFor="text-case">目标格式</Label>
        <NativeSelect
          id="text-case"
          value={textCase}
          onChange={(event) => setTextCase(event.target.value as TextCase)}
          className="w-full"
        >
          <NativeSelectOption value="upper">UPPER CASE</NativeSelectOption>
          <NativeSelectOption value="lower">lower case</NativeSelectOption>
          <NativeSelectOption value="title">Title Case</NativeSelectOption>
          <NativeSelectOption value="sentence">Sentence case</NativeSelectOption>
          <NativeSelectOption value="camel">camelCase</NativeSelectOption>
          <NativeSelectOption value="pascal">PascalCase</NativeSelectOption>
          <NativeSelectOption value="snake">snake_case</NativeSelectOption>
          <NativeSelectOption value="kebab">kebab-case</NativeSelectOption>
          <NativeSelectOption value="constant">CONSTANT_CASE</NativeSelectOption>
        </NativeSelect>
      </div>
    );
  }

  if (tool.id === 'text-normalize') {
    const options = [
      ['trimLines', '清理每行首尾空格'],
      ['trimDocument', '清理全文首尾空白'],
      ['collapseBlankLines', '合并连续空行'],
      ['collapseInlineWhitespace', '合并行内空白'],
      ['removeEmptyLines', '移除所有空行'],
    ] as const;
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
        {options.map(([key, label]) => (
          <Label key={key} className="flex cursor-pointer items-center gap-2 font-normal">
            <Checkbox
              checked={normalizeOptions[key]}
              onCheckedChange={(checked) =>
                setNormalizeOptions({ ...normalizeOptions, [key]: checked === true })
              }
            />
            {label}
          </Label>
        ))}
      </div>
    );
  }

  return null;
}
