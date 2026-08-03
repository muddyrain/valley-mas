import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  FileText,
  ImageIcon,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type AgentConfig,
  type AIApp,
  type AIAppArtifact,
  type AIAppOutputImage,
  type AIAppToolBinding,
  type AIAppVersion,
  type AIKnowledgeBase,
  type AISkill,
  createAIAppConversation,
  generateAIAppAvatar,
  getAIApp,
  getAPIErrorMessage,
  listAIAppKnowledgeBases,
  listAIAppOutputs,
  listAIAppToolBindings,
  listAIKnowledgeBases,
  listAISkills,
  publishAIApp,
  replaceAIAppKnowledgeBases,
  replaceAIAppTools,
  saveAIAppVersion,
  uploadAIAppAvatar,
} from '@/api/aiWorkbench';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { KnowledgeBaseBindings } from '@/components/workbench/KnowledgeBaseBindings';
import { cn } from '@/lib/utils';

const DEFAULT_IDENTITY =
  '# IDENTITY.md\n\n你是一位可靠、友善、具备独立判断力的智能伙伴。请保持清晰、自然和有温度的表达。';
const DEFAULT_USER =
  '# USER.md\n\n尚未记录用户档案。请在交流中尊重用户的表达习惯、目标和沟通偏好。';
const DEFAULT_SOUL =
  '# SOUL.md\n\n诚实说明能力边界；保护用户隐私；不伪造事实或执行结果；遇到高风险操作先确认。';
const DEFAULT_AGENTS =
  '# AGENTS.md\n\n优先理解用户真正想完成的目标；需要工具时说明正在做什么；完成后给出可验证的结果。';

export interface EditableAgentConfig extends AgentConfig {
  identity: string;
  userProfile: string;
  soul: string;
  agentInstructions: string;
  skillIds: string[];
}

const defaultConfig: EditableAgentConfig = {
  modelProfile: 'ark-text-default',
  systemPrompt: '',
  openingMessage: '',
  exampleQuestions: [],
  identity: DEFAULT_IDENTITY,
  userProfile: DEFAULT_USER,
  soul: DEFAULT_SOUL,
  agentInstructions: DEFAULT_AGENTS,
  skillIds: [],
};

export function parseAIAppAgentConfig(version?: AIAppVersion): EditableAgentConfig {
  if (!version) return defaultConfig;
  try {
    const value = JSON.parse(version.config) as Partial<AgentConfig>;
    return {
      modelProfile: 'ark-text-default',
      modelId: typeof value.modelId === 'string' ? value.modelId : undefined,
      identity:
        typeof value.identity === 'string' && value.identity.trim()
          ? value.identity
          : typeof value.systemPrompt === 'string' && value.systemPrompt.trim()
            ? value.systemPrompt
            : DEFAULT_IDENTITY,
      userProfile:
        typeof value.userProfile === 'string' && value.userProfile.trim()
          ? value.userProfile
          : DEFAULT_USER,
      soul: typeof value.soul === 'string' && value.soul.trim() ? value.soul : DEFAULT_SOUL,
      agentInstructions:
        typeof value.agentInstructions === 'string' && value.agentInstructions.trim()
          ? value.agentInstructions
          : DEFAULT_AGENTS,
      systemPrompt: '',
      openingMessage: '',
      exampleQuestions: [],
      skillIds: Array.isArray(value.skillIds)
        ? value.skillIds.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [],
      imageGeneration:
        value.imageGeneration && typeof value.imageGeneration.modelId === 'string'
          ? value.imageGeneration
          : undefined,
    };
  } catch {
    return defaultConfig;
  }
}

function formatCount(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function companionDays(createdAt?: string) {
  if (!createdAt) return 1;
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000) + 1);
}

function EditorSkeleton() {
  return (
    <main
      className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] gap-6 p-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:p-10"
      aria-busy="true"
    >
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-4 h-32 rounded-lg" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="space-y-3">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10 sm:col-span-2" />
            <Skeleton className="h-28 sm:col-span-2 rounded-lg" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-36 rounded-lg" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProfileEditor({
  title,
  description,
  icon: Icon,
  value,
  onChange,
}: {
  title: string;
  description: string;
  icon: typeof Bot;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 min-h-44 resize-y font-mono text-sm leading-6"
        aria-label={title}
      />
    </div>
  );
}

