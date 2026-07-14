import { Activity, ArrowLeft, Bot, KeyRound, Play, RotateCcw, Save, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AIAPIKey,
  type AIAPIKeyDailyUsage,
  type AIApp,
  type AIAppPublicInvocation,
  type AIAppRun,
  type AIAppTool,
  type AIAppVersion,
  type AIKnowledgeBase,
  type AIKnowledgeReference,
  createAIAPIKey,
  getAIAPIKeyDailyUsage,
  getAIApp,
  getAPIErrorMessage,
  listAIAPIKeyAppBindings,
  listAIAPIKeys,
  listAIAppKnowledgeBases,
  listAIAppPublicInvocations,
  listAIAppRuns,
  listAIAppToolBindings,
  listAIAppTools,
  listAIKnowledgeBases,
  publishAIApp,
  replaceAIAPIKeyAppBindings,
  replaceAIAppKnowledgeBases,
  replaceAIAppTools,
  restoreAIAppVersion,
  saveAIAppVersion,
  streamDebugAIApp,
} from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

interface AgentConfig {
  modelProfile: 'ark-text-default';
  systemPrompt: string;
  openingMessage: string;
  exampleQuestions: string[];
}

const defaultConfig: AgentConfig = {
  modelProfile: 'ark-text-default',
  systemPrompt: '',
  openingMessage: '',
  exampleQuestions: [],
};

function parseAgentConfig(version?: AIAppVersion): AgentConfig {
  if (!version) return defaultConfig;
  try {
    const value = JSON.parse(version.config) as Partial<AgentConfig>;
    return {
      modelProfile: 'ark-text-default',
      systemPrompt: typeof value.systemPrompt === 'string' ? value.systemPrompt : '',
      openingMessage: typeof value.openingMessage === 'string' ? value.openingMessage : '',
      exampleQuestions: Array.isArray(value.exampleQuestions)
        ? value.exampleQuestions.filter((item): item is string => typeof item === 'string')
        : [],
    };
  } catch {
    return defaultConfig;
  }
}

