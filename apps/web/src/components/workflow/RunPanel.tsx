import type { Node } from '@xyflow/react';
import { AlertCircle, CheckCircle2, Loader2, Play, X } from 'lucide-react';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { type Group, getGroups, getTags, type Tag } from '@/api/blog';
import type { WorkflowRunDetail, WorkflowVersion } from '@/api/workflow';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeWorkflowResultActions } from './properties/ResultActionEditor';
import { workflowRunErrorGuidance } from './runErrorGuidance';
import type { WorkflowRunSession } from './runSession';
import { normalizeStartInputs, type StartInputDefinition } from './types';
import { WorkflowRunHistory } from './WorkflowRunHistory';
import { WorkflowRunInputFields } from './WorkflowRunInputFields';
import { WorkflowTestCases } from './WorkflowTestCases';

export interface WorkflowRunInput {
  inputs: Record<string, unknown>;
  files: Record<string, File>;
}

export interface WorkflowRunInputOptions {
  tags: Tag[];
  groups: Group[];
  tagsLoaded: boolean;
  groupsLoaded: boolean;
}

interface RunPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  values: Record<string, unknown>;
  files: Record<string, File>;
  onValuesChange: Dispatch<SetStateAction<Record<string, unknown>>>;
  onFilesChange: Dispatch<SetStateAction<Record<string, File>>>;
  options: WorkflowRunInputOptions;
  onOptionsChange: Dispatch<SetStateAction<WorkflowRunInputOptions>>;
  onRun: (input: WorkflowRunInput) => void;
  onCancel: () => void;
  isRunning: boolean;
  session: WorkflowRunSession;
  runError: string | null;
  preparing?: boolean;
  retrying?: boolean;
  resuming?: boolean;
  workflowId: string | null;
  versions: WorkflowVersion[];
  onRetry: (run: WorkflowRunDetail) => void;
  onResume: (run: WorkflowRunDetail) => void;
}

function startInputs(nodes: Node[]): Record<string, StartInputDefinition> {
  const node = nodes.find((item) => (item.data as { nodeType?: string }).nodeType === 'start');
  return normalizeStartInputs(
    (node?.data as { config?: { inputs?: Record<string, StartInputDefinition> } } | undefined)
      ?.config?.inputs,
  );
}

function resultActions(nodes: Node[], finalOutput: Record<string, unknown>) {
  const endNode = nodes.find((item) => (item.data as { nodeType?: string }).nodeType === 'end');
  const config = (endNode?.data as { config?: Record<string, unknown> } | undefined)?.config;
  const configured = normalizeWorkflowResultActions(config?.resultActions).flatMap((action) => {
    const path = finalOutput[action.output];
    return typeof path === 'string' && path.startsWith('/') && action.label.trim()
      ? [{ id: action.id, label: action.label.trim(), path }]
      : [];
  });
  if (configured.length > 0) return configured;
  const legacyPath = finalOutput.editPath;
  return typeof legacyPath === 'string' && legacyPath.startsWith('/')
    ? [{ id: 'legacy-edit-path', label: '打开结果', path: legacyPath }]
    : [];
}