export default function AIAppEditor() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [app, setApp] = useState<AIApp | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<EditableAgentConfig>(defaultConfig);
  const [stats, setStats] = useState({ conversationCount: 0, taskCount: 0 });
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [boundTools, setBoundTools] = useState<string[]>([]);
  const [toolBindings, setToolBindings] = useState<AIAppToolBinding[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<AIKnowledgeBase[]>([]);
  const [boundKnowledgeBaseIDs, setBoundKnowledgeBaseIDs] = useState<string[]>([]);
  const [artifacts, setArtifacts] = useState<AIAppArtifact[]>([]);
  const [images, setImages] = useState<AIAppOutputImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarAction, setAvatarAction] = useState<'generate' | 'upload' | null>(null);
  const [avatarModelId, setAvatarModelId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<AIAppOutputImage | null>(null);

  useEffect(() => {
    if (!appId) return;
    let active = true;
    void Promise.all([
      getAIApp(appId),
      listAISkills(),
      listAIAppToolBindings(appId),
      listAIKnowledgeBases(),
      listAIAppKnowledgeBases(appId),
      listAIAppOutputs(appId),
    ])
      .then(([detail, skillResult, toolResult, kbResult, boundKBResult, outputResult]) => {
        if (!active) return;
        if (detail.app.type === 'workflow' && detail.app.workflowId) {
          navigate(`/workbench/edit?id=${detail.app.workflowId}`, { replace: true });
          return;
        }
        const currentVersion =
          detail.versions.find((item) => item.id === detail.app.draftVersionId) ??
          detail.versions[0];
        const parsed = parseAIAppAgentConfig(currentVersion);
        setApp(detail.app);
        setName(detail.app.name);
        setDescription(detail.app.description);
        setDraftName(detail.app.name);
        setDraftDescription(detail.app.description);
        setConfig(parsed);
        setAvatarModelId(parsed.imageGeneration?.modelId || '');
        setStats(detail.stats);
        setSkills(skillResult.list);
        setBoundTools(toolResult.tools);
        setToolBindings(toolResult.bindings);
        setKnowledgeBases(kbResult.list);
        setBoundKnowledgeBaseIDs(boundKBResult.list.map((item) => item.id));
        setArtifacts(outputResult.artifacts);
        setImages(outputResult.images);
      })
      .catch((error) => toast.error(getAPIErrorMessage(error, '加载智能体失败')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [appId, navigate]);

  const selectedSkills = useMemo(
    () => skills.filter((skill) => config.skillIds.includes(skill.id)),
    [config.skillIds, skills],
  );

  const persist = async (
    nextConfig = config,
    nextName = name,
    nextDescription = description,
    showToast = true,
  ) => {
    if (!appId || !nextName.trim()) {
      toast.error('请输入智能体名称');
      return undefined;
    }
    setSaving(true);
    try {
      const result = await saveAIAppVersion(appId, {
        name: nextName.trim(),
        description: nextDescription.trim(),
        config: nextConfig,
      });
      setName(nextName.trim());
      setDescription(nextDescription.trim());
      setConfig(nextConfig);
      setApp((current) =>
        current
          ? {
              ...current,
              name: nextName.trim(),
              description: nextDescription.trim(),
              draftVersionId: result.version.id,
            }
          : current,
      );
      if (showToast) toast.success('智能体设置已保存');
      return result.version.id;
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存智能体设置失败'));
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  const saveEverything = async () => {
    if (boundTools.includes('image.generate') && !config.imageGeneration?.modelId) {
      toast.error('启用图片生成后需要选择图片生成模型');
      return;
    }
    const savedVersionID = await persist();
    if (!savedVersionID || !appId) return;
    try {
      const policies = boundTools.map((toolName) => ({
        toolName,
        approvalMode:
          toolBindings.find((binding) => binding.toolName === toolName)?.approvalMode || 'auto',
      }));
      await replaceAIAppTools(appId, boundTools, policies);
      await replaceAIAppKnowledgeBases(appId, boundKnowledgeBaseIDs);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '部分能力设置保存失败'));
    }
  };

  const publish = async () => {
    if (!appId) return;
    setPublishing(true);
    try {
      const versionID = await persist(config, name, description, false);
      if (!versionID) return;
      await publishAIApp(appId, versionID);
      setApp((current) =>
        current ? { ...current, status: 'published', publishedVersionId: versionID } : current,
      );
      toast.success('智能体已发布');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '发布失败'));
    } finally {
      setPublishing(false);
    }
  };

  const startConversation = async () => {
    if (!appId) return;
    try {
      const result = await createAIAppConversation(appId);
      navigate(`/workbench/apps/${appId}/conversations/${result.conversation.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建会话失败'));
    }
  };

  const generateAvatar = async () => {
    if (!appId || !avatarModelId) {
      toast.error('请选择头像生成模型');
      return;
    }
    setAvatarAction('generate');
    try {
      const result = await generateAIAppAvatar(appId, avatarModelId, {
        name,
        description,
        systemPrompt: config.identity,
      });
      setApp(result.app);
      setAvatarDialogOpen(false);
      toast.success('动漫头像已生成');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '头像生成失败'));
    } finally {
      setAvatarAction(null);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!appId || !file) return;
    setAvatarAction('upload');
    try {
      const result = await uploadAIAppAvatar(appId, file);
      setApp(result.app);
      setAvatarDialogOpen(false);
      toast.success('头像已更新');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '头像上传失败'));
    } finally {
      setAvatarAction(null);
    }
  };

  if (loading) return <EditorSkeleton />;
  if (!app) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-muted/20">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              aria-label="返回上一页"
            >
              <ArrowLeft />
            </Button>
            <div>
              <p className="text-sm font-semibold">智能体详情</p>
              <p className="text-xs text-muted-foreground">个性、能力与产物</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void saveEverything()} disabled={saving}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              {saving ? '保存中' : '保存'}
            </Button>
            <Button onClick={() => void publish()} disabled={publishing || saving}>
              {publishing ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
              {publishing ? '发布中' : '发布'}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 p-4 sm:p-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <Card className="overflow-hidden py-0 lg:sticky lg:top-24">
          <CardContent className="p-6 text-center">
            <div className="group relative mx-auto size-32">
              <AgentAvatar
                name={name}
                src={app.avatarUrl}
                className="size-32 border-4 border-background shadow-sm"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-foreground/65 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  size="icon-sm"
                  variant="secondary"
                  onClick={() => setAvatarDialogOpen(true)}
                  aria-label="AI 生成头像"
                  title="AI 生成头像"
                >
                  <Sparkles />
                </Button>
                <Button
                  size="icon-sm"
                  variant="secondary"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="上传头像"
                  title="上传头像"
                >
                  <Upload />
                </Button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void uploadAvatar(event.target.files?.[0])}
              />
            </div>

            <button
              type="button"
              className="group/name mt-5 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xl font-semibold tracking-tight hover:bg-muted"
              onClick={() => {
                setDraftName(name);
                setDraftDescription(description);
                setIdentityDialogOpen(true);
              }}
            >
              <span className="truncate">{name}</span>
              <Pencil className="size-3.5 opacity-0 transition-opacity group-hover/name:opacity-100" />
            </button>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
              {description || '还没有添加描述'}
            </p>
            <Badge variant={app.status === 'published' ? 'default' : 'secondary'} className="mt-4">
              {app.status === 'published' ? '已发布' : '未发布'}
            </Badge>
            <div className="mt-6 grid grid-cols-3 gap-2 border-y border-border py-5">
              {[
                [companionDays(app.createdAt), '陪伴天数'],
                [formatCount(stats.conversationCount), '对话次数'],
                [formatCount(stats.taskCount), '任务次数'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-lg font-semibold tabular-nums">{value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <Button className="mt-6 w-full" onClick={() => void startConversation()}>
              <MessageCircle />
              开始对话
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden py-0">
          <Tabs defaultValue="profile">
            <div className="overflow-x-auto border-b border-border p-4 sm:px-6">
              <TabsList className="h-11 min-w-max gap-1 rounded-xl bg-muted p-1">
                <TabsTrigger
                  className="min-w-24 rounded-lg px-5 data-active:ring-1 data-active:ring-border"
                  value="profile"
                >
                  个性化
                </TabsTrigger>
                <TabsTrigger
                  className="min-w-24 rounded-lg px-5 data-active:ring-1 data-active:ring-border"
                  value="outputs"
                >
                  产物
                </TabsTrigger>
                <TabsTrigger
                  className="min-w-24 rounded-lg px-5 data-active:ring-1 data-active:ring-border"
                  value="skills"
                >
                  技能
                </TabsTrigger>
                <TabsTrigger
                  className="min-w-24 rounded-lg px-5 data-active:ring-1 data-active:ring-border"
                  value="models"
                >
                  模型
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="profile" className="m-0 p-4 sm:p-6">
              <div className="grid gap-4 xl:grid-cols-2">
                <ProfileEditor
                  title="IDENTITY.md"
                  description="智能伙伴的名字、性格和身份定义"
                  icon={Bot}
                  value={config.identity}
                  onChange={(identity) => setConfig((current) => ({ ...current, identity }))}
                />
                <ProfileEditor
                  title="USER.md"
                  description="用户基本信息和沟通偏好"
                  icon={UserRound}
                  value={config.userProfile}
                  onChange={(userProfile) => setConfig((current) => ({ ...current, userProfile }))}
                />
                <ProfileEditor
                  title="SOUL.md"
                  description="底线规则、安全框架和核心价值观"
                  icon={ShieldCheck}
                  value={config.soul}
                  onChange={(soul) => setConfig((current) => ({ ...current, soul }))}
                />
                <ProfileEditor
                  title="AGENTS.md"
                  description="智能体执行任务时遵循的协作约定"
                  icon={FileText}
                  value={config.agentInstructions}
                  onChange={(agentInstructions) =>
                    setConfig((current) => ({ ...current, agentInstructions }))
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="outputs" className="m-0 p-4 sm:p-6">
              {images.length === 0 && artifacts.length === 0 ? (
                <div className="py-20 text-center">
                  <ImagePlus className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-4 font-medium">还没有产物</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    智能体生成的图片和文件会出现在这里
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {images.length > 0 ? (
                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <ImageIcon className="size-4" />
                        <h3 className="font-medium">图片</h3>
                        <Badge variant="secondary">{images.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {images.map((image) => (
                          <button
                            type="button"
                            key={image.id}
                            onClick={() => setImagePreview(image)}
                            className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            aria-label={`预览图片：${image.prompt || '智能体生成图片'}`}
                          >
                            <img
                              src={image.resultUrl}
                              alt={image.prompt || '智能体生成图片'}
                              className="size-16 shrink-0 rounded-lg border border-border object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {image.prompt || '智能体生成图片'}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {image.resultWidth > 0 && image.resultHeight > 0
                                  ? `${image.resultWidth} × ${image.resultHeight} · `
                                  : ''}
                                {new Intl.DateTimeFormat('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }).format(new Date(image.createdAt))}
                              </span>
                            </span>
                            <ImageIcon className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {artifacts.length > 0 ? (
                    <section>
                      <div className="mb-4 flex items-center gap-2">
                        <FileText className="size-4" />
                        <h3 className="font-medium">文件</h3>
                        <Badge variant="secondary">{artifacts.length}</Badge>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {artifacts.map((artifact) => (
                          <a
                            key={artifact.id}
                            href={artifact.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted/50"
                          >
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <FileText className="size-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{artifact.fileName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatBytes(artifact.sizeBytes)}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              )}
            </TabsContent>

            <TabsContent value="skills" className="m-0 p-4 sm:p-6">
              <div className="space-y-8">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="size-4" />
                    <h3 className="font-medium">已安装技能</h3>
                    <Badge variant="secondary">{selectedSkills.length}</Badge>
                  </div>
                  {skills.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      还没有安装技能
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {skills.map((skill) => {
                        const checked = config.skillIds.includes(skill.id);
                        return (
                          <label
                            key={skill.id}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) =>
                                setConfig((current) => ({
                                  ...current,
                                  skillIds: next
                                    ? [...current.skillIds, skill.id].slice(0, 8)
                                    : current.skillIds.filter((id) => id !== skill.id),
                                }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {skill.name}
                              </span>
                              <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                                {skill.description || '自定义技能'}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <Wrench className="size-4" />
                    <h3 className="font-medium">工具能力</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['content.search', '内容搜索', '搜索私有内容和知识'],
                      ['file.create', '成果文件', '生成 Markdown、JSON、CSV 文件'],
                      ['image.generate', '图片生成', '按需生成或编辑图片'],
                    ].map(([toolName, label, helper]) => (
                      <div
                        key={toolName}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
                      >
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
                        </div>
                        <Switch
                          checked={boundTools.includes(toolName)}
                          onCheckedChange={(checked) =>
                            setBoundTools((current) =>
                              checked
                                ? [...current, toolName]
                                : current.filter((name) => name !== toolName),
                            )
                          }
                          aria-label={label}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-medium">知识库</h3>
                  <p className="mb-4 mt-1 text-sm text-muted-foreground">
                    回答时检索已绑定的私有资料
                  </p>
                  <KnowledgeBaseBindings
                    knowledgeBases={knowledgeBases}
                    boundKnowledgeBaseIDs={boundKnowledgeBaseIDs}
                    onChange={setBoundKnowledgeBaseIDs}
                  />
                </section>
              </div>
            </TabsContent>

            <TabsContent value="models" className="m-0 p-4 sm:p-6">
              <div className="mx-auto max-w-3xl space-y-6">
                <div className="rounded-xl border border-border p-5">
                  <h3 className="font-medium">对话模型</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    处理对话、知识检索和工具调用；带“图片理解”能力时可直接分析附件图片
                  </p>
                  <div className="mt-4">
                    <ModelPicker
                      value={config.modelId}
                      onValueChange={(modelId) => setConfig((current) => ({ ...current, modelId }))}
                      capability="text"
                      label="对话模型"
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    'rounded-xl border border-border p-5',
                    !boundTools.includes('image.generate') && 'opacity-65',
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium">图片生成模型</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        仅在用户明确要求生成或编辑图片时调用
                      </p>
                    </div>
                    <Switch
                      checked={boundTools.includes('image.generate')}
                      onCheckedChange={(checked) =>
                        setBoundTools((current) =>
                          checked
                            ? [...current, 'image.generate']
                            : current.filter((item) => item !== 'image.generate'),
                        )
                      }
                      aria-label="图片生成能力"
                    />
                  </div>
                  {boundTools.includes('image.generate') ? (
                    <div className="mt-4">
                      <ModelPicker
                        value={config.imageGeneration?.modelId}
                        onValueChange={(modelId) =>
                          setConfig((current) => ({
                            ...current,
                            imageGeneration: {
                              modelId,
                              aspectRatio: current.imageGeneration?.aspectRatio || '1:1',
                              quality: current.imageGeneration?.quality || '1K',
                            },
                          }))
                        }
                        capability="image_generation"
                        label="图片生成模型"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <Dialog open={identityDialogOpen} onOpenChange={setIdentityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改智能体信息</DialogTitle>
            <DialogDescription>名称和描述会显示在详情与对话页面。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">名称</Label>
              <Input
                id="agent-name"
                className="mt-2"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="agent-description">描述</Label>
              <Textarea
                id="agent-description"
                className="mt-2 min-h-28"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIdentityDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                void persist(config, draftName, draftDescription).then(
                  (id) => id && setIdentityDialogOpen(false),
                )
              }
              disabled={saving}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI 生成动漫头像</DialogTitle>
            <DialogDescription>
              根据智能体的名称、描述和身份档案生成二次元角色头像。
            </DialogDescription>
          </DialogHeader>
          <ModelPicker
            value={avatarModelId}
            onValueChange={setAvatarModelId}
            capability="image_generation"
            label="头像生成模型"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarAction !== null}
            >
              <Upload />
              上传图片
            </Button>
            <Button
              onClick={() => void generateAvatar()}
              disabled={avatarAction !== null || !avatarModelId}
            >
              {avatarAction === 'generate' ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {avatarAction === 'generate' ? '生成中' : '生成头像'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImagePreviewDialog
        open={Boolean(imagePreview)}
        src={imagePreview?.resultUrl}
        title={imagePreview?.prompt || '智能体生成图片'}
        onOpenChange={(open) => !open && setImagePreview(null)}
      />
    </main>
  );
}
