import type { Node } from '@xyflow/react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Play, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { type Group, getGroups, getTags, type Tag } from '@/api/blog';
import type { WorkflowRunDetail, WorkflowVersion } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { workflowRunErrorGuidance } from './runErrorGuidance';
import type { WorkflowRunSession } from './runSession';
import {
  normalizeStartInputs,
  type StartInputDefinition,
  type WorkflowStartInputControl,
} from './types';
import { WorkflowRunHistory } from './WorkflowRunHistory';
import { WorkflowTestCases } from './WorkflowTestCases';

export interface WorkflowRunInput {
  inputs: Record<string, unknown>;
  files: Record<string, File>;
}

interface RunPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  onRun: (input: WorkflowRunInput) => void;
  onCancel: () => void;
  isRunning: boolean;
  session: WorkflowRunSession;
  runError: string | null;
  retrying?: boolean;
  workflowId: string | null;
  versions: WorkflowVersion[];
  onRetry: (run: WorkflowRunDetail) => void;
  onResume: (run: WorkflowRunDetail) => void;
}

const customInputCopy: Record<string, { label: string; placeholder?: string }> = {
  topic: {
    label: '写作主题',
    placeholder: '例如：个人创作者如何建立内容素材库',
  },
  audience: {
    label: '目标读者',
    placeholder: '例如：独立开发者和内容创作者',
  },
  style: {
    label: '风格',
    placeholder: '例如：简洁、专业、科技感',
  },
  generateCover: {
    label: '生成封面',
  },
};

const inputControlCopy: Record<Exclude<WorkflowStartInputControl, 'default'>, { label: string }> = {
  markdown_file: { label: 'Markdown 文件' },
  blog_tags: { label: '博客标签' },
  blog_group: { label: '博客分组' },
  visibility: { label: '可见范围' },
};

function InputLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-2">
      <span>
        {children}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <Badge variant={required ? 'secondary' : 'outline'}>{required ? '必填' : '可选'}</Badge>
    </Label>
  );
}

function startInputs(nodes: Node[]): Record<string, StartInputDefinition> {
  const node = nodes.find((item) => (item.data as { nodeType?: string }).nodeType === 'start');
  return normalizeStartInputs(
    (node?.data as { config?: { inputs?: Record<string, StartInputDefinition> } } | undefined)
      ?.config?.inputs,
  );
}