export default function AIAppEditor() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<AIApp | null>(null);
  const [versions, setVersions] = useState<AIAppVersion[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [debugMessage, setDebugMessage] = useState('');
  const [debugReply, setDebugReply] = useState('');
  const [debugToolStatus, setDebugToolStatus] = useState<string | null>(null);
  const [debugReferences, setDebugReferences] = useState<AIKnowledgeReference[]>([]);
  const [debugging, setDebugging] = useState(false);
  const [runs, setRuns] = useState<AIAppRun[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<AIKnowledgeBase[]>([]);
  const [boundKnowledgeBaseIDs, setBoundKnowledgeBaseIDs] = useState<string[]>([]);
  const [savingKnowledgeBases, setSavingKnowledgeBases] = useState(false);
  const [tools, setTools] = useState<AIAppTool[]>([]);
  const [boundTools, setBoundTools] = useState<string[]>([]);
  const [savingTools, setSavingTools] = useState(false);
  const [apiKeys, setAPIKeys] = useState<AIAPIKey[]>([]);
  const [keyAppBindings, setKeyAppBindings] = useState<Record<string, string[]>>({});
  const [keyUsage, setKeyUsage] = useState<Record<string, AIAPIKeyDailyUsage>>({});
  const [savingAPIKeyId, setSavingAPIKeyId] = useState<string | null>(null);
  const [newAPIKeyName, setNewAPIKeyName] = useState('');
  const [creatingAPIKey, setCreatingAPIKey] = useState(false);
  const [generatedAPIKey, setGeneratedAPIKey] = useState<string | null>(null);
  const [publicInvocations, setPublicInvocations] = useState<AIAppPublicInvocation[]>([]);
  const abortDebugRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!appId) return;
    getAIApp(appId)
      .then((detail) => {
        if (detail.app.type === 'workflow' && detail.app.workflowId) {
          navigate(`/workbench/edit?id=${detail.app.workflowId}`, { replace: true });
          return null;
        }
        setApp(detail.app);
        setVersions(detail.versions);
        setName(detail.app.name);
        setDescription(detail.app.description);
        setConfig(parseAgentConfig(detail.versions[0]));
        return Promise.all([
          listAIAppRuns(appId),
          listAIKnowledgeBases(),
          listAIAppKnowledgeBases(appId),
          listAIAppTools(),
          listAIAppToolBindings(appId),
          listAIAPIKeys(),
          listAIAppPublicInvocations(appId),
        ]);
      })
      .then((data) => {
        if (!data) return;
        const [
          runResult,
          knowledgeBaseResult,
          bindingResult,
          toolResult,
          toolBindingResult,
          keyResult,
          invocationResult,
        ] = data;
        setRuns(runResult.list);
        setKnowledgeBases(knowledgeBaseResult.list);
        setBoundKnowledgeBaseIDs(bindingResult.list.map((base) => base.id));
        setTools(toolResult.list);
        setBoundTools(toolBindingResult.tools);
        setAPIKeys(keyResult.list);
        setPublicInvocations(invocationResult.list);
        void Promise.all(
          keyResult.list.map(async (key) => {
            const [binding, usage] = await Promise.all([
              listAIAPIKeyAppBindings(key.id),
              getAIAPIKeyDailyUsage(key.id),
            ]);
            return { keyId: key.id, appIds: binding.list.map((item) => item.appId), usage };
          }),
        )
          .then((items) => {
            setKeyAppBindings(Object.fromEntries(items.map((item) => [item.keyId, item.appIds])));
            setKeyUsage(Object.fromEntries(items.map((item) => [item.keyId, item.usage])));
          })
          .catch((error) => toast.error(getAPIErrorMessage(error, '加载 API Key 权限失败')));
      })
      .catch((error) => toast.error(getAPIErrorMessage(error, '加载 AI 应用失败')))
      .finally(() => setLoading(false));
  }, [appId, navigate]);

  const save = async () => {
    if (!appId || !name.trim()) {
      toast.error('请输入应用名称');
      return;
    }
    try {
      setSaving(true);
      const { version } = await saveAIAppVersion(appId, {
        name: name.trim(),
        description: description.trim(),
        config,
      });
      setVersions((items) => [version, ...items]);
      setApp((current) =>
        current ? { ...current, name: name.trim(), description: description.trim() } : current,
      );
      toast.success(`已保存版本 v${version.number}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存版本失败'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!appId) return;
    try {
      setPublishing(true);
      const versionId = versions[0]?.id;
      await publishAIApp(appId, versionId);
      setApp((current) =>
        current
          ? { ...current, status: 'published', publishedVersionId: versionId || '' }
          : current,
      );
      toast.success('已发布当前版本');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '发布失败，请先保存有效版本'));
    } finally {
      setPublishing(false);
    }
  };

  const ensureDraftVersion = async (): Promise<string> => {
    if (!appId) throw new Error('应用不存在');
    if (app?.draftVersionId && app.draftVersionId !== '0') return app.draftVersionId;
    const { version } = await saveAIAppVersion(appId, {
      name: name.trim() || '未命名智能体',
      description: description.trim(),
      config,
    });
    setVersions((items) => [version, ...items]);
    setApp((current) => (current ? { ...current, draftVersionId: version.id } : current));
    return version.id;
  };

  const restoreVersion = async (source: AIAppVersion) => {
    if (!appId || source.id === app?.draftVersionId) return;
    try {
      setRestoringVersionId(source.id);
      const { version } = await restoreAIAppVersion(appId, source.id);
      setVersions((items) => [version, ...items]);
      setConfig(parseAgentConfig(version));
      setApp((current) => (current ? { ...current, draftVersionId: version.id } : current));
      toast.success(`已将 v${source.number} 恢复为新草稿 v${version.number}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '恢复历史版本失败'));
    } finally {
      setRestoringVersionId(null);
    }
  };

  const updateKnowledgeBaseBindings = async (knowledgeBaseIDs: string[]) => {
    if (!appId) return;
    try {
      setSavingKnowledgeBases(true);
      const result = await replaceAIAppKnowledgeBases(appId, knowledgeBaseIDs);
      setBoundKnowledgeBaseIDs(result.knowledgeBaseIds);
      toast.success('资料库已更新');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '更新资料库失败'));
    } finally {
      setSavingKnowledgeBases(false);
    }
  };

  const updateToolBindings = async (nextTools: string[]) => {
    if (!appId) return;
    try {
      setSavingTools(true);
      const result = await replaceAIAppTools(appId, nextTools);
      setBoundTools(result.tools);
      toast.success('工具已更新');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '更新工具失败'));
    } finally {
      setSavingTools(false);
    }
  };

  const updateAPIKeyAppBinding = async (key: AIAPIKey, checked: boolean) => {
    if (!appId) return;
    const current = keyAppBindings[key.id] || [];
    const next = checked ? [...current, appId] : current.filter((id) => id !== appId);
    try {
      setSavingAPIKeyId(key.id);
      const result = await replaceAIAPIKeyAppBindings(key.id, next);
      setKeyAppBindings((items) => ({ ...items, [key.id]: result.appIds }));
      toast.success(checked ? '已授权此 Key 调用当前应用' : '已取消此 Key 的应用权限');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '更新 API Key 应用权限失败'));
    } finally {
      setSavingAPIKeyId(null);
    }
  };

  const createAPIKey = async () => {
    if (!newAPIKeyName.trim()) {
      toast.error('请输入 Key 名称');
      return;
    }
    try {
      setCreatingAPIKey(true);
      const result = await createAIAPIKey({ name: newAPIKeyName.trim() });
      setAPIKeys((items) => [result.key, ...items]);
      setKeyAppBindings((items) => ({ ...items, [result.key.id]: [] }));
      setKeyUsage((items) => ({
        ...items,
        [result.key.id]: { limit: 100, count: 0, remaining: 100 },
      }));
      setGeneratedAPIKey(result.secret);
      setNewAPIKeyName('');
      toast.success('API Key 已创建');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建 API Key 失败'));
    } finally {
      setCreatingAPIKey(false);
    }
  };

  const debug = async () => {
    if (!appId || !debugMessage.trim()) {
      toast.error('请输入调试消息');
      return;
    }
    try {
      setDebugging(true);
      setDebugReply('');
      setDebugToolStatus(null);
      setDebugReferences([]);
      await ensureDraftVersion();
      const controller = new AbortController();
      abortDebugRef.current = controller;
      await streamDebugAIApp(
        appId,
        debugMessage.trim(),
        {
          onDelta: (chunk) => setDebugReply((reply) => reply + chunk),
          onToolCall: (toolName) => {
            setDebugToolStatus(toolName === 'content.search' ? '正在搜索内容' : '正在调用工具');
          },
          onToolResult: (toolName, ok) => {
            if (toolName === 'content.search') {
              setDebugToolStatus(ok ? '内容搜索完成' : '内容搜索失败');
            }
          },
          onDone: (run, reply, references) => {
            setDebugReply(reply);
            setDebugReferences(references);
            setRuns((items) => [run, ...items]);
          },
          onError: (message, run) => {
            if (run) setRuns((items) => [run, ...items]);
            toast.error(message);
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(getAPIErrorMessage(error, '调试运行失败'));
    } finally {
      abortDebugRef.current = null;
      setDebugging(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (!app) return null;
  if (app.type !== 'agent') {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-8">
        <p className="text-sm text-muted-foreground">
          该工作流尚未完成关联，请返回工作台后重新打开。
        </p>
        <Button variant="outline" onClick={() => navigate('/workbench')}>
          返回工作台
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-16 pt-8 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/workbench')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回工作台
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
            {app.status === 'published' ? '已发布' : '草稿'}
          </Badge>
          <Button variant="outline" disabled={saving || publishing} onClick={save}>
            <Save className="mr-2 h-4 w-4" />
            保存版本
          </Button>
          <Button disabled={saving || publishing} onClick={publish}>
            <Send className="mr-2 h-4 w-4" />
            发布
          </Button>
        </div>
      </div>
      <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/80 shadow-sm">
        <div className="border-b border-border/70 px-6 py-5 sm:px-8">
          <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Bot className="h-5 w-5 text-primary" />
            {name || '未命名智能体'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">私有智能体</p>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
          <div className="space-y-5 p-6 sm:p-8 lg:border-r lg:border-border/70">
            <div className="space-y-2">
              <label htmlFor="app-name" className="text-sm font-medium">
                名称
              </label>
              <Input
                id="app-name"
                value={name}
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="app-description" className="text-sm font-medium">
                简介
              </label>
              <Input
                id="app-description"
                value={description}
                maxLength={500}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="system-prompt" className="text-sm font-medium">
                系统提示词
              </label>
              <Textarea
                id="system-prompt"
                value={config.systemPrompt}
                placeholder="说明智能体的角色、边界和输出要求"
                onChange={(event) =>
                  setConfig((value) => ({ ...value, systemPrompt: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="opening-message" className="text-sm font-medium">
                开场白
              </label>
              <Textarea
                id="opening-message"
                value={config.openingMessage}
                placeholder="首次对话时显示的欢迎语"
                onChange={(event) =>
                  setConfig((value) => ({ ...value, openingMessage: event.target.value }))
                }
              />
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/35 p-4">
              <div>
                <p className="text-sm font-medium">资料库</p>
                <p className="mt-1 text-xs text-muted-foreground">已索引的资料会在调试时作为参考</p>
              </div>
              {knowledgeBases.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有可绑定的资料库</p>
              ) : (
                <div className="space-y-2">
                  {knowledgeBases.map((knowledgeBase) => {
                    const checked = boundKnowledgeBaseIDs.includes(knowledgeBase.id);
                    return (
                      <label
                        key={knowledgeBase.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={savingKnowledgeBases}
                          onCheckedChange={(nextChecked) => {
                            const next = nextChecked
                              ? [...boundKnowledgeBaseIDs, knowledgeBase.id]
                              : boundKnowledgeBaseIDs.filter((id) => id !== knowledgeBase.id);
                            void updateKnowledgeBaseBindings(next);
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {knowledgeBase.name}
                          </span>
                          {knowledgeBase.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {knowledgeBase.description}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/35 p-4">
              <div>
                <p className="text-sm font-medium">工具</p>
                <p className="mt-1 text-xs text-muted-foreground">允许智能体在调试中调用</p>
              </div>
              {tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无可用工具</p>
              ) : (
                <div className="space-y-2">
                  {tools.map((tool) => {
                    const checked = boundTools.includes(tool.name);
                    return (
                      <label
                        key={tool.name}
                        className="flex cursor-pointer items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={savingTools || tool.permission !== 'read'}
                          onCheckedChange={(nextChecked) => {
                            const next = nextChecked
                              ? [...boundTools, tool.name]
                              : boundTools.filter((name) => name !== tool.name);
                            void updateToolBindings(next);
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {tool.name === 'content.search' ? '内容搜索' : tool.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {tool.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-2xl bg-muted/35 p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-primary" />
                  公开 API
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  仅已发布版本可被调用。每个 Key 每日最多 100 次，未勾选不会获得当前应用权限。
                </p>
              </div>
              <p className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 font-mono text-xs text-muted-foreground">
                POST /api/v1/public/ai/apps/{appId}/chat
              </p>
              <div className="flex gap-2">
                <Input
                  value={newAPIKeyName}
                  placeholder="新 Key 名称"
                  maxLength={100}
                  onChange={(event) => setNewAPIKeyName(event.target.value)}
                />
                <Button variant="outline" disabled={creatingAPIKey} onClick={createAPIKey}>
                  {creatingAPIKey ? '创建中…' : '创建 Key'}
                </Button>
              </div>
              {generatedAPIKey && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium">请立即保存此 Key，它不会再次显示。</p>
                  <code className="mt-2 block break-all text-xs text-muted-foreground">
                    {generatedAPIKey}
                  </code>
                </div>
              )}
              {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有 API Key</p>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((key) => {
                    const checked = (keyAppBindings[key.id] || []).includes(appId || '');
                    const usage = keyUsage[key.id];
                    return (
                      <label
                        key={key.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={key.status !== 'active' || savingAPIKeyId === key.id}
                          onCheckedChange={(nextChecked) =>
                            void updateAPIKeyAppBinding(key, nextChecked === true)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{key.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {key.keyPrefix}… ·{' '}
                            {usage ? `今日 ${usage.count}/${usage.limit}` : '加载配额中'}
                          </span>
                        </span>
                        <Badge variant={key.status === 'active' ? 'outline' : 'secondary'}>
                          {key.status === 'active' ? '可用' : '已撤销'}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <aside className="space-y-5 bg-muted/25 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold">在线调试</p>
              <p className="mt-1 text-xs text-muted-foreground">使用当前草稿版本运行</p>
            </div>
            <Textarea
              value={debugMessage}
              placeholder="输入一条消息，使用当前草稿版本测试"
              onChange={(event) => setDebugMessage(event.target.value)}
            />
            <Button disabled={debugging} onClick={debug}>
              <Play className="mr-2 h-4 w-4" />
              {debugging ? '正在运行…' : '运行调试'}
            </Button>
            {debugging && (
              <Button variant="ghost" onClick={() => abortDebugRef.current?.abort()}>
                停止
              </Button>
            )}
            {debugToolStatus && (
              <div
                className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground"
                role="status"
              >
                {debugToolStatus}
              </div>
            )}
            {debugReply && (
              <>
                <div className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
                  {debugReply}
                </div>
                {debugReferences.length > 0 && (
                  <div className="rounded-2xl bg-background/60 p-4">
                    <p className="text-xs font-medium text-muted-foreground">参考资料</p>
                    <div className="mt-2 space-y-2">
                      {debugReferences.map((reference) => (
                        <div key={reference.chunkId} className="text-xs">
                          <p className="font-medium">{reference.documentName}</p>
                          <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                            {reference.excerpt}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="border-t border-border/70 pt-5">
              <p className="text-sm font-semibold">最近运行</p>
              <div className="mt-3 space-y-3">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无运行记录</p>
                ) : (
                  runs.slice(0, 3).map((run) => (
                    <div
                      key={run.id}
                      className="rounded-2xl border border-border/70 bg-background/60 p-3 text-sm"
                    >
                      <div className="flex justify-between">
                        <span>
                          {run.status === 'succeeded'
                            ? '成功'
                            : run.status === 'cancelled'
                              ? '已停止'
                              : '失败'}
                        </span>
                        <span className="text-muted-foreground">{run.durationMs} ms</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        v{versions.find((version) => version.id === run.versionId)?.number ?? '—'} ·{' '}
                        {run.model || '模型信息不可用'}
                      </p>
                      <p className="mt-2 line-clamp-2 text-muted-foreground">
                        {run.output || run.errorCode || run.input}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="border-t border-border/70 pt-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />
                公开调用记录
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                仅记录状态、耗时和配额次数，不保存外部消息或回复。
              </p>
              <div className="mt-3 space-y-2">
                {publicInvocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无公开调用记录</p>
                ) : (
                  publicInvocations.slice(0, 5).map((invocation) => (
                    <div
                      key={invocation.id}
                      className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {invocation.status === 'succeeded'
                            ? '成功'
                            : invocation.status === 'rejected'
                              ? '已拒绝'
                              : '失败'}
                        </span>
                        <span className="text-muted-foreground">{invocation.durationMs} ms</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        第 {invocation.dailyCallNumber} 次 · {invocation.stream ? '流式' : 'JSON'}
                        {invocation.errorCode ? ` · ${invocation.errorCode}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
        <div className="border-t border-border/70 px-6 py-5 sm:px-8">
          <p className="mb-3 text-sm font-semibold">版本历史</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between rounded-xl bg-muted/45 px-3 py-2 text-sm"
              >
                <div>
                  <span>v{version.number}</span>
                  {version.id === app.draftVersionId && (
                    <Badge className="ml-2" variant="outline">
                      当前草稿
                    </Badge>
                  )}
                  {version.id === app.publishedVersionId && (
                    <Badge className="ml-2" variant="secondary">
                      已发布
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {new Date(version.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={version.id === app.draftVersionId || restoringVersionId !== null}
                    onClick={() => restoreVersion(version)}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    恢复
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
