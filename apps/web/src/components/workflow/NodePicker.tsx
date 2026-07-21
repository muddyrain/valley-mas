import {
  GitBranch,
  GitMerge,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Workflow,
  Wrench,
} from 'lucide-react';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { getWorkflowPlatform, listWorkflows, type WorkflowNodeType } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { type PublishedWorkflowContract, publishedWorkflowContract } from './subworkflowContract';
import { useWorkflowCapabilities } from './useWorkflowCapabilities';
import { getWorkflowSideEffectLabel } from './workflowSideEffects';

export interface NodePickerItem {
  key: string;
  group: 'model' | 'flow' | 'logic' | 'tool' | 'subworkflow';
  nodeType: WorkflowNodeType;
  label: string;
  description: string;
  config: Record<string, unknown>;
  sideEffect?: string;
}

interface NodePickerProps {
  trigger: ReactElement;
  onSelect: (item: NodePickerItem) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

const genericItems: NodePickerItem[] = [
  {
    key: 'llm',
    group: 'model',
    nodeType: 'llm',
    label: '大模型',
    description: '选择文本模型生成内容',
    config: {
      systemPrompt: '你是一个可靠的内容助手。',
      prompt: '请完成当前任务。',
      inputs: {},
      inputTypes: {},
      outputMode: 'text',
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  },
  {
    key: 'condition',
    group: 'flow',
    nodeType: 'condition',
    label: '条件',
    description: '按 true / false 选择执行路径',
    config: { left: '', operator: 'equals', right: true },
  },
  {
    key: 'switch',
    group: 'flow',
    nodeType: 'switch',
    label: '选择器',
    description: '根据结构化字段选择一条路径',
    config: {
      value: '',
      valueType: 'string',
      cases: [
        { id: 'case_1', label: '选项 1', value: 'option_1' },
        { id: 'case_2', label: '选项 2', value: 'option_2' },
      ],
    },
  },
  {
    key: 'merge',
    group: 'flow',
    nodeType: 'merge',
    label: '合并',
    description: '从已执行分支选择首个可用值',
    config: { fields: [] },
  },
  {
    key: 'variable',
    group: 'flow',
    nodeType: 'variable',
    label: '变量',
    description: '设置类型明确的工作流变量',
    config: { assignments: [{ name: 'value', type: 'string', value: '' }] },
  },
  {
    key: 'intent',
    group: 'logic',
    nodeType: 'intent',
    label: '意图识别',
    description: '按已配置意图将文本分流',
    config: {
      query: '',
      intents: [
        {
          id: 'intent_1',
          name: '意图 1',
          description: '',
          examples: [],
        },
      ],
    },
  },
];

const groupLabels = {
  model: '大模型',
  flow: '流程控制',
  logic: '业务逻辑',
  tool: '工具',
  subworkflow: '子工作流',
} as const;
const groupIcons = {
  model: Sparkles,
  flow: GitBranch,
  logic: Lightbulb,
  tool: Wrench,
  subworkflow: Workflow,
} as const;
const itemIcons: Record<string, typeof MessageSquare> = {
  llm: MessageSquare,
  condition: GitBranch,
  switch: GitBranch,
  merge: GitMerge,
  variable: Hash,
  intent: Lightbulb,
};

export function NodePicker({ trigger, onSelect, side = 'top', align = 'center' }: NodePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [published, setPublished] = useState<
    Array<{
      id: string;
      name: string;
      versionId: string;
      versionNumber: number;
      versionPublishedAt?: string;
      contract: PublishedWorkflowContract;
    }>
  >([]);
  const capabilities = useWorkflowCapabilities(open);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void listWorkflows({ page: 1, pageSize: 100 })
      .then(async (result) => {
        const workflows = result.list.filter((item) => item.status === 'published');
        const entries = await Promise.all(
          workflows.map(async (item) => {
            const platform = await getWorkflowPlatform(item.id);
            const version = platform.versions.find(
              (candidate) => candidate.id === platform.app.publishedVersionId,
            );
            return {
              id: item.id,
              name: item.name,
              versionId: platform.app.publishedVersionId,
              versionNumber: version?.number || 0,
              versionPublishedAt: version?.publishedAt,
              contract: publishedWorkflowContract(version?.config || ''),
            };
          }),
        );
        if (active) setPublished(entries.filter((item) => item.versionId));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  const items = useMemo(() => {
    const tools: NodePickerItem[] = capabilities.toolCapabilities
      .filter((item) => item.available)
      .map((item) => ({
        key: `tool:${item.id}`,
        group: 'tool',
        nodeType: 'tool',
        label: item.name,
        description: item.description,
        config: {
          capabilityId: item.id,
          capabilityName: item.name,
          inputs: Object.fromEntries((item.inputSchema.required || []).map((name) => [name, ''])),
        },
        sideEffect: item.sideEffect,
      }));
    const workflows: NodePickerItem[] = published.map((item) => ({
      key: `subworkflow:${item.id}`,
      group: 'subworkflow',
      nodeType: 'subworkflow',
      label: item.name,
      description: '锁定发布版本后作为子工作流调用',
      config: {
        workflowId: item.id,
        versionId: item.versionId,
        versionNumber: item.versionNumber,
        versionPublishedAt: item.versionPublishedAt,
        workflowName: item.name,
        inputs: Object.fromEntries(
          Object.keys(item.contract.inputSchema).map((name) => [name, '']),
        ),
        inputSchema: item.contract.inputSchema,
        outputSchema: item.contract.outputSchema,
      },
    }));
    const keyword = query.trim().toLowerCase();
    return [...genericItems, ...tools, ...workflows].filter(
      (item) =>
        !keyword || `${item.label} ${item.description} ${item.key}`.toLowerCase().includes(keyword),
    );
  }, [capabilities.toolCapabilities, published, query]);

  const content = (
    <PickerContent
      query={query}
      onQueryChange={setQuery}
      items={items}
      loading={capabilities.loading}
      error={capabilities.error}
      onSelect={(item) => {
        onSelect(item);
        setOpen(false);
        setQuery('');
      }}
    />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={trigger} />
        <SheetContent side="right" className="w-full max-w-none p-0">
          <SheetHeader className="border-b">
            <SheetTitle>添加节点</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side={side}
        align={align}
        className="w-[min(36rem,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
      >
        <PopoverHeader className="border-b border-border px-5 py-4">
          <PopoverTitle>添加节点</PopoverTitle>
        </PopoverHeader>
        {content}
      </PopoverContent>
    </Popover>
  );
}

function PickerContent({
  query,
  onQueryChange,
  items,
  loading,
  error,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  items: NodePickerItem[];
  loading: boolean;
  error: string | null;
  onSelect: (item: NodePickerItem) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b border-border px-5 py-4">
        <Search className="absolute left-8 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索节点、工具、工作流"
          className="pl-9"
        />
      </div>
      <ScrollArea className="h-[min(560px,70vh)]">
        <div className="space-y-6 p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在加载能力
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : (
            (Object.keys(groupLabels) as NodePickerItem['group'][]).map((group) => {
              const grouped = items.filter((item) => item.group === group);
              if (!grouped.length) return null;
              const GroupIcon = groupIcons[group];
              return (
                <section key={group}>
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <GroupIcon className="size-3.5" />
                    {groupLabels[group]}
                  </div>
                  <div
                    className={cn('grid gap-2', group === 'model' ? 'grid-cols-1' : 'grid-cols-2')}
                  >
                    {grouped.map((item) => {
                      const Icon = itemIcons[item.key] || (group === 'tool' ? Wrench : Workflow);
                      const sideEffectLabel = getWorkflowSideEffectLabel(item.sideEffect);
                      return (
                        <Button
                          key={item.key}
                          type="button"
                          variant="ghost"
                          className="h-auto min-h-20 justify-start gap-3 whitespace-normal rounded-lg border border-border/70 bg-card p-3.5 text-left hover:border-primary/25 hover:bg-accent"
                          onClick={() => onSelect(item)}
                        >
                          <span
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-lg',
                              group === 'model'
                                ? 'bg-violet-500/10 text-violet-600'
                                : group === 'flow'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : group === 'logic'
                                    ? 'bg-cyan-500/10 text-cyan-600'
                                    : group === 'tool'
                                      ? 'bg-orange-500/10 text-orange-600'
                                      : 'bg-blue-500/10 text-blue-600',
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              {item.label}
                              {sideEffectLabel ? (
                                <Badge variant="outline" className="px-1.5 text-[10px]">
                                  {sideEffectLabel}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="line-clamp-2 text-xs font-normal text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
          {!loading && !error && !items.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">没有匹配的节点</p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
