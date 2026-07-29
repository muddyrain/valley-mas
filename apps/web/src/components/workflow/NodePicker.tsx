import {
  BookOpen,
  Clock3,
  FileText,
  GitBranch,
  GitMerge,
  Globe2,
  Hash,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Repeat2,
  Search,
  SkipForward,
  Sparkles,
  Square,
  Workflow,
  Wrench,
} from 'lucide-react';
import {
  cloneElement,
  type MouseEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getWorkflowPlatform,
  listWorkflows,
  type WorkflowNodeDefinition,
  type WorkflowNodeType,
} from '@/api/workflow';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { type PublishedWorkflowContract, publishedWorkflowContract } from './subworkflowContract';
import { useWorkflowCapabilities } from './useWorkflowCapabilities';
import { getWorkflowSideEffectLabel } from './workflowSideEffects';

export interface NodePickerItem {
  key: string;
  group: NodePickerGroup;
  nodeType: WorkflowNodeType;
  label: string;
  description: string;
  config: Record<string, unknown>;
  sideEffect?: string;
}

type NodePickerGroup =
  | 'model'
  | 'content'
  | 'image'
  | 'knowledge'
  | 'flow'
  | 'logic'
  | 'tool'
  | 'subworkflow';
type NodePickerScope = 'root' | 'loop';

interface NodePickerProps {
  trigger: ReactElement<{
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
  onSelect: (item: NodePickerItem) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  defer?: boolean;
  scope?: NodePickerScope;
}

const groupLabels = {
  model: '大模型',
  content: '内容处理',
  image: '图片',
  knowledge: '知识',
  flow: '流程控制',
  logic: '业务逻辑',
  tool: '工具',
  subworkflow: '子工作流',
} as const;
const groupIcons = {
  model: Sparkles,
  content: FileText,
  image: ImageIcon,
  knowledge: BookOpen,
  flow: GitBranch,
  logic: Lightbulb,
  tool: Wrench,
  subworkflow: Workflow,
} as const;
const itemIcons: Record<string, typeof MessageSquare> = {
  http: Globe2,
  llm: MessageSquare,
  template: FileText,
  condition: GitBranch,
  switch: GitBranch,
  merge: GitMerge,
  variable: Hash,
  intent: Lightbulb,
  loop: Repeat2,
  set_loop_variable: Hash,
  continue_loop: SkipForward,
  terminate_loop: Square,
  delay: Clock3,
};

const pickerNodeTypes = new Set<WorkflowNodeType>([
  'llm',
  'template',
  'http',
  'condition',
  'switch',
  'merge',
  'variable',
  'intent',
  'loop',
  'set_loop_variable',
  'continue_loop',
  'terminate_loop',
  'delay',
]);
const loopControlNodeTypes = new Set<WorkflowNodeType>([
  'set_loop_variable',
  'continue_loop',
  'terminate_loop',
]);

function normalizeGroup(category: string): NodePickerGroup {
  return category in groupLabels ? (category as NodePickerGroup) : 'tool';
}

function genericNodeItems(
  definitions: WorkflowNodeDefinition[],
  scope: NodePickerScope,
): NodePickerItem[] {
  return definitions.flatMap((definition) => {
    if (!pickerNodeTypes.has(definition.type)) return [];
    const loopControl = loopControlNodeTypes.has(definition.type);
    if (scope === 'root' && loopControl) return [];
    return [
      {
        key: definition.type,
        group: normalizeGroup(definition.category),
        nodeType: definition.type,
        label: definition.label,
        description: definition.description,
        config: definition.defaultConfig || {},
      },
    ];
  });
}

export function NodePicker({
  trigger,
  onSelect,
  side = 'top',
  align = 'center',
  defer = false,
  scope = 'root',
}: NodePickerProps) {
  if (defer) return trigger;
  return (
    <NodePickerPopover
      trigger={trigger}
      onSelect={onSelect}
      side={side}
      align={align}
      scope={scope}
    />
  );
}

export function DeferredNodePicker({
  trigger,
  onSelect,
  side = 'top',
  align = 'center',
  scope = 'root',
  open: controlledOpen,
  onOpenChange,
}: Omit<NodePickerProps, 'defer'> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  if (!open) {
    return cloneElement(trigger, {
      onClick: (event: MouseEvent<HTMLElement>) => {
        trigger.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      },
    });
  }

  return (
    <NodePickerPopover
      trigger={trigger}
      onSelect={onSelect}
      side={side}
      align={align}
      scope={scope}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

function NodePickerPopover({
  trigger,
  onSelect,
  side,
  align,
  scope = 'root',
  open: controlledOpen,
  onOpenChange,
}: Omit<NodePickerProps, 'defer'> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );
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
    if (!open) return [];
    const tools: NodePickerItem[] = capabilities.toolCapabilities
      .filter((item) => item.available)
      .map((item) => ({
        key: `tool:${item.id}`,
        group: normalizeGroup(item.category),
        nodeType: 'tool',
        label: item.name,
        description: item.description,
        config: {
          capabilityId: item.id,
          capabilityName: item.name,
          ...(item.id === 'image.generate' ? { timeoutSeconds: 240 } : {}),
          inputs: Object.fromEntries(
            (item.inputSchema.required || []).map((name) => [
              name,
              item.inputSchema.properties?.[name]?.default ?? '',
            ]),
          ),
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
    const generic = genericNodeItems(capabilities.nodeTypes, scope);
    return [...generic, ...tools, ...workflows].filter(
      (item) =>
        !keyword || `${item.label} ${item.description} ${item.key}`.toLowerCase().includes(keyword),
    );
  }, [capabilities.nodeTypes, capabilities.toolCapabilities, open, published, query, scope]);

  const content = (
    <PickerContent
      query={query}
      onQueryChange={setQuery}
      items={items}
      loading={capabilities.loading}
      error={capabilities.error}
      onSelect={(item) => {
        onSelect({ ...item, config: structuredClone(item.config) });
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
          <SheetHeader className="border-b border-border">
            <SheetTitle>添加节点</SheetTitle>
          </SheetHeader>
          {open ? content : null}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      {open ? (
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
      ) : null}
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
            <NodePickerLoadingSkeleton />
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
                      const Icon = itemIcons[item.key] || groupIcons[group];
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
                                : group === 'content'
                                  ? 'bg-sky-500/10 text-sky-600'
                                  : group === 'image'
                                    ? 'bg-fuchsia-500/10 text-fuchsia-600'
                                    : group === 'knowledge'
                                      ? 'bg-indigo-500/10 text-indigo-600'
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

function NodePickerLoadingSkeleton() {
  return (
    <>
      {[0, 1, 2].map((group) => (
        <section key={group} aria-hidden="true">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="flex min-h-20 items-start gap-3 rounded-lg border border-border/70 bg-card p-3.5"
              >
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
