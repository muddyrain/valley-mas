import type { Node } from '@xyflow/react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Loader2,
  Play,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import request from '@/utils/request';

export interface NodeResult {
  status: 'idle' | 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

interface RunPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  onRun: (inputs: Record<string, Record<string, unknown>>) => void;
  isRunning: boolean;
  nodeResults: Record<string, NodeResult>;
}

export interface VariableDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'file' | 'select';
  required: boolean;
  dataSource?: {
    api: string;
    labelField: string;
    valueField: string;
  };
  options?: Array<{ label: string; value: string }>;
  allowCustom?: boolean;
}

function extractStartVariables(nodes: Node[]): VariableDef[] {
  const startNode = nodes.find((n) => (n.data as { nodeType: string }).nodeType === 'start');
  if (!startNode) return [];
  const config = (startNode.data as { config?: Record<string, unknown> }).config;
  if (!config?.variables) return [];
  return (config.variables as VariableDef[]).filter((v) => v.name);
}

function NodeResultItem({ node, result }: { node: Node; result: NodeResult }) {
  const data = node.data as { label: string; nodeType: string };
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    idle: <Circle className="h-3.5 w-3.5 text-slate-300" />,
    running: <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
    error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  }[result.status];

  const statusLabel = {
    idle: '等待中',
    running: '运行中',
    success: '成功',
    error: '失败',
  }[result.status];

  const hasDetails = result.input || result.output || result.error;

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {statusIcon}
        <span className="text-sm font-medium text-foreground flex-1">{data.label}</span>
        {result.duration != null && result.status === 'success' && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {result.duration}ms
          </span>
        )}
        <span
          className={cn(
            'text-xs',
            result.status === 'success' && 'text-green-600',
            result.status === 'error' && 'text-red-500',
            result.status === 'running' && 'text-blue-500',
            result.status === 'idle' && 'text-slate-400',
          )}
        >
          {statusLabel}
        </span>
        {hasDetails &&
          (expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ))}
      </button>
      {expanded && hasDetails && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {result.input && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">输入</p>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">
                {JSON.stringify(result.input, null, 2)}
              </pre>
            </div>
          )}
          {result.output && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">输出</p>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}
          {result.error && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1">错误</p>
              <p className="text-xs text-red-500">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RunPanel({
  open,
  onOpenChange,
  nodes,
  onRun,
  isRunning,
  nodeResults,
}: RunPanelProps) {
  const variables = extractStartVariables(nodes);
  const hasInputs = variables.length > 0;

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [selectOptions, setSelectOptions] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});
  const [selectLoading, setSelectLoading] = useState<Record<string, boolean>>({});
  const [selectFailed, setSelectFailed] = useState<Record<string, boolean>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const selectVars = variables.filter((v) => v.type === 'select' && v.dataSource);
    if (selectVars.length === 0) return;

    const fetchOptions = async () => {
      for (const v of selectVars) {
        if (!v.dataSource || fetchedRef.current.has(v.name)) continue;
        fetchedRef.current.add(v.name);
        setSelectLoading((prev) => ({ ...prev, [v.name]: true }));
        try {
          const data = await request.get<unknown, Record<string, unknown>[]>(v.dataSource.api);
          const items = Array.isArray(data)
            ? data
            : (data as { list?: Record<string, unknown>[] }).list || [];
          const ds = v.dataSource;
          const opts = items.map((item) => ({
            label: String(item[ds.labelField] ?? ''),
            value: String(item[ds.valueField] ?? ''),
          }));
          setSelectOptions((prev) => ({ ...prev, [v.name]: opts }));
        } catch {
          setSelectFailed((prev) => ({ ...prev, [v.name]: true }));
        } finally {
          setSelectLoading((prev) => ({ ...prev, [v.name]: false }));
        }
      }
    };
    fetchOptions();
  }, [variables]);

  const getValue = useCallback(
    (name: string, type: string): unknown => {
      return values[name] ?? (type === 'boolean' ? false : '');
    },
    [values],
  );

  const setValue = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (name: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setValue(name, file);
    }
  };

  const handleRun = useCallback(() => {
    for (const v of variables) {
      if (!v.required) continue;
      const val = getValue(v.name, v.type);
      if (val === '' || val === undefined || val === null) {
        toast.warning(`请填写必填参数 "${v.name}"`);
        return;
      }
    }

    for (const key of Object.keys(jsonErrors)) {
      if (jsonErrors[key]) {
        toast.warning('请修正 JSON 格式错误');
        return;
      }
    }

    const startNode = nodes.find((n) => (n.data as { nodeType: string }).nodeType === 'start');
    onRun({ [startNode?.id || 'start-1']: values });
  }, [variables, values, jsonErrors, nodes, onRun, getValue]);

  if (!open) return null;

  const hasRunResults = Object.values(nodeResults).some(
    (r) => r.status !== 'idle' && r.status !== undefined,
  );

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">试运行</h2>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* 输入参数 */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">输入参数</p>
            {hasInputs ? (
              <div className="space-y-3">
                {variables.map((v) => {
                  const val = getValue(v.name, v.type);
                  const errorKey = v.name;

                  return (
                    <div key={v.name} className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-sm">
                          {v.name}
                          {v.required && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>
                      </div>
                      {v.type === 'boolean' ? (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!val}
                            onCheckedChange={(checked) => setValue(v.name, !!checked)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {val ? 'true' : 'false'}
                          </span>
                        </div>
                      ) : v.type === 'object' ? (
                        <>
                          <Textarea
                            className="font-mono text-xs"
                            value={(val as string) || ''}
                            onChange={(e) => {
                              setValue(v.name, e.target.value);
                              try {
                                if (e.target.value.trim()) JSON.parse(e.target.value);
                                setJsonErrors((prev) => ({ ...prev, [errorKey]: '' }));
                              } catch {
                                setJsonErrors((prev) => ({
                                  ...prev,
                                  [errorKey]: 'JSON 格式不正确',
                                }));
                              }
                            }}
                            placeholder='{"key": "value"}'
                            rows={3}
                          />
                          {jsonErrors[errorKey] && (
                            <p className="text-xs text-red-500">{jsonErrors[errorKey]}</p>
                          )}
                        </>
                      ) : v.type === 'file' ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileChange(v.name, e)}
                            id={`file-input-${v.name}`}
                          />
                          {val instanceof File ? (
                            <div className="flex items-center justify-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate max-w-[200px]">
                                {val.name}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setValue(v.name, '')}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor={`file-input-${v.name}`}
                              className="flex flex-col items-center gap-2 cursor-pointer"
                            >
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                点击或拖拽文件到此处
                              </span>
                            </label>
                          )}
                        </div>
                      ) : v.type === 'select' ? (
                        <div className="space-y-1.5">
                          {selectLoading[v.name] ? (
                            <div className="space-y-2">
                              <Skeleton className="h-8 w-full" />
                            </div>
                          ) : selectFailed[v.name] ? (
                            <div className="space-y-1.5">
                              <Badge variant="secondary" className="text-xs">
                                加载选项失败，请手动输入
                              </Badge>
                              <Input
                                value={val as string}
                                onChange={(e) => setValue(v.name, e.target.value)}
                                placeholder={`输入 ${v.name}`}
                                className="text-sm"
                              />
                            </div>
                          ) : (
                            <>
                              <Select
                                value={(val as string) || ''}
                                onValueChange={(selectedVal) => {
                                  if (selectedVal === '__custom__') {
                                    setValue(v.name, '');
                                  } else {
                                    setValue(v.name, selectedVal);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder={`选择 ${v.name}`} />
                                </SelectTrigger>
                                <SelectContent className="w-full">
                                  {(v.dataSource
                                    ? selectOptions[v.name] || []
                                    : v.options || []
                                  ).map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                  {v.allowCustom !== false && (
                                    <>
                                      <SelectSeparator />
                                      <SelectItem value="__custom__">手动输入</SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>
                              {v.allowCustom !== false &&
                                typeof val === 'string' &&
                                !selectOptions[v.name]?.some((o) => o.value === val) && (
                                  <Input
                                    value={val}
                                    onChange={(e) => setValue(v.name, e.target.value)}
                                    className="mt-1"
                                    placeholder="输入自定义值"
                                  />
                                )}
                            </>
                          )}
                        </div>
                      ) : (
                        <Input
                          type={v.type === 'number' ? 'number' : 'text'}
                          value={(val as string) || ''}
                          onChange={(e) => setValue(v.name, e.target.value)}
                          placeholder={v.type === 'number' ? '0' : `输入 ${v.name}`}
                          className="text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">未设置输入参数，在"开始"节点中添加</p>
              </div>
            )}
          </div>

          {/* 运行按钮 */}
          <Button className="w-full" onClick={handleRun} disabled={isRunning}>
            <Play className="h-4 w-4 mr-2" />
            {isRunning ? '运行中...' : '开始运行'}
          </Button>

          {/* 运行结果 */}
          {hasRunResults && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">运行结果</p>
              <div className="space-y-2">
                {nodes.map((node) => {
                  const result = nodeResults[node.id];
                  if (!result || result.status === 'idle') return null;
                  return <NodeResultItem key={node.id} node={node} result={result} />;
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