export function RunPanel({
  open,
  onOpenChange,
  nodes,
  values,
  files,
  onValuesChange,
  onFilesChange,
  options,
  onOptionsChange,
  onRun,
  onCancel,
  isRunning,
  session,
  runError,
  preparing = false,
  retrying = false,
  resuming = false,
  workflowId,
  versions,
  onRetry,
  onResume,
}: RunPanelProps) {
  const definitions = useMemo(() => startInputs(nodes), [nodes]);
  const definitionEntries = useMemo(() => Object.entries(definitions), [definitions]);
  const hasBlogTags = definitionEntries.some(
    ([, definition]) => definition.provider === 'blog.tags',
  );
  const hasBlogGroups = definitionEntries.some(
    ([, definition]) => definition.provider === 'blog.groups',
  );
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'run' | 'records' | 'tests'>('run');
  const valuesRef = useRef(values);
  const optionsRef = useRef(options);
  const terminalRunID =
    session.status === 'success' || session.status === 'error' || session.status === 'cancelled'
      ? session.runId || undefined
      : undefined;
  const completedActions = useMemo(
    () => (session.finalOutput ? resultActions(nodes, session.finalOutput) : []),
    [nodes, session.finalOutput],
  );

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!open) return;
    if (!hasBlogTags && !hasBlogGroups) {
      setLoadingOptions(false);
      return;
    }
    let active = true;
    const cachedOptions = optionsRef.current;
    const hasCachedOptions =
      (!hasBlogTags || cachedOptions.tagsLoaded) && (!hasBlogGroups || cachedOptions.groupsLoaded);
    setLoadingOptions(!hasCachedOptions);
    Promise.all([
      hasBlogTags ? getTags() : Promise.resolve([]),
      hasBlogGroups ? getGroups({ groupType: 'blog' }) : Promise.resolve([]),
    ])
      .then(([nextTags, nextGroups]) => {
        if (!active) return;
        onOptionsChange((current) => ({
          tags: hasBlogTags ? nextTags : current.tags,
          groups: hasBlogGroups ? nextGroups : current.groups,
          tagsLoaded: hasBlogTags || current.tagsLoaded,
          groupsLoaded: hasBlogGroups || current.groupsLoaded,
        }));
        const nextValues = { ...valuesRef.current };
        let removedInvalidOption = false;
        for (const [name, definition] of definitionEntries) {
          if (definition.provider === 'blog.tags') {
            const selectedIDs = Array.isArray(nextValues[name])
              ? nextValues[name].filter((id): id is string => typeof id === 'string')
              : [];
            const availableIDs = new Set(nextTags.map((tag) => tag.id));
            const validIDs = selectedIDs.filter((id) => availableIDs.has(id));
            if (validIDs.length !== selectedIDs.length) {
              nextValues[name] = validIDs;
              removedInvalidOption = true;
            }
          }
          if (
            definition.provider === 'blog.groups' &&
            typeof nextValues[name] === 'string' &&
            nextValues[name] !== '' &&
            !nextGroups.some((group) => group.id === nextValues[name])
          ) {
            nextValues[name] = '';
            removedInvalidOption = true;
          }
        }
        if (removedInvalidOption) {
          onValuesChange(nextValues);
          toast.warning('已清除不可用的标签或分组');
        }
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
  }, [definitionEntries, hasBlogGroups, hasBlogTags, onOptionsChange, onValuesChange, open]);
  useEffect(() => {
    if (open) setActiveTab('run');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    onValuesChange((current) =>
      Object.fromEntries(
        definitionEntries.map(([name, definition]) => [
          name,
          current[name] !== undefined
            ? current[name]
            : definition.provider === 'blog.tags'
              ? []
              : definition.provider === 'static.visibility'
                ? 'private'
                : '',
        ]),
      ),
    );
    onFilesChange((current) =>
      Object.fromEntries(
        definitionEntries.flatMap(([name, definition]) =>
          definition.type === 'file' && current[name] ? [[name, current[name]]] : [],
        ),
      ),
    );
  }, [definitionEntries, onFilesChange, onValuesChange, open]);
  const setValue = (name: string, value: unknown) =>
    onValuesChange((current) => ({ ...current, [name]: value }));
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
  const runPending = preparing || isRunning;
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
              <WorkflowRunInputFields
                definitions={definitions}
                values={values}
                files={files}
                tags={options.tags}
                groups={options.groups}
                loadingOptions={loadingOptions}
                disabled={runPending}
                onValueChange={setValue}
                onFileChange={(name, file) =>
                  onFilesChange((current) => {
                    if (file) return { ...current, [name]: file };
                    const next = { ...current };
                    delete next[name];
                    return next;
                  })
                }
              />
            </section>
            {runPending && (
              <section className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {preparing
                    ? '正在准备运行…'
                    : activeNode
                      ? `正在执行：${String(activeNode.data.label)}`
                      : '正在连接运行服务…'}
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
                {completedActions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {completedActions.map((action) => (
                      <Link
                        key={action.id}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                        to={action.path}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        </TabsContent>
        <TabsContent value="records" className="min-h-0 flex-1 overflow-y-auto p-4">
          <WorkflowRunHistory
            workflowId={workflowId}
            open={open && activeTab === 'records'}
            terminalRunID={terminalRunID}
            nodeLabels={nodeLabels}
            onRetry={onRetry}
            onResume={onResume}
            resuming={isRunning || resuming}
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
      {activeTab === 'run' ? (
        <div className="border-t border-border/80 bg-card px-4 py-3">
          <div className="space-y-2">
            <Button className="w-full" onClick={handleRun} disabled={runPending}>
              {runPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {preparing ? '正在准备…' : isRunning ? '运行中…' : '开始运行'}
            </Button>
            {isRunning ? (
              <Button variant="outline" className="w-full" onClick={onCancel}>
                停止运行
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
