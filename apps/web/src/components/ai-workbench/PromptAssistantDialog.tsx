import { Copy, RefreshCw, Sparkles, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type AIAppRun,
  createPromptAssistantSuggestion,
  getAPIErrorMessage,
  type PromptAssistantField,
  type PromptAssistantSuggestion,
} from '@/api/aiWorkbench';
import { AIGenerationProgress } from '@/components/ai-workbench/AIGenerationProgress';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

type PromptMode = 'auto' | 'instruction' | 'debug_run';

const fieldLabels: Record<PromptAssistantField, string> = {
  system_prompt: '提示词',
  description: '简介',
  opening_message: '开场白',
  example_questions: '示例问题',
};

export function PromptAssistantDialog({
  open,
  onOpenChange,
  appId,
  target = 'agent',
  field = 'system_prompt',
  allowedVariables = [],
  currentPrompt,
  agentContext,
  runs = [],
  onReplace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId?: string;
  target?: 'agent' | 'workflow_llm' | 'prompt_resource';
  field?: PromptAssistantField;
  allowedVariables?: string[];
  currentPrompt: string;
  agentContext?: {
    name: string;
    description: string;
    systemPrompt: string;
    openingMessage: string;
    exampleQuestions: string[];
  };
  runs?: AIAppRun[];
  onReplace: (suggestion: PromptAssistantSuggestion, includeGreetings: boolean) => void;
}) {
  const [mode, setMode] = useState<PromptMode>('auto');
  const [instruction, setInstruction] = useState('');
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [includeGreetings, setIncludeGreetings] = useState(false);
  const [suggestion, setSuggestion] = useState<PromptAssistantSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const isSystemPrompt = field === 'system_prompt';

  useEffect(() => {
    if (!open) return;
    setSuggestion(null);
    setInstruction('');
    setSelectedRuns([]);
    setIncludeGreetings(false);
    setMode('auto');
  }, [open]);

  const generate = async () => {
    if (isSystemPrompt && !currentPrompt.trim()) {
      toast.error('请先填写系统提示词');
      return;
    }
    if (mode === 'instruction' && !instruction.trim()) {
      toast.error('请填写调整要求');
      return;
    }
    if (mode === 'debug_run' && selectedRuns.length === 0) {
      toast.error('请选择 1–3 次调试结果');
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      const result = await createPromptAssistantSuggestion(
        {
          target,
          field,
          mode,
          appId,
          currentPrompt,
          instruction: instruction.trim(),
          debugRunIds: selectedRuns,
          generateGreetings: includeGreetings,
          allowedVariables,
          agentContext,
        },
        controller.signal,
      );
      setSuggestion(result.suggestion);
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(getAPIErrorMessage(error, '提示词优化失败'));
    } finally {
      controllerRef.current = null;
      setLoading(false);
    }
  };

  const generatedText =
    field === 'description'
      ? suggestion?.description || ''
      : field === 'opening_message'
        ? suggestion?.openingMessage || ''
        : suggestion?.optimizedPrompt || '';
  const generatedQuestions = suggestion?.exampleQuestions || [];
  const title = isSystemPrompt ? 'AI 调整提示词' : `AI 生成${fieldLabels[field]}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>生成结果不会自动保存，确认后仅写入当前草稿。</DialogDescription>
        </DialogHeader>
        {isSystemPrompt ? (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['auto', '自动优化'],
                ['instruction', '按要求调整'],
                ['debug_run', '根据调试结果'],
              ] as const
            )
              .filter(([value]) => target === 'agent' || value !== 'debug_run')
              .map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={mode === value ? 'default' : 'outline'}
                  onClick={() => setMode(value)}
                >
                  {label}
                </Button>
              ))}
          </div>
        ) : null}
        {isSystemPrompt && mode === 'instruction' ? (
          <Textarea
            value={instruction}
            maxLength={2000}
            placeholder="例如：强化边界条件，输出改为 Markdown 清单"
            onChange={(event) => setInstruction(event.target.value)}
          />
        ) : null}
        {isSystemPrompt && target === 'agent' && mode === 'debug_run' ? (
          <ScrollArea className="max-h-44 rounded-lg border border-border p-2">
            <div className="space-y-2">
              {runs.slice(0, 10).map((run) => {
                const checked = selectedRuns.includes(run.id);
                return (
                  <label
                    key={run.id}
                    className="flex items-start gap-3 rounded-md p-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!checked && selectedRuns.length >= 3}
                      onCheckedChange={(next) =>
                        setSelectedRuns((items) =>
                          next
                            ? [...items, run.id].slice(0, 3)
                            : items.filter((id) => id !== run.id),
                        )
                      }
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">
                        {run.status === 'succeeded' ? '成功' : '失败'} · {run.durationMs} ms
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {run.input}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        ) : null}
        {isSystemPrompt && target === 'agent' ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={includeGreetings}
              onCheckedChange={(value) => setIncludeGreetings(value === true)}
            />
            同时生成开场白和示例问题
          </label>
        ) : null}
        {loading ? (
          <AIGenerationProgress
            title={isSystemPrompt ? '正在优化提示词' : `正在生成${fieldLabels[field]}`}
            description="AI 正在组织内容并检查格式，完成后会显示可编辑结果。"
          />
        ) : suggestion ? (
          <div className="min-h-0 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div>
              <Label>修改摘要</Label>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {suggestion.summary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <ScrollArea className="max-h-72 rounded-lg bg-background p-3">
              {field === 'example_questions' ? (
                <ul className="space-y-2 text-sm leading-6">
                  {generatedQuestions.map((question) => (
                    <li key={question} className="rounded-md bg-muted/50 px-3 py-2">
                      {question}
                    </li>
                  ))}
                </ul>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">
                  {generatedText}
                </pre>
              )}
            </ScrollArea>
          </div>
        ) : null}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            {loading ? (
              <Button variant="outline" onClick={() => controllerRef.current?.abort()}>
                <Square className="mr-2 size-3.5" />
                停止响应
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void generate()}>
                <RefreshCw className="mr-2 size-4" />
                {suggestion ? '重新生成' : '生成建议'}
              </Button>
            )}
            {suggestion ? (
              <Button
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(
                      field === 'example_questions' ? generatedQuestions.join('\n') : generatedText,
                    )
                    .then(() => toast.success('已复制'))
                }
              >
                <Copy className="mr-2 size-4" />
                复制
              </Button>
            ) : null}
          </div>
          <Button
            disabled={!suggestion || loading}
            onClick={() => {
              if (!suggestion) return;
              onReplace(suggestion, includeGreetings);
              onOpenChange(false);
            }}
          >
            {isSystemPrompt ? '替换当前草稿' : `使用此${fieldLabels[field]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
