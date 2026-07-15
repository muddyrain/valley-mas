import {
  Activity,
  Bot,
  Copy,
  History,
  KeyRound,
  Play,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
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
  revokeAIAPIKey,
  saveAIAppVersion,
  streamDebugAIApp,
} from '@/api/aiWorkbench';
import { EditorPageHeader } from '@/components/ai-workbench/EditorPageHeader';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { KnowledgeBaseBindings } from '@/components/workbench/KnowledgeBaseBindings';

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

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('复制失败，请手动复制');
  }
}

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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
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
  const [revokingAPIKeyId, setRevokingAPIKeyId] = useState<string | null>(null);
  const [newAPIKeyName, setNewAPIKeyName] = useState('');
  const [creatingAPIKey, setCreatingAPIKey] = useState(false);
  const [generatedAPIKey, setGeneratedAPIKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AIAPIKey | null>(null);
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

  const revokeAPIKey = async (key: AIAPIKey) => {
    if (key.status !== 'active') {
      return;
    }
    try {
      setRevokingAPIKeyId(key.id);
      await revokeAIAPIKey(key.id);
      setAPIKeys((items) => items.filter((item) => item.id !== key.id));
      setKeyAppBindings((items) => ({ ...items, [key.id]: [] }));
      toast.success('API Key 已撤销');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '撤销 API Key 失败'));
    } finally {
      setRevokingAPIKeyId(null);
      setRevokeTarget(null);
    }
  };

  const publicAPIPath = `/api/v1/public/ai/apps/${appId}/chat`;
  const publicAPICurl = `curl -X POST "YOUR_API_BASE_URL${publicAPIPath}" -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d '{"message":"你好","stream":false}'`;
  const publicAPIJavaScriptJSON = `const response = await fetch("YOUR_API_BASE_URL${publicAPIPath}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ message: "你好", stream: false })
});

const data = await response.json();
console.log(data.reply);`;
  const publicAPIJavaScriptSSE = `const response = await fetch("YOUR_API_BASE_URL${publicAPIPath}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ message: "你好", stream: true })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const records = buffer.split("\\n\\n");
  buffer = records.pop() || "";
  for (const record of records) {
    const line = record.split("\\n").find((item) => item.startsWith("data: "));
    if (!line) continue;
    const event = JSON.parse(line.slice(6));
    if (event.type === "delta") console.log(event.chunk);
    if (event.type === "done") console.log("完成", event);
  }
}`;
  const activeAPIKeys = apiKeys.filter((key) => key.status === 'active');

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
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-16 pt-8 sm:p-8">
      <EditorPageHeader
        title={name || '未命名智能体'}
        description="私有智能体"
        onBack={() => navigate('/workbench')}
        status={
          <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
            {app.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setShowVersionHistory(true)}>
              <History className="mr-2 h-4 w-4" />
              版本
            </Button>
            <Button variant="outline" disabled={saving || publishing} onClick={save}>
              <Save className="mr-2 h-4 w-4" />
              保存版本
            </Button>
            <Button disabled={saving || publishing} onClick={publish}>
              <Send className="mr-2 h-4 w-4" />
              发布
            </Button>
          </>
        }
      />
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border/70 px-6 py-5 sm:px-8">
          <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Bot className="h-5 w-5 text-primary" />
            编排与调试
          </p>
          <p className="mt-1 text-sm text-muted-foreground">配置当前草稿，并在右侧即时验证输出。</p>
        </div>
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
          <div className="min-w-0 p-6 sm:p-8 lg:border-r lg:border-border/70">
            <Tabs defaultValue="compose" className="gap-5">
              <TabsList className="self-start max-w-full overflow-x-auto">
                <TabsTrigger value="compose" className="flex-none px-3">
                  编排
                </TabsTrigger>
                <TabsTrigger value="knowledge" className="flex-none px-3">
                  知识库
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex-none px-3">
                  工具
                </TabsTrigger>
                <TabsTrigger value="publish" className="flex-none px-3">
                  发布
                </TabsTrigger>
              </TabsList>
              <TabsContent value="compose" className="w-full space-y-5">
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
              </TabsContent>
              <TabsContent value="knowledge" className="w-full">
                <EditorSection
                  title="资料库"
                  description="已索引的资料会在调试时作为参考。"
                  className="border-0 bg-transparent p-0"
                >
                  <KnowledgeBaseBindings
                    knowledgeBases={knowledgeBases}
                    boundKnowledgeBaseIDs={boundKnowledgeBaseIDs}
                    disabled={savingKnowledgeBases}
                    onChange={(knowledgeBaseIDs) => {
                      void updateKnowledgeBaseBindings(knowledgeBaseIDs);
                    }}
                  />
                </EditorSection>
              </TabsContent>
              <TabsContent value="tools" className="w-full">
                <EditorSection
                  title="工具"
                  description="仅可调用已授权的工具。"
                  className="border-0 bg-transparent p-0"
                >
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
                </EditorSection>
              </TabsContent>
              <TabsContent value="publish" className="w-full">
                <EditorSection
                  title="公开 API"
                  description="发布后可通过 API Key 调用当前版本。"
                  className="border-0 bg-transparent p-0"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="h-4 w-4 text-primary" />
                      公开 API
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      仅已发布版本可被调用。每个 Key 每日最多 100 次，未勾选不会获得当前应用权限。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                      POST {publicAPIPath}
                    </p>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label="复制接口地址"
                      title="复制接口地址"
                      onClick={() => void copyText(publicAPIPath, '接口地址已复制')}
                    >
                      <Copy />
                    </Button>
                  </div>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => void copyText(publicAPICurl, 'curl 示例已复制')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制 curl 示例
                  </Button>
                  <div className="space-y-2 rounded-xl border border-border/70 bg-background/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground">JavaScript 示例</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copyText(publicAPIJavaScriptJSON, 'JSON fetch 示例已复制')
                        }
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        复制 JSON fetch
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copyText(publicAPIJavaScriptSSE, 'SSE fetch 示例已复制')
                        }
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        复制 SSE fetch
                      </Button>
                    </div>
                  </div>
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
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium">请立即保存此 Key，它不会再次显示。</p>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => void copyText(generatedAPIKey, 'API Key 已复制')}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          复制 Key
                        </Button>
                      </div>
                      <code className="mt-2 block break-all text-xs text-muted-foreground">
                        {generatedAPIKey}
                      </code>
                    </div>
                  )}
                  {activeAPIKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground">还没有 API Key</p>
                  ) : (
                    <div className="space-y-2">
                      {activeAPIKeys.map((key) => {
                        const checked = (keyAppBindings[key.id] || []).includes(appId || '');
                        const usage = keyUsage[key.id];
                        return (
                          <div
                            key={key.id}
                            className="flex items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5"
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
                                {key.keyPrefix}… · 仅显示前缀 ·{' '}
                                {usage ? `今日 ${usage.count}/${usage.limit}` : '加载配额中'}
                              </span>
                            </span>
                            {savingAPIKeyId === key.id && (
                              <span className="text-xs text-muted-foreground">
                                {checked ? '授权中…' : '取消授权中…'}
                              </span>
                            )}
                            <Badge variant="outline">可用</Badge>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              disabled={revokingAPIKeyId === key.id}
                              aria-label={`撤销 ${key.name}`}
                              title="撤销 Key"
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </EditorSection>
              </TabsContent>
            </Tabs>
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
      </section>
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl gap-4 overflow-hidden">
          <DialogHeader className="pr-10">
            <DialogTitle>版本历史</DialogTitle>
            <DialogDescription>可随时恢复历史配置，恢复后会创建新的草稿。</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[min(720px,calc(100vh-12rem))]">
            <div className="space-y-3 pr-4">
              {versions.map((version) => {
                const isDraft = version.id === app.draftVersionId;
                const isPublished = version.id === app.publishedVersionId;
                return (
                  <article
                    key={version.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">v{version.number}</p>
                        {isDraft ? <Badge variant="outline">当前草稿</Badge> : null}
                        {isPublished ? <Badge variant="secondary">已发布</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        创建于 {new Date(version.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isDraft ? 'outline' : 'secondary'}
                      disabled={isDraft || restoringVersionId !== null}
                      onClick={() => restoreVersion(version)}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      {restoringVersionId === version.id ? '恢复中…' : '恢复为草稿'}
                    </Button>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open && revokingAPIKeyId === null) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销 API Key？</AlertDialogTitle>
            <AlertDialogDescription>
              「{revokeTarget?.name}」撤销后将无法继续调用公开 API，历史调用记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingAPIKeyId !== null}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokingAPIKeyId !== null}
              onClick={() => {
                if (revokeTarget) void revokeAPIKey(revokeTarget);
              }}
            >
              {revokingAPIKeyId !== null ? '撤销中…' : '确认撤销'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