export function RunPanel({
  open,
  onOpenChange,
  nodes,
  onRun,
  onCancel,
  isRunning,
  session,
  runError,
  retrying = false,
  workflowId,
  versions,
  onRetry,
  onResume,
}: RunPanelProps) {
  const definitions = useMemo(() => startInputs(nodes), [nodes]);
  const definitionEntries = useMemo(() => Object.entries(definitions), [definitions]);
  const hasBlogTags = definitionEntries.some(
    ([, definition]) => definition.control === 'blog_tags',
  );
  const hasBlogGroups = definitionEntries.some(
    ([, definition]) => definition.control === 'blog_group',
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'run' | 'records' | 'tests'>('run');

  useEffect(() => {
    if (!open) return;
    if (!hasBlogTags && !hasBlogGroups) {
      setTags([]);
      setGroups([]);
      setLoadingOptions(false);
      return;
    }
    let active = true;
    setLoadingOptions(true);
    Promise.all([
      hasBlogTags ? getTags() : Promise.resolve([]),
      hasBlogGroups ? getGroups({ groupType: 'blog' }) : Promise.resolve([]),
    ])
      .then(([nextTags, nextGroups]) => {
        if (!active) return;
        setTags(nextTags);
        setGroups(nextGroups);
      })
      .catch(() => {
        if (active) toast.error('加载博客标签或分组失败');
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [hasBlogGroups, hasBlogTags, open]);
  useEffect(() => {
    if (open) setActiveTab('run');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setValues((current) =>
      Object.fromEntries(
        definitionEntries.map(([name, definition]) => [
          name,
          current[name] !== undefined
            ? current[name]
            : definition.control === 'blog_tags'
              ? []
              : definition.control === 'visibility'
                ? 'private'
                : '',
        ]),
      ),
    );
    setFiles((current) =>
      Object.fromEntries(
        definitionEntries.flatMap(([name, definition]) =>
          definition.type === 'file' && current[name] ? [[name, current[name]]] : [],
        ),
      ),
    );
  }, [definitionEntries, open]);
  const setValue = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));
  const toggleTag = (name: string, id: string, checked: boolean) =>
    setValue(
      name,
      checked
        ? [...((values[name] as string[]) || []), id]
        : ((values[name] as string[]) || []).filter((value) => value !== id),
    );
  const handleRun = useCallback(() => {
    const runValues: Record<string, unknown> = {};
    const runFiles: Record<string, File> = {};
    for (const [name, definition] of definitionEntries) {
      const value = definition.type === 'file' ? files[name] : values[name];
      if (
        definition.required &&
        (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      ) {
        toast.warning(`请填写必填参数“${name}”`);
        return;
      }
      if (definition.type === 'file') {
        if (files[name]) runFiles[name] = files[name];
      } else {
        runValues[name] = value;
      }
    }
    onRun({ inputs: runValues, files: runFiles });
  }, [definitionEntries, files, values, onRun]);
  const nodeLabels = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((node) => [
          node.id,
          typeof node.data?.label === 'string' ? node.data.label : node.id,
        ]),
      ),
    [nodes],
  );
  if (!open) return null;
  const finalOutput = session.finalOutput;
  const activeNode = nodes.find((node) => session.nodes[node.id]?.status === 'running');
  const failedNode = session.failedNodeId
    ? nodes.find((node) => node.id === session.failedNodeId)
    : null;
  const failureMessage = runError || session.error || null;
  const failedNodeLabel =
    failedNode && typeof failedNode.data?.label === 'string'
      ? failedNode.data.label
      : session.failedNodeId;
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">{retrying ? '重新运行' : '试运行'}</h2>
          {retrying ? (
            <p className="mt-0.5 text-xs text-muted-foreground">历史输入已隐藏，请重新填写。</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="关闭试运行"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'run' | 'records' | 'tests')}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="border-b border-border bg-card px-4 py-2">
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="run" className="flex-none px-3">
              试运行
            </TabsTrigger>
            <TabsTrigger value="records" className="flex-none px-3">
              调试记录
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex-none px-3">
              测试用例
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="run" className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">运行输入</p>
              {definitionEntries.map(([name, definition]) => {
                const inputID = `workflow-input-${name}`;
                const copy = customInputCopy[name];
                const label =
                  definition.control === 'default'
                    ? copy?.label || name
                    : inputControlCopy[definition.control].label;
                if (definition.control === 'markdown_file') {
                  return (
                    <div key={definition.id || name} className="space-y-1.5">
                      <InputLabel htmlFor={inputID} required={definition.required}>
                        {label}
                      </InputLabel>
                      <Input
                        id={inputID}
                        type="file"
                        accept=".md,.markdown,text/markdown"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setFiles((current) => {
                            if (file) return { ...current, [name]: file };
                            const next = { ...current };
                            delete next[name];
                            return next;
                          });
                        }}
                      />
                      {files[name] ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {files[name].name}
                        </p>
                      ) : null}
                    </div>
                  );
                }
                if (definition.control === 'blog_tags') {
                  const selectedTagIds = (values[name] as string[]) || [];
                  return (
                    <div key={definition.id || name} className="space-y-2">
                      <InputLabel required={definition.required}>{label}</InputLabel>
                      {loadingOptions ? (
                        <Skeleton className="h-16 w-full" />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <label
                              key={tag.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs',
                                selectedTagIds.includes(tag.id) &&
                                  'border-primary bg-primary/10 text-primary',
                              )}
                            >
                              <Checkbox
                                checked={selectedTagIds.includes(tag.id)}
                                onCheckedChange={(checked) =>
                                  toggleTag(name, tag.id, Boolean(checked))
                                }
                              />
                              {tag.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                if (definition.control === 'blog_group') {
                  const selectedGroup = groups.find((group) => group.id === values[name]);
                  return (
                    <div key={definition.id || name} className="space-y-1.5">
                      <InputLabel required={definition.required}>{label}</InputLabel>
                      <Select
                        value={(values[name] as string) || '_none'}
                        onValueChange={(groupId) =>
                          setValue(name, groupId === '_none' ? '' : groupId)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="不指定分组">
                            {selectedGroup?.name || '不指定分组'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">不指定分组</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                if (definition.control === 'visibility') {
                  return (
                    <div key={definition.id || name} className="space-y-1.5">
                      <InputLabel required={definition.required}>{label}</InputLabel>
                      <Select
                        value={(values[name] as string) || 'private'}
                        onValueChange={(visibility) => setValue(name, visibility)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">私密</SelectItem>
                          <SelectItem value="shared">共享</SelectItem>
                          <SelectItem value="public">公开</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                if (definition.type === 'boolean') {
                  return (
                    <div key={definition.id || name} className="flex items-center gap-2">
                      <Checkbox
                        id={inputID}
                        checked={values[name] === true}
                        onCheckedChange={(checked) => setValue(name, checked === true)}
                      />
                      <InputLabel htmlFor={inputID} required={definition.required}>
                        {label}
                      </InputLabel>
                    </div>
                  );
                }
                if (definition.type === 'file') {
                  return (
                    <div key={definition.id || name} className="space-y-1.5">
                      <InputLabel htmlFor={inputID} required={definition.required}>
                        {label}
                      </InputLabel>
                      <Input
                        id={inputID}
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          setFiles((current) => {
                            if (file) return { ...current, [name]: file };
                            const next = { ...current };
                            delete next[name];
                            return next;
                          });
                        }}
                      />
                    </div>
                  );
                }
                return (
                  <div key={definition.id || name} className="space-y-1.5">
                    <InputLabel htmlFor={inputID} required={definition.required}>
                      {label}
                    </InputLabel>
                    <Input
                      id={inputID}
                      type={definition.type === 'number' ? 'number' : 'text'}
                      value={String(values[name] || '')}
                      placeholder={
                        copy?.placeholder ||
                        (definition.type === 'string[]' ? '以逗号分隔' : undefined)
                      }
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (definition.type === 'number') {
                          setValue(name, raw === '' ? '' : Number(raw));
                        } else if (definition.type === 'string[]') {
                          setValue(
                            name,
                            raw
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          );
                        } else {
                          setValue(name, raw);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </section>
            <Button className="w-full" onClick={handleRun} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />
              {isRunning ? '运行中…' : '开始运行'}
            </Button>
            {isRunning && (
              <Button variant="outline" className="w-full" onClick={onCancel}>
                停止运行
              </Button>
            )}
            {isRunning && (
              <section className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {activeNode ? `正在执行：${String(activeNode.data.label)}` : '正在准备运行…'}
                </span>
              </section>
            )}
            {failureMessage && (
              <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p className="mb-1 flex items-center gap-2 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  运行失败
                </p>
                {failedNodeLabel && (
                  <p className="text-xs text-destructive/90">失败节点：{failedNodeLabel}</p>
                )}
                <p className="text-xs text-destructive/90">{failureMessage}</p>
                {session.failedNodeCode && (
                  <>
                    <p className="mt-1 text-xs text-destructive/90">
                      错误码：{session.failedNodeCode}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      建议：{workflowRunErrorGuidance(session.failedNodeCode)}
                    </p>
                  </>
                )}
              </section>
            )}
            {finalOutput && (
              <section className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  工作流执行完成
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-2 text-xs text-foreground">
                  {JSON.stringify(finalOutput, null, 2)}
                </pre>
                {typeof finalOutput.editPath === 'string' && finalOutput.editPath ? (
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                    to={finalOutput.editPath}
                  >
                    打开结果
                  </Link>
                ) : null}
              </section>
            )}
          </div>
        </TabsContent>
        <TabsContent value="records" className="min-h-0 flex-1 overflow-y-auto p-4">
          <WorkflowRunHistory
            workflowId={workflowId}
            open={open && activeTab === 'records'}
            nodeLabels={nodeLabels}
            onRetry={onRetry}
            onResume={onResume}
          />
        </TabsContent>
        <TabsContent value="tests" className="min-h-0 flex-1 overflow-y-auto p-4">
          <WorkflowTestCases
            workflowId={workflowId}
            versions={versions}
            open={open && activeTab === 'tests'}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
