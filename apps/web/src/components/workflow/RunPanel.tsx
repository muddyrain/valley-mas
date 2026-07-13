import type { Node } from '@xyflow/react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Play, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { type Group, getGroups, getTags, type Tag } from '@/api/blog';
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
import { cn } from '@/lib/utils';
import type { WorkflowRunSession } from './runSession';
import { normalizePhaseOneStartInputs, type StartInputDefinition } from './types';

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
}

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
  return normalizePhaseOneStartInputs(
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
}: RunPanelProps) {
  const definitions = startInputs(nodes);
  const [values, setValues] = useState<Record<string, unknown>>({
    visibility: 'private',
    tagIds: [],
  });
  const [files, setFiles] = useState<Record<string, File>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingOptions(true);
    Promise.all([getTags(), getGroups({ groupType: 'blog' })])
      .then(([nextTags, nextGroups]) => {
        setTags(nextTags);
        setGroups(nextGroups);
      })
      .catch(() => toast.error('加载博客标签或分组失败'))
      .finally(() => setLoadingOptions(false));
  }, [open]);
  const setValue = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));
  const toggleTag = (id: string, checked: boolean) =>
    setValue(
      'tagIds',
      checked
        ? [...((values.tagIds as string[]) || []), id]
        : ((values.tagIds as string[]) || []).filter((value) => value !== id),
    );
  const handleRun = useCallback(() => {
    for (const [name, definition] of Object.entries(definitions)) {
      const value = definition.type === 'file' ? files[name] : values[name];
      if (
        definition.required &&
        (value === undefined || value === '' || (Array.isArray(value) && value.length === 0))
      ) {
        toast.warning(`请填写必填参数“${name}”`);
        return;
      }
    }
    onRun({ inputs: values, files });
  }, [definitions, files, values, onRun]);
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
  const selectedTagIds = (values.tagIds as string[]) || [];
  const selectedGroup = groups.find((group) => group.id === values.groupId);

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold">试运行</h2>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">运行输入</p>
            {definitions.markdownFile && (
              <div className="space-y-1.5">
                <InputLabel
                  htmlFor="workflow-markdown"
                  required={definitions.markdownFile.required}
                >
                  Markdown 文件
                </InputLabel>
                <Input
                  id="workflow-markdown"
                  type="file"
                  accept=".md,.markdown,text/markdown"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setFiles((current) => ({ ...current, markdownFile: file }));
                  }}
                />
                {files.markdownFile && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {files.markdownFile.name}
                  </p>
                )}
              </div>
            )}
            {definitions.tagIds && (
              <div className="space-y-2">
                <InputLabel required={definitions.tagIds.required}>博客标签</InputLabel>
                {loadingOptions ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <label
                        key={tag.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                          selectedTagIds.includes(tag.id)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border',
                        )}
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={(checked) => toggleTag(tag.id, Boolean(checked))}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {definitions.groupId && (
              <div className="space-y-1.5">
                <InputLabel required={definitions.groupId.required}>博客分组</InputLabel>
                <Select
                  value={(values.groupId as string) || '_none'}
                  onValueChange={(groupId) =>
                    setValue('groupId', groupId === '_none' ? '' : groupId)
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
            )}
            {definitions.visibility && (
              <div className="space-y-1.5">
                <InputLabel required={definitions.visibility.required}>可见范围</InputLabel>
                <Select
                  value={(values.visibility as string) || 'private'}
                  onValueChange={(visibility) => setValue('visibility', visibility)}
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
            )}
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
                <p className="mt-1 text-xs text-destructive/90">错误码：{session.failedNodeCode}</p>
              )}
            </section>
          )}
          {finalOutput && (
            <section className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                草稿已创建
              </div>
              <p className="text-xs text-muted-foreground">{String(finalOutput.title || '')}</p>
              <Link
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                to={String(finalOutput.editPath)}
              >
                打开草稿
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
