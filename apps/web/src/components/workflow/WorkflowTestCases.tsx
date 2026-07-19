import { CheckCircle2, Play, Plus, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import {
  createWorkflowTestCase,
  deleteWorkflowTestCase,
  listWorkflowTestCases,
  runWorkflowTestCase,
  type WorkflowTestAssertion,
  type WorkflowTestAssertionOperator,
  type WorkflowTestCase,
  type WorkflowVersion,
} from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

type DraftAssertion = {
  field: string;
  operator: WorkflowTestAssertionOperator;
  value: string;
};

const operatorLabels: Record<WorkflowTestAssertionOperator, string> = {
  exists: '字段存在',
  type: '类型匹配',
  equals: '精确相等',
  contains: '包含',
  range: '数值范围',
  jsonSchema: 'JSON Schema',
};

function newAssertion(): DraftAssertion {
  return { field: '', operator: 'exists', value: '' };
}

function parseInputObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function assertionValue(operator: WorkflowTestAssertionOperator, raw: string): unknown {
  if (operator === 'exists') return undefined;
  if (operator === 'type') return raw.trim();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function resultMeta(status: NonNullable<WorkflowTestCase['latestResult']>['status']) {
  if (status === 'passed')
    return { label: '通过', variant: 'default' as const, Icon: CheckCircle2 };
  if (status === 'failed')
    return { label: '未通过', variant: 'destructive' as const, Icon: XCircle };
  if (status === 'rejected')
    return { label: '未执行', variant: 'secondary' as const, Icon: XCircle };
  return { label: '异常', variant: 'destructive' as const, Icon: XCircle };
}

export function WorkflowTestCases({
  workflowId,
  versions,
  open,
}: {
  workflowId: string | null;
  versions: WorkflowVersion[];
  open: boolean;
}) {
  const availableVersions = useMemo(
    () => [...versions].sort((a, b) => b.number - a.number),
    [versions],
  );
  const [cases, setCases] = useState<WorkflowTestCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningID, setRunningID] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [versionID, setVersionID] = useState('');
  const [inputs, setInputs] = useState('{}');
  const [assertions, setAssertions] = useState<DraftAssertion[]>([newAssertion()]);

  const load = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const result = await listWorkflowTestCases(workflowId);
      setCases(result.list);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载测试用例失败'));
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (!open || !workflowId) return;
    void load();
  }, [load, open, workflowId]);

  useEffect(() => {
    if (!versionID && availableVersions[0]) setVersionID(availableVersions[0].id);
  }, [availableVersions, versionID]);

  const resetDraft = () => {
    setName('');
    setInputs('{}');
    setAssertions([newAssertion()]);
    setVersionID(availableVersions[0]?.id || '');
    setCreating(false);
  };

  const save = async () => {
    if (!workflowId) return;
    const parsedInputs = parseInputObject(inputs);
    if (!name.trim()) {
      toast.error('请填写测试用例名称');
      return;
    }
    if (!versionID) {
      toast.error('请选择要锁定的版本');
      return;
    }
    if (!parsedInputs) {
      toast.error('测试输入必须是 JSON 对象');
      return;
    }
    if (assertions.some((item) => !item.field.trim())) {
      toast.error('请填写每条断言的输出字段');
      return;
    }
    const payload: WorkflowTestAssertion[] = assertions.map((item) => ({
      field: item.field.trim(),
      operator: item.operator,
      ...(item.operator === 'exists' ? {} : { value: assertionValue(item.operator, item.value) }),
    }));
    setSaving(true);
    try {
      await createWorkflowTestCase(workflowId, {
        name: name.trim(),
        versionId: versionID,
        inputs: parsedInputs,
        assertions: payload,
      });
      toast.success('测试用例已创建');
      resetDraft();
      await load();
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建测试用例失败'));
    } finally {
      setSaving(false);
    }
  };

  const run = async (testCase: WorkflowTestCase) => {
    if (!workflowId) return;
    setRunningID(testCase.id);
    try {
      const { result } = await runWorkflowTestCase(workflowId, testCase.id);
      if (result.status === 'passed') toast.success('测试通过');
      else if (result.status === 'failed') toast.error('测试未通过');
      else toast.error(result.errorCode || '测试未能执行');
      await load();
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '执行测试用例失败'));
    } finally {
      setRunningID(null);
    }
  };

  const remove = async (testCase: WorkflowTestCase) => {
    if (!workflowId) return;
    try {
      await deleteWorkflowTestCase(workflowId, testCase.id);
      toast.success('测试用例已删除');
      await load();
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除测试用例失败'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">回归测试</h3>
          <p className="mt-1 text-xs text-muted-foreground">版本锁定 · 独立运行记录</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!availableVersions.length}
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-2 size-4" />
          新建
        </Button>
      </div>

      {creating ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="测试用例名称"
          />
          <Select value={versionID} onValueChange={(value) => setVersionID(value || '')}>
            <SelectTrigger aria-label="锁定的工作流版本">
              <SelectValue placeholder="选择版本" />
            </SelectTrigger>
            <SelectContent side="bottom" align="start" alignItemWithTrigger={false}>
              {availableVersions.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  v{version.number}
                  {version.publishedAt ? ' · 已发布' : ' · 草稿快照'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={inputs}
            onChange={(event) => setInputs(event.target.value)}
            placeholder={'{\n  "title": "示例"\n}'}
            aria-label="测试输入 JSON"
          />
          <div className="space-y-2">
            {assertions.map((assertion, index) => (
              <div
                key={`${index}-${assertion.operator}`}
                className="space-y-2 rounded-md border border-border p-2"
              >
                <div className="flex gap-2">
                  <Input
                    value={assertion.field}
                    onChange={(event) =>
                      setAssertions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, field: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="输出字段，如 title"
                  />
                  <Select
                    value={assertion.operator}
                    onValueChange={(value) =>
                      setAssertions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                operator: value as WorkflowTestAssertionOperator,
                                value: '',
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-32" aria-label="断言规则">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start" alignItemWithTrigger={false}>
                      {(Object.keys(operatorLabels) as WorkflowTestAssertionOperator[]).map(
                        (operator) => (
                          <SelectItem key={operator} value={operator}>
                            {operatorLabels[operator]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  {assertions.length > 1 ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="删除断言"
                      onClick={() =>
                        setAssertions((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                {assertion.operator !== 'exists' ? (
                  <Input
                    value={assertion.value}
                    onChange={(event) =>
                      setAssertions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder={
                      assertion.operator === 'type'
                        ? 'string'
                        : assertion.operator === 'range'
                          ? '{"min": 1, "max": 10}'
                          : assertion.operator === 'jsonSchema'
                            ? '{"type":"object","required":["title"]}'
                            : '预期值'
                    }
                    aria-label="断言期望值"
                  />
                ) : null}
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAssertions((current) => [...current, newAssertion()])}
            >
              <Plus className="mr-2 size-4" />
              添加断言
            </Button>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={resetDraft}>
              取消
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? '创建中…' : '创建用例'}
            </Button>
          </div>
        </div>
      ) : null}

      {!availableVersions.length ? (
        <p className="py-4 text-sm text-muted-foreground">暂无可用版本</p>
      ) : null}
      {!cases.length && !creating && availableVersions.length ? (
        <p className="py-4 text-sm text-muted-foreground">还没有回归用例。</p>
      ) : null}
      <div className="space-y-2">
        {cases.map((testCase) => {
          const version = availableVersions.find((item) => item.id === testCase.versionId);
          const meta = testCase.latestResult ? resultMeta(testCase.latestResult.status) : null;
          return (
            <article key={testCase.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{testCase.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    锁定 v{version?.number ?? '—'} ·{' '}
                    {new Date(testCase.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {meta ? (
                    <Badge variant={meta.variant}>
                      <meta.Icon className="mr-1 size-3" />
                      {meta.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">未运行</Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`运行 ${testCase.name}`}
                    disabled={runningID === testCase.id}
                    onClick={() => void run(testCase)}
                  >
                    <Play className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`删除 ${testCase.name}`}
                    onClick={() => void remove(testCase)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              {testCase.latestResult?.errorCode ? (
                <p className="mt-2 text-xs text-destructive">{testCase.latestResult.errorCode}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
