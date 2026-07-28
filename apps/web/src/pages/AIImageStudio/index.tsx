import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import {
  Check,
  CirclePause,
  Download,
  Eye,
  FileText,
  GitBranch,
  Heart,
  History,
  ImageIcon,
  Info,
  LibraryBig,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import {
  type AIImageConversation,
  type AIImageConversationMessage,
  type AIImageGeneration,
  type AIImageRecipe,
  type AIImageStyleProfile,
  addAIImageConversationMessage,
  clearAIImageConversation,
  createAIImageConversation,
  createAIImageGeneration,
  deleteAIImageGeneration,
  generateAIImageRecipeSamples,
  getAIImageConversation,
  getAIImageGeneration,
  getCurrentAIImageConversation,
  listAIImageConversations,
  listAIImageCreationOptions,
  listAIImageGenerations,
  pauseAIImageGeneration,
  saveAIImageGenerationResource,
  updateAIImageGenerationFavorite,
} from '@/api/aiImages';
import { type AIPrompt, getAPIErrorMessage, listAIPrompts } from '@/api/aiWorkbench';
import { ConversationMessageBubble } from '@/components/ai/ConversationMessageBubble';
import { ModelPicker } from '@/components/ai/ModelPicker';
import {
  SaveResourceDialog,
  type SaveResourceProgress,
  type SaveResourceVisibility,
} from '@/components/ai/SaveResourceDialog';
import { AIImageGenerationImage } from '@/components/ai-images/AIImageGenerationImage';
import { GenerationOverlay, GenerationPreview } from '@/components/ai-images/GenerationOverlay';
import { SketchCanvas, type SketchCanvasHandle } from '@/components/ai-images/SketchCanvas';
import { StyleRecognitionDialog } from '@/components/ai-images/StyleRecognitionDialog';
import { PromptAssistantDialog } from '@/components/ai-workbench/PromptAssistantDialog';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

gsap.registerPlugin(Flip);

const DEFAULT_ASPECTS = ['1:1', '4:3', '3:4', '16:9', '9:16'];
const DEFAULT_QUALITIES = ['1K', '2K'];
const SELECTED_OPTION_CLASS =
  'border-primary/40 bg-secondary text-foreground shadow-sm hover:bg-secondary/80';

type ImageStudioMode = 'canvas' | 'conversation';
type ConversationReferenceMode = 'latest' | 'locked' | 'none';
type HistoryStatusFilter = 'all' | 'succeeded' | 'active' | 'failed';

const HISTORY_STATUS_LABELS: Record<HistoryStatusFilter, string> = {
  all: '全部状态',
  succeeded: '已完成',
  active: '生成中',
  failed: '生成失败',
};

const LEGACY_CONVERSATION_STORAGE_PREFIX = 'valley-ai-image-conversation-v1';
const IMAGE_MODEL_PREFERENCE_KEY = 'valley.ai-image-studio.image-model';
const MAX_CONVERSATION_MESSAGES = 100;
const MAX_IMAGE_PROMPT_LENGTH = 48_000;
const MAX_CONVERSATION_INPUT_LENGTH = 20_000;

function readAIImageModelPreference() {
  try {
    return window.localStorage.getItem(IMAGE_MODEL_PREFERENCE_KEY) || '';
  } catch {
    return '';
  }
}

function saveAIImageModelPreference(modelID: string) {
  try {
    window.localStorage.setItem(IMAGE_MODEL_PREFERENCE_KEY, modelID);
  } catch {
    // Browser storage can be unavailable; the model still stays selected for this session.
  }
}

const parseStudioMode = (value: string | null): ImageStudioMode =>
  value === 'canvas' ? 'canvas' : 'conversation';

const parseHistoryStatusFilter = (value: string | null): HistoryStatusFilter =>
  value === 'all' || value === 'succeeded' || value === 'active' || value === 'failed'
    ? value
    : 'succeeded';

const getHistoryModelFilterValue = (provider: string, model: string) =>
  JSON.stringify([provider.trim(), model.trim()]);

type ImageConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  generationId?: string;
};

const toImageConversationMessages = (
  messages: AIImageConversationMessage[],
): ImageConversationMessage[] =>
  messages
    .filter((message) => !isObsoleteCanvasSnapshotError(message))
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      generationId: message.generationId,
    }));

const legacyConversationStorageKey = (userID?: string) =>
  `${LEGACY_CONVERSATION_STORAGE_PREFIX}:${userID || 'anonymous'}`;

const readLegacyConversationMessages = (key: string): ImageConversationMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is ImageConversationMessage =>
        Boolean(
          item &&
            typeof item === 'object' &&
            'id' in item &&
            typeof item.id === 'string' &&
            'role' in item &&
            (item.role === 'user' || item.role === 'assistant') &&
            'content' in item &&
            typeof item.content === 'string',
        ),
      )
      .slice(-MAX_CONVERSATION_MESSAGES);
  } catch {
    return [];
  }
};

const isObsoleteCanvasSnapshotError = (
  message: Pick<ImageConversationMessage, 'role' | 'content'>,
) => message.role === 'assistant' && message.content === '画布快照保存失败，请稍后重试';

const STATUS_LABELS: Record<AIImageGeneration['status'], string> = {
  queued: '等待生成',
  running: '生成中',
  paused: '已暂停',
  succeeded: '已完成',
  failed: '生成失败',
};
const HISTORY_PAGE_SIZE = 12;
const DEFAULT_HISTORY_PAGE = 1;
const HISTORY_CARD_SKELETON_COUNT = 8;

type GenerationRecovery = {
  title: string;
  description: string;
};

const getGenerationRecovery = (
  generation: Pick<AIImageGeneration, 'errorCode'>,
): GenerationRecovery => {
  switch (generation.errorCode) {
    case 'IMAGE_DIMENSION_MISMATCH':
      return {
        title: '旧任务未保存图片',
        description:
          '该任务曾因旧版尺寸校验失败，图片没有进入历史。恢复参数后可重新提交；新的有效结果会按实际像素保存。',
      };
    case 'IMAGE_DIMENSIONS_TOO_SMALL':
      return {
        title: '图片尺寸过小',
        description:
          '服务商返回的图片低于最低可用尺寸，系统没有保存。恢复参数后可重新提交，或切换图片模型。',
      };
    case 'IMAGE_DOWNLOAD_FAILED':
      return {
        title: '结果读取失败',
        description:
          '上游可能已完成生成，但结果未能读取。请稍后恢复参数并主动重新提交；系统不会自动再次调用模型。',
      };
    case 'IMAGE_STORAGE_FAILED':
      return {
        title: '结果转存失败',
        description:
          '上游可能已完成生成，但结果未能写入创作历史。请先检查存储服务，再恢复参数并主动重新提交。',
      };
    case 'IMAGE_GENERATION_FAILED':
      return {
        title: '模型未完成交付',
        description:
          '模型服务未返回可交付图片。服务商是否计费以其账单为准；系统不会自动重试，避免重复消耗。',
      };
    default:
      return {
        title: '本次生成未完成',
        description: '恢复原参数后，请确认设置并主动重新提交；系统不会自动重试。',
      };
  }
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatByteSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未记录';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
};

function StudioWorkspaceSkeleton() {
  return (
    <div
      className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]"
      role="status"
      aria-live="polite"
      aria-label="正在加载图片工作台"
    >
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-10 w-52" />
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <Skeleton className="aspect-[4/3] max-h-[38rem] w-full" />
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryCardSkeleton() {
  return (
    <Card size="sm" className="flex min-h-0 flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border/70 bg-muted/20">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-1 rounded-lg border border-border p-2">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-3.5 w-20 max-w-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

const readImageAsDataURL = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`画布快照读取失败（${response.status}）`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject());
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export default function AIImageStudio() {
  const sketchCanvasRef = useRef<SketchCanvasHandle | null>(null);
  const conversationScrollRootRef = useRef<HTMLDivElement | null>(null);
  const conversationScrollBehaviorRef = useRef<ScrollBehavior>('smooth');
  const creatingRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserID = useAuthStore((state) => state.user?.id);
  const legacyConversationKey = legacyConversationStorageKey(currentUserID);
  const [presets, setPresets] = useState<AIImageRecipe[]>([]);
  const [generatedPresetSamples, setGeneratedPresetSamples] = useState<Record<string, string[]>>(
    {},
  );
  const [shownPresetSamples, setShownPresetSamples] = useState<Record<string, string[]>>({});
  const [refreshingPresetSamples, setRefreshingPresetSamples] = useState(false);
  const [promptResources, setPromptResources] = useState<AIPrompt[]>([]);
  const [promptResourcesLoading, setPromptResourcesLoading] = useState(true);
  const [promptResourcePickerOpen, setPromptResourcePickerOpen] = useState(false);
  const [promptResourceQuery, setPromptResourceQuery] = useState('');
  const [pendingPromptResource, setPendingPromptResource] = useState<AIPrompt | null>(null);
  const [styleProfiles, setStyleProfiles] = useState<AIImageStyleProfile[]>([]);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [styleRecognitionOpen, setStyleRecognitionOpen] = useState(false);
  const [styleQuery, setStyleQuery] = useState('');
  const [selectedStyleProfile, setSelectedStyleProfile] = useState<AIImageStyleProfile | null>(
    null,
  );
  const [aspectRatios, setAspectRatios] = useState(DEFAULT_ASPECTS);
  const [sizes, setSizes] = useState<Record<string, Record<string, string>>>({});
  const [presetID, setPresetID] = useState('free');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('1K');
  const [modelID, setModelID] = useState(readAIImageModelPreference);
  const [selectedModel, setSelectedModel] = useState<AvailableAIModel>();
  const imageModelFallbackNotifiedRef = useRef(false);
  const [hasCanvasContent, setHasCanvasContent] = useState(false);
  const [useCanvasReference, setUseCanvasReference] = useState(true);
  const [history, setHistory] = useState<AIImageGeneration[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<AIImageGeneration | null>(null);
  const [pausingGenerationID, setPausingGenerationID] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [conversationInput, setConversationInput] = useState('');
  const [conversationID, setConversationID] = useState<string>();
  const [conversations, setConversations] = useState<AIImageConversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ImageConversationMessage[]>([]);
  const [conversationReferenceMode, setConversationReferenceMode] =
    useState<ConversationReferenceMode>('latest');
  const [lockedConversationReferenceID, setLockedConversationReferenceID] = useState<string>();
  const [conversationSending, setConversationSending] = useState(false);
  const [conversationStarting, setConversationStarting] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationHistoryOpen, setConversationHistoryOpen] = useState(false);
  const [conversationScrollVersion, setConversationScrollVersion] = useState(0);
  const [savingID, setSavingID] = useState<string>();
  const [saveProgress, setSaveProgress] = useState<SaveResourceProgress>();
  const [saveModelName, setSaveModelName] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [saveTarget, setSaveTarget] = useState<AIImageGeneration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIImageGeneration | null>(null);
  const [deletingID, setDeletingID] = useState<string>();
  const [promptAssistantOpen, setPromptAssistantOpen] = useState(false);
  const [canvasRestore, setCanvasRestore] = useState<{ id: string; dataURL: string }>();
  const [historyPreview, setHistoryPreview] = useState<{ src: string; title: string }>();
  const [historyDetailTarget, setHistoryDetailTarget] = useState<AIImageGeneration | null>(null);
  const [favoriteUpdatingID, setFavoriteUpdatingID] = useState<string>();
  const [variantSource, setVariantSource] = useState<AIImageGeneration | null>(null);
  const [variantInstruction, setVariantInstruction] = useState('');

  const handleImageModelChange = useCallback((nextModelID: string) => {
    setModelID(nextModelID);
    saveAIImageModelPreference(nextModelID);
  }, []);

  const handleUnavailableImageModel = useCallback(() => {
    if (imageModelFallbackNotifiedRef.current) return;
    imageModelFallbackNotifiedRef.current = true;
    toast.info('已切换到可用模型', { description: '上次选择的图片模型已不可用。' });
  }, []);

  const scheduleConversationScroll = useCallback((behavior: ScrollBehavior = 'smooth') => {
    conversationScrollBehaviorRef.current = behavior;
    setConversationScrollVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (conversationScrollVersion === 0) return;
    const frameID = window.requestAnimationFrame(() => {
      const viewport = conversationScrollRootRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );
      viewport?.scrollTo({
        top: viewport.scrollHeight,
        behavior: conversationScrollBehaviorRef.current,
      });
    });
    return () => window.cancelAnimationFrame(frameID);
  }, [conversationScrollVersion]);

  const applyHistory = useCallback((generations: AIImageGeneration[]) => {
    setHistory(generations);
    setActiveGeneration(
      (current) =>
        current ??
        generations.find((item) => item.status === 'queued' || item.status === 'running') ??
        null,
    );
  }, []);

  const loadHistory = useCallback(async () => {
    const result = await listAIImageGenerations(50);
    applyHistory(result.list);
  }, [applyHistory]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      listAIImageCreationOptions(),
      listAIImageGenerations(50),
      getCurrentAIImageConversation(),
      listAIImageConversations(),
    ])
      .then(async ([catalog, generations, conversation, conversationHistory]) => {
        if (!active) return;
        setPresets(catalog.recipes);
        setStyleProfiles(catalog.styleProfiles);
        setAspectRatios(catalog.aspectRatios);
        setSizes(catalog.sizes ?? {});
        applyHistory(generations.list);
        setConversations(conversationHistory.list);
        if (conversation.conversation) {
          setConversationID(conversation.conversation.id);
          setConversationMessages(toImageConversationMessages(conversation.messages));
          scheduleConversationScroll('auto');
        } else if (currentUserID) {
          const legacyMessages = readLegacyConversationMessages(legacyConversationKey).filter(
            (message) => !isObsoleteCanvasSnapshotError(message),
          );
          if (legacyMessages.length > 0) {
            try {
              const created = await createAIImageConversation({
                title: legacyMessages[0].content.slice(0, 160),
              });
              const migratedMessages: ImageConversationMessage[] = [];
              for (const legacyMessage of legacyMessages) {
                try {
                  const saved = await addAIImageConversationMessage(created.conversation.id, {
                    role: legacyMessage.role,
                    content: legacyMessage.content,
                    ...(legacyMessage.generationId
                      ? { generationId: legacyMessage.generationId }
                      : {}),
                  });
                  migratedMessages.push({
                    id: saved.message.id,
                    role: saved.message.role,
                    content: saved.message.content,
                    createdAt: saved.message.createdAt,
                    generationId: saved.message.generationId,
                  });
                } catch {
                  // A deleted generation can make one legacy assistant message un-migratable.
                }
              }
              if (migratedMessages.length > 0) {
                if (!active) return;
                setConversationID(created.conversation.id);
                setConversations((items) => [
                  created.conversation,
                  ...items.filter((item) => item.id !== created.conversation.id),
                ]);
                setConversationMessages(migratedMessages);
                scheduleConversationScroll('auto');
                window.localStorage.removeItem(legacyConversationKey);
              }
            } catch {
              // Legacy browser data is best-effort; the server remains the source of truth.
            }
          }
        }
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载图片创作数据失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyHistory, currentUserID, legacyConversationKey, scheduleConversationScroll]);

  useEffect(() => {
    let active = true;
    void listAIPrompts()
      .then(({ list }) => {
        if (active) setPromptResources(list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载提示词资源失败'));
      })
      .finally(() => {
        if (active) setPromptResourcesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !activeGeneration ||
      (activeGeneration.status !== 'queued' && activeGeneration.status !== 'running')
    ) {
      return;
    }
    let cancelled = false;
    let timeoutID: number | undefined;
    const poll = async () => {
      try {
        const result = await getAIImageGeneration(activeGeneration.id);
        if (cancelled) return;
        setActiveGeneration(result.generation);
        setHistory((current) => [
          result.generation,
          ...current.filter((item) => item.id !== result.generation.id),
        ]);
        if (result.generation.status === 'succeeded') {
          scheduleConversationScroll();
          toast.success('图片生成完成');
          setActiveGeneration(null);
          return;
        }
        if (result.generation.status === 'failed') {
          scheduleConversationScroll();
          toast.error(result.generation.errorMessage || '图片生成失败');
          setActiveGeneration(null);
          return;
        }
        if (result.generation.status === 'paused') {
          scheduleConversationScroll();
          setActiveGeneration(null);
          return;
        }
        timeoutID = window.setTimeout(poll, 1500);
      } catch (error) {
        if (!cancelled) {
          toast.error(getAPIErrorMessage(error, '读取生成进度失败'));
          timeoutID = window.setTimeout(poll, 3000);
        }
      }
    };
    timeoutID = window.setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      if (timeoutID) window.clearTimeout(timeoutID);
    };
  }, [activeGeneration, scheduleConversationScroll]);

  const selectPreset = (preset: AIImageRecipe) => {
    setPresetID(preset.id);
    if (aspectRatios.includes(preset.recommendedAspect)) {
      setAspectRatio(preset.recommendedAspect);
    }
  };

  const handleGenerate = async () => {
    if (creatingRef.current) return;
    if (!prompt.trim()) {
      toast.error('请输入画面描述');
      return;
    }
    if (!modelID) {
      toast.error('请选择图片模型');
      return;
    }
    const supportsReference = selectedModel?.capabilities.includes('reference_image') ?? false;
    let reference: string | null = null;
    if (hasCanvasContent && useCanvasReference && supportsReference) {
      reference = sketchCanvasRef.current?.exportDataURL() ?? null;
      if (!reference) {
        toast.error('画布还没有准备好，请稍后重试');
        return;
      }
    }
    creatingRef.current = true;
    setCreating(true);
    try {
      const result = await createAIImageGeneration({
        modelId: modelID,
        recipeId: presetID,
        styleProfileId: selectedStyleProfile?.id,
        brief: prompt.trim(),
        aspectRatio,
        quality,
        references: reference ? [reference] : [],
      });
      setActiveGeneration(result.generation);
      setHistory((current) => [
        result.generation,
        ...current.filter((item) => item.id !== result.generation.id),
      ]);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建图片生成任务失败'));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const saveToResources = async (
    generation: AIImageGeneration,
    visibility: SaveResourceVisibility,
  ) => {
    setSavingID(generation.id);
    setSaveError(undefined);
    setSaveModelName(undefined);
    try {
      setSaveProgress('title');
      try {
        const result = await listAvailableAIModels('vision');
        setSaveModelName(result.list[0]?.displayName);
      } catch {
        // The server owns model selection and will surface an actionable error.
      }
      const result = await saveAIImageGenerationResource(generation.id, {
        visibility,
      });
      setHistory((current) =>
        current.map((item) =>
          item.id === generation.id ? { ...item, resourceId: result.resource.id } : item,
        ),
      );
      setSaveTarget(null);
      toast.success(
        `${visibility === 'public' ? '已保存并公开访问' : '已保存到私有资源库'}${result.metadataModel ? `（识别模型：${result.metadataModel}）` : ''}`,
      );
    } catch (error) {
      setSaveError(getAPIErrorMessage(error, '保存到资源库失败'));
    } finally {
      setSavingID(undefined);
      setSaveProgress(undefined);
      setSaveModelName(undefined);
    }
  };

  const reuseGeneration = async (generation: AIImageGeneration) => {
    setPresetID(generation.presetId);
    setPrompt(generation.prompt);
    setAspectRatio(generation.aspectRatio);
    setQuality(generation.quality);
    handleImageModelChange(generation.modelCatalogId);
    setSelectedStyleProfile(
      styleProfiles.find(
        (profile) =>
          profile.id === generation.styleProfileId ||
          (generation.skillId && profile.id === `skill:${generation.skillId}`),
      ) || null,
    );
    if (generation.canvasSnapshotUrl) {
      try {
        const dataURL = await readImageAsDataURL(generation.canvasSnapshotUrl);
        setCanvasRestore({ id: generation.id, dataURL });
        setUseCanvasReference(true);
      } catch (error) {
        toast.error(getAPIErrorMessage(error, '画布快照读取失败，请稍后重试'));
      }
    } else if (generation.referenceCount > 0) {
      toast.info('这条旧历史没有画布快照，已恢复提示词与生成设置');
    }
    toast.info('已恢复原参数；请确认设置后主动提交，系统不会自动再次调用模型。');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startGenerationVariant = (generation: AIImageGeneration) => {
    if (isBusy) return;
    if (!supportsReference || !selectedModel) {
      toast.error('请先在设置中选择支持参考图的图片模型');
      return;
    }
    setVariantInstruction('');
    setVariantSource(generation);
  };

  const createGenerationVariant = async () => {
    const source = variantSource;
    const instruction = variantInstruction.trim();
    if (!source || !instruction || isBusy) return;
    if (!supportsReference || !selectedModel) {
      toast.error('请先在设置中选择支持参考图的图片模型');
      return;
    }
    if (!variantQualitySupported) {
      toast.error('当前模型不支持使用参考图生成此清晰度，请调整右侧设置');
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    try {
      const result = await createAIImageGeneration({
        modelId: modelID,
        recipeId: presetID,
        styleProfileId: selectedStyleProfile?.id,
        brief: instruction,
        aspectRatio,
        quality,
        references: [],
        referenceGenerationId: source.id,
      });
      setActiveGeneration(result.generation);
      setHistory((current) => [
        result.generation,
        ...current.filter((item) => item.id !== result.generation.id),
      ]);
      setVariantSource(null);
      setVariantInstruction('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建基于原图的任务失败'));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const previewParentGeneration = async (generation: AIImageGeneration) => {
    const parentGenerationID = generation.parentGenerationId;
    if (!parentGenerationID) return;
    const knownParent = history.find((item) => item.id === parentGenerationID);
    try {
      const parent = knownParent || (await getAIImageGeneration(parentGenerationID)).generation;
      if (parent.status !== 'succeeded' || !parent.resultUrl) {
        toast.info('来源图片已不可用');
        return;
      }
      setHistoryPreview({
        src: parent.resultUrl,
        title: `来源版本 · ${parent.model || '图片模型'}`,
      });
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '读取来源图片失败'));
    }
  };

  const sendConversationMessage = async () => {
    const content = conversationInput.trim();
    if (!content || isBusy || !modelID) return;
    if (selectedPreset?.requiresReference && !conversationReferenceGeneration) {
      toast.error('当前创作类型需要先生成一张图片作为参考');
      return;
    }
    const selectedReferenceGeneration = conversationReferenceGeneration;
    const latestConversationRequest = [...conversationMessages]
      .reverse()
      .find((message) => message.role === 'user')?.content;
    const referenceGenerationId =
      selectedReferenceGeneration && supportsReference ? selectedReferenceGeneration.id : undefined;
    const generationPrompt =
      selectedReferenceGeneration && !supportsReference
        ? `参考图片描述：${latestConversationRequest || selectedReferenceGeneration.prompt}\n本轮修改要求：${content}`
        : content;
    setConversationInput('');
    setActiveGeneration(null);
    setConversationSending(true);
    let activeConversationID = conversationID;
    try {
      if (!activeConversationID) {
        const created = await createAIImageConversation({ title: content.slice(0, 160) });
        if (!created.conversation) throw new Error('图片对话创建失败');
        activeConversationID = created.conversation.id;
        setConversationID(activeConversationID);
        setConversations((items) => [
          created.conversation,
          ...items.filter((item) => item.id !== created.conversation.id),
        ]);
      }
      const savedUserMessage = await addAIImageConversationMessage(activeConversationID, {
        role: 'user',
        content,
      });
      setConversations((items) => [
        savedUserMessage.conversation,
        ...items.filter((item) => item.id !== savedUserMessage.conversation.id),
      ]);
      setConversationMessages((items) => [
        ...items,
        {
          id: savedUserMessage.message.id,
          role: savedUserMessage.message.role,
          content: savedUserMessage.message.content,
          createdAt: savedUserMessage.message.createdAt,
        },
      ]);
      scheduleConversationScroll();
      const result = await createAIImageGeneration({
        modelId: modelID,
        recipeId: presetID,
        styleProfileId: selectedStyleProfile?.id,
        brief: generationPrompt,
        aspectRatio,
        quality,
        references: [],
        referenceGenerationId,
      });
      const assistantContent = referenceGenerationId
        ? '我会基于所选参考图生成新的版本。'
        : '我正在根据你的描述生成图片。';
      const savedAssistantMessage = await addAIImageConversationMessage(activeConversationID, {
        role: 'assistant',
        content: assistantContent,
        generationId: result.generation.id,
      });
      setConversationMessages((items) => [
        ...items,
        {
          id: savedAssistantMessage.message.id,
          role: savedAssistantMessage.message.role,
          content: savedAssistantMessage.message.content,
          createdAt: savedAssistantMessage.message.createdAt,
          generationId: savedAssistantMessage.message.generationId,
        },
      ]);
      scheduleConversationScroll();
      setActiveGeneration(result.generation);
      setHistory((current) => [
        result.generation,
        ...current.filter((item) => item.id !== result.generation.id),
      ]);
      if (selectedReferenceGeneration && !supportsReference) {
        toast.info('当前模型不支持参考图，本轮会按文字重新生成');
      }
    } catch (error) {
      const errorMessage = getAPIErrorMessage(error, '图片生成失败，请稍后重试');
      if (activeConversationID) {
        void addAIImageConversationMessage(activeConversationID, {
          role: 'assistant',
          content: errorMessage,
        }).catch(() => undefined);
      }
      setConversationMessages((items) => [
        ...items,
        {
          id: `conversation-assistant-error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          createdAt: new Date().toISOString(),
        },
      ]);
      scheduleConversationScroll();
      toast.error(errorMessage);
    } finally {
      setConversationSending(false);
    }
  };

  const startNewConversation = async () => {
    if (isBusy) return;
    setConversationStarting(true);
    try {
      const created = await createAIImageConversation({ title: '新图片对话' });
      setConversationID(created.conversation.id);
      setConversations((items) => [
        created.conversation,
        ...items.filter((item) => item.id !== created.conversation.id),
      ]);
      setConversationInput('');
      setConversationMessages([]);
      setConversationReferenceMode('latest');
      setLockedConversationReferenceID(undefined);
      scheduleConversationScroll('auto');
      toast.success('已开启新对话');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '新对话创建失败'));
    } finally {
      setConversationStarting(false);
    }
  };

  const selectConversation = async (selectedConversation: AIImageConversation) => {
    if (isBusy || selectedConversation.id === conversationID) {
      setConversationHistoryOpen(false);
      return;
    }
    setConversationLoading(true);
    try {
      const result = await getAIImageConversation(selectedConversation.id);
      if (!result.conversation) throw new Error('图片对话不存在');
      setConversationID(result.conversation.id);
      setConversationInput('');
      setConversationMessages(toImageConversationMessages(result.messages));
      setConversationReferenceMode('latest');
      setLockedConversationReferenceID(undefined);
      setConversationHistoryOpen(false);
      scheduleConversationScroll('auto');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载历史对话失败'));
    } finally {
      setConversationLoading(false);
    }
  };

  const clearConversationContext = async () => {
    if (isBusy || !conversationID) return;
    const previousConversationID = conversationID;
    const previousMessages = conversationMessages;
    const previousInput = conversationInput;
    setConversationInput('');
    setConversationMessages([]);
    try {
      const result = await clearAIImageConversation(conversationID);
      setConversationID(result.conversation?.id ?? previousConversationID);
      setConversationMessages(toImageConversationMessages(result.messages));
      const clearedConversation = result.conversation;
      if (clearedConversation) {
        setConversations((items) => [
          clearedConversation,
          ...items.filter((item) => item.id !== clearedConversation.id),
        ]);
      }
      toast.success('已清空对话上下文');
    } catch (error) {
      setConversationID(previousConversationID);
      setConversationMessages(previousMessages);
      setConversationInput(previousInput);
      toast.error(getAPIErrorMessage(error, '清空对话上下文失败'));
    }
  };

  const deleteGeneration = async () => {
    if (!deleteTarget || deletingID) return;
    const generation = deleteTarget;
    setDeletingID(generation.id);
    try {
      await deleteAIImageGeneration(generation.id);
      setHistory((current) =>
        current
          .filter((item) => item.id !== generation.id)
          .map((item) =>
            item.parentGenerationId === generation.id
              ? { ...item, parentGenerationId: undefined }
              : item,
          ),
      );
      if (lockedConversationReferenceID === generation.id) {
        setLockedConversationReferenceID(undefined);
        setConversationReferenceMode('latest');
      }
      setHistoryDetailTarget((current) => (current?.id === generation.id ? null : current));
      setActiveGeneration((current) => (current?.id === generation.id ? null : current));
      setDeleteTarget(null);
      toast.success('图片历史已删除');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除图片历史失败'));
    } finally {
      setDeletingID(undefined);
    }
  };

  const updateGenerationFavorite = async (generation: AIImageGeneration) => {
    if (favoriteUpdatingID) return;
    const nextFavorited = !generation.isFavorited;
    setFavoriteUpdatingID(generation.id);
    setHistory((current) =>
      current.map((item) =>
        item.id === generation.id ? { ...item, isFavorited: nextFavorited } : item,
      ),
    );
    setHistoryDetailTarget((current) =>
      current?.id === generation.id ? { ...current, isFavorited: nextFavorited } : current,
    );
    try {
      const result = await updateAIImageGenerationFavorite(generation.id, nextFavorited);
      setHistory((current) =>
        current.map((item) => (item.id === generation.id ? result.generation : item)),
      );
      setHistoryDetailTarget((current) =>
        current?.id === generation.id ? result.generation : current,
      );
      toast.success(nextFavorited ? '已收藏到创作库' : '已取消收藏');
    } catch (error) {
      setHistory((current) =>
        current.map((item) =>
          item.id === generation.id ? { ...item, isFavorited: generation.isFavorited } : item,
        ),
      );
      setHistoryDetailTarget((current) =>
        current?.id === generation.id
          ? { ...current, isFavorited: generation.isFavorited }
          : current,
      );
      toast.error(getAPIErrorMessage(error, '更新图片收藏失败'));
    } finally {
      setFavoriteUpdatingID(undefined);
    }
  };

  const isGenerating =
    activeGeneration?.status === 'queued' || activeGeneration?.status === 'running';
  const isBusy =
    creating || isGenerating || conversationSending || conversationStarting || conversationLoading;
  const studioMode = parseStudioMode(searchParams.get('mode'));

  const pauseGeneration = async (generation: AIImageGeneration) => {
    if (generation.status !== 'queued' && generation.status !== 'running') return;
    setPausingGenerationID(generation.id);
    try {
      const result = await pauseAIImageGeneration(generation.id);
      setHistory((current) => [
        result.generation,
        ...current.filter((item) => item.id !== result.generation.id),
      ]);
      setActiveGeneration((current) => (current?.id === result.generation.id ? null : current));
      toast.success('已暂停生成');
      scheduleConversationScroll();
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '暂停生成失败'));
    } finally {
      setPausingGenerationID(undefined);
    }
  };
  const historyStatusFilter = parseHistoryStatusFilter(searchParams.get('historyStatus'));
  const historyModelFilter = searchParams.get('historyModel') || 'all';
  const favoritesOnly = searchParams.get('historyFavorite') === 'true';
  const historyModelOptions = Array.from(
    new Map(
      history
        .filter((generation) => generation.model.trim())
        .map((generation) => {
          const provider = generation.provider.trim() || '未知服务商';
          const model = generation.model.trim();
          const value = getHistoryModelFilterValue(provider, model);
          return [value, { value, label: `${provider} · ${model}` }] as const;
        }),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
  const selectedHistoryModelLabel =
    historyModelFilter === 'all'
      ? '全部模型'
      : historyModelOptions.find((option) => option.value === historyModelFilter)?.label ||
        historyModelFilter;
  const visibleHistory = history.filter((generation) => {
    const statusMatches =
      historyStatusFilter === 'all' ||
      (historyStatusFilter === 'succeeded' && generation.status === 'succeeded') ||
      (historyStatusFilter === 'active' &&
        (generation.status === 'queued' || generation.status === 'running')) ||
      (historyStatusFilter === 'failed' && generation.status === 'failed');
    return (
      statusMatches &&
      (historyModelFilter === 'all' ||
        historyModelFilter === getHistoryModelFilterValue(generation.provider, generation.model) ||
        generation.model === historyModelFilter) &&
      (!favoritesOnly || generation.isFavorited)
    );
  });
  const historyPage = parsePositiveInt(searchParams.get('historyPage'), DEFAULT_HISTORY_PAGE);
  const handleStudioModeChange = (mode: ImageStudioMode) => {
    if (mode === studioMode || isBusy) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tabIndicator = document.querySelector('[data-ai-studio-tab-indicator]');
    const flipState = !reduceMotion && tabIndicator ? Flip.getState(tabIndicator) : null;
    const next = new URLSearchParams(searchParams);
    if (mode === 'conversation') next.delete('mode');
    else next.set('mode', mode);
    flushSync(() => setSearchParams(next, { replace: true }));
    if (mode === 'conversation') scheduleConversationScroll('auto');
    if (flipState) {
      Flip.from(flipState, {
        duration: 0.42,
        ease: 'power3.inOut',
        absolute: true,
        scale: false,
        simple: true,
      });
    }
  };
  const supportsReference = selectedModel?.capabilities.includes('reference_image') ?? false;
  const usesCanvasReference = hasCanvasContent && useCanvasReference && supportsReference;
  const selectedPreset = presets.find((preset) => preset.id === presetID);
  const selectedPresetSamples = selectedPreset
    ? (generatedPresetSamples[selectedPreset.id] ?? selectedPreset.samplePrompts)
    : [];
  const normalizedPromptResourceQuery = promptResourceQuery.trim().toLocaleLowerCase();
  const visiblePromptResources = [...promptResources]
    .filter(
      (promptResource) =>
        !normalizedPromptResourceQuery ||
        `${promptResource.name} ${promptResource.description} ${promptResource.tags.join(' ')}`
          .toLocaleLowerCase()
          .includes(normalizedPromptResourceQuery),
    )
    .sort(
      (left, right) =>
        Number(right.tags.includes('生图')) - Number(left.tags.includes('生图')) ||
        right.updatedAt.localeCompare(left.updatedAt),
    );
  const visibleStyleProfiles = styleProfiles.filter((profile) => {
    const keyword = styleQuery.trim().toLocaleLowerCase();
    return (
      !keyword || `${profile.name} ${profile.description}`.toLocaleLowerCase().includes(keyword)
    );
  });
  const latestConversationGeneration = [...conversationMessages]
    .reverse()
    .map((message) =>
      message.generationId
        ? history.find((generation) => generation.id === message.generationId)
        : undefined,
    )
    .find((generation): generation is AIImageGeneration => generation?.status === 'succeeded');
  const conversationReferenceCandidates = history
    .filter((generation) => generation.status === 'succeeded' && Boolean(generation.resultUrl))
    .filter((generation, index) => index < 8 || generation.id === lockedConversationReferenceID);
  const lockedConversationReference = lockedConversationReferenceID
    ? history.find((generation) => generation.id === lockedConversationReferenceID)
    : undefined;
  const conversationReferenceGeneration =
    conversationReferenceMode === 'locked'
      ? lockedConversationReference
      : conversationReferenceMode === 'latest'
        ? latestConversationGeneration
        : undefined;
  const usesConversationReference =
    studioMode === 'conversation' && Boolean(conversationReferenceGeneration && supportsReference);
  const hasActiveConversationGenerationMessage = Boolean(
    activeGeneration &&
      conversationMessages.some((message) => message.generationId === activeGeneration.id),
  );
  const showConversationGenerationPlaceholder =
    conversationSending && !hasActiveConversationGenerationMessage;
  const usesReferenceInput = usesCanvasReference || usesConversationReference;
  const imageQualities =
    selectedModel?.imageQualities && selectedModel.imageQualities.length > 0
      ? selectedModel.imageQualities
      : DEFAULT_QUALITIES;
  const modelQualities =
    usesReferenceInput &&
    selectedModel?.imageReferenceQualities &&
    selectedModel.imageReferenceQualities.length > 0
      ? selectedModel.imageReferenceQualities
      : imageQualities;
  const variantReferenceQualities =
    selectedModel?.imageReferenceQualities && selectedModel.imageReferenceQualities.length > 0
      ? selectedModel.imageReferenceQualities
      : imageQualities;
  const variantQualitySupported = supportsReference && variantReferenceQualities.includes(quality);
  const referenceCapabilityMaxQuality =
    usesReferenceInput && modelQualities.length > 0
      ? modelQualities[modelQualities.length - 1]
      : null;
  const referenceQualityLimited =
    usesReferenceInput && modelQualities.length < imageQualities.length;
  const targetSize = sizes[aspectRatio]?.[quality];
  const requestReferenceLabel = usesConversationReference
    ? conversationReferenceMode === 'locked'
      ? '锁定的历史图片'
      : '对话中的最新成功图'
    : usesCanvasReference
      ? '当前画布快照'
      : '不使用参考图';
  const is4KRequest = quality === '4K';
  const totalHistoryPages = Math.max(1, Math.ceil(visibleHistory.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const pagedHistory = visibleHistory.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );
  const historyStart = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE + 1;
  const historyEnd = Math.min(safeHistoryPage * HISTORY_PAGE_SIZE, visibleHistory.length);
  const setHistoryPage = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams);
      const normalizedPage = Math.max(1, Math.floor(page));
      if (normalizedPage === 1) {
        next.delete('historyPage');
      } else {
        next.set('historyPage', String(normalizedPage));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const setHistoryFilters = useCallback(
    (filters: { status?: HistoryStatusFilter; model?: string; favoritesOnly?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      const nextStatus = filters.status ?? historyStatusFilter;
      const nextModel = filters.model ?? historyModelFilter;
      const nextFavoritesOnly = filters.favoritesOnly ?? favoritesOnly;
      next.set('historyStatus', nextStatus);
      if (nextModel === 'all') next.delete('historyModel');
      else next.set('historyModel', nextModel);
      if (nextFavoritesOnly) next.set('historyFavorite', 'true');
      else next.delete('historyFavorite');
      next.delete('historyPage');
      setSearchParams(next, { replace: true });
    },
    [favoritesOnly, historyModelFilter, historyStatusFilter, searchParams, setSearchParams],
  );
  const missingRequiredReference = Boolean(
    selectedPreset?.requiresReference && !usesCanvasReference,
  );
  const applyPresetSamplePrompt = (samplePrompt: string) => {
    if (studioMode === 'conversation') {
      setConversationInput(samplePrompt);
      return;
    }
    setPrompt(samplePrompt);
  };
  const refreshPresetSamples = async () => {
    if (!selectedPreset || refreshingPresetSamples) return;
    setRefreshingPresetSamples(true);
    try {
      const excludedPrompts = [
        ...selectedPresetSamples,
        ...[...(shownPresetSamples[selectedPreset.id] ?? [])].reverse(),
        ...selectedPreset.samplePrompts,
      ];
      const result = await generateAIImageRecipeSamples(selectedPreset.id, excludedPrompts);
      if (result.list.length === 0) {
        throw new Error('没有更多可用的快速示例');
      }
      setGeneratedPresetSamples((current) => ({
        ...current,
        [selectedPreset.id]: result.list,
      }));
      setShownPresetSamples((current) => ({
        ...current,
        [selectedPreset.id]: Array.from(
          new Set([
            ...selectedPreset.samplePrompts,
            ...(current[selectedPreset.id] ?? []),
            ...result.list,
          ]),
        ).slice(-12),
      }));
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载快速示例失败，请稍后重试'));
    } finally {
      setRefreshingPresetSamples(false);
    }
  };
  const commitPromptResource = (promptResource: AIPrompt, mode: 'replace' | 'append') => {
    const current = studioMode === 'conversation' ? conversationInput : prompt;
    const maxLength =
      studioMode === 'conversation' ? MAX_CONVERSATION_INPUT_LENGTH : MAX_IMAGE_PROMPT_LENGTH;
    const next =
      mode === 'append' && current.trim()
        ? `${current.trim()}\n\n${promptResource.content.trim()}`
        : promptResource.content;
    if (next.length > maxLength) {
      toast.error(`填入后将超过 ${maxLength.toLocaleString()} 字，请先精简当前内容`);
      return;
    }
    applyPresetSamplePrompt(next);
    setPendingPromptResource(null);
    setPromptResourcePickerOpen(false);
    toast.success(`已填入“${promptResource.name}”`);
  };
  const applyPromptResource = (promptResource: AIPrompt) => {
    const current = studioMode === 'conversation' ? conversationInput : prompt;
    if (current.trim()) {
      setPendingPromptResource(promptResource);
      setPromptResourcePickerOpen(false);
      return;
    }
    commitPromptResource(promptResource, 'replace');
  };
  const applyRecognizedStyle = (stylePrompt: string) => {
    const current = studioMode === 'conversation' ? conversationInput : prompt;
    const maxLength =
      studioMode === 'conversation' ? MAX_CONVERSATION_INPUT_LENGTH : MAX_IMAGE_PROMPT_LENGTH;
    const next = current.trim() ? `${current.trim()}\n\n${stylePrompt.trim()}` : stylePrompt.trim();
    if (next.length > maxLength) {
      toast.error(`填入后将超过 ${maxLength.toLocaleString()} 字，请先精简当前内容`);
      return;
    }
    applyPresetSamplePrompt(next);
    setStyleRecognitionOpen(false);
    toast.success('已追加识别出的风格提示词');
  };
  const selectStyleProfile = (profile: AIImageStyleProfile) => {
    setSelectedStyleProfile(profile);
    setStylePickerOpen(false);
    toast.success(`视觉风格已设为“${profile.name}”`);
  };
  useEffect(() => {
    if (safeHistoryPage !== historyPage) {
      setHistoryPage(safeHistoryPage);
    }
  }, [safeHistoryPage, historyPage, setHistoryPage]);
  useEffect(() => {
    if (!modelQualities.includes(quality)) {
      setQuality(modelQualities[modelQualities.length - 1] || DEFAULT_QUALITIES[0]);
    }
  }, [modelQualities, quality]);

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-xs">
              <ImageIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI 图片</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                从构图到连续修改，在同一个工作台完成。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!loading ? (
              <div className="hidden items-center gap-1.5 lg:flex">
                <Badge variant="outline">{selectedModel?.displayName || '选择模型'}</Badge>
                <Badge variant="outline">{quality}</Badge>
                <Badge variant="outline">{aspectRatio}</Badge>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void loadHistory().catch((error) =>
                  toast.error(getAPIErrorMessage(error, '刷新创作历史失败')),
                )
              }
              disabled={loading}
            >
              <RefreshCw />
              刷新
            </Button>
          </div>
        </header>

        {loading ? (
          <StudioWorkspaceSkeleton />
        ) : (
          <div
            data-testid="ai-image-workspace"
            className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]"
          >
            <Card className="min-w-0 self-start overflow-hidden shadow-sm">
              <Tabs
                value={studioMode}
                onValueChange={(value) => handleStudioModeChange(value as ImageStudioMode)}
                className="gap-0"
              >
                <CardHeader className="border-b border-border px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>创作空间</CardTitle>
                      <CardDescription className="mt-1">
                        {studioMode === 'canvas'
                          ? '绘制构图或摆放参考素材。'
                          : '描述画面，并连续修改上一张结果。'}
                      </CardDescription>
                    </div>
                    <TabsList
                      data-ai-studio-tabs
                      className="grid h-10 w-full max-w-[18rem] grid-cols-2 bg-muted/70"
                    >
                      <TabsTrigger
                        value="conversation"
                        disabled={isBusy}
                        className="relative overflow-hidden data-active:bg-transparent data-active:shadow-none dark:data-active:bg-transparent"
                      >
                        {studioMode === 'conversation' ? (
                          <span
                            data-ai-studio-tab-indicator
                            data-flip-id="ai-studio-tab-indicator"
                            className="absolute inset-0 rounded-md border border-border bg-background shadow-xs"
                          />
                        ) : null}
                        <span className="relative z-10 flex items-center gap-1.5">
                          <MessageCircle />
                          对话
                        </span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="canvas"
                        disabled={isBusy}
                        className="relative overflow-hidden data-active:bg-transparent data-active:shadow-none dark:data-active:bg-transparent"
                      >
                        {studioMode === 'canvas' ? (
                          <span
                            data-ai-studio-tab-indicator
                            data-flip-id="ai-studio-tab-indicator"
                            className="absolute inset-0 rounded-md border border-border bg-background shadow-xs"
                          />
                        ) : null}
                        <span className="relative z-10 flex items-center gap-1.5">
                          <ImageIcon />
                          画布
                        </span>
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>
                <CardContent className="relative p-4 sm:p-5">
                  <div
                    key={studioMode}
                    data-ai-studio-surface
                    className="animate-in fade-in-0 duration-300 motion-reduce:animate-none"
                  >
                    {studioMode === 'canvas' ? (
                      <>
                        <SketchCanvas
                          ref={sketchCanvasRef}
                          aspectRatio={aspectRatio}
                          disabled={isBusy}
                          onContentChange={setHasCanvasContent}
                          restoreSnapshot={canvasRestore}
                        />
                        {isGenerating && activeGeneration ? (
                          <GenerationOverlay
                            stage={activeGeneration.stage}
                            generation={activeGeneration}
                            onPause={() => void pauseGeneration(activeGeneration)}
                            pausing={pausingGenerationID === activeGeneration.id}
                          />
                        ) : null}
                      </>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border bg-background">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
                          <div>
                            <p className="text-sm font-medium">图片对话</p>
                            <p className="text-xs text-muted-foreground">
                              围绕最近一张图片继续创作
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setConversationHistoryOpen(true)}
                              disabled={isBusy}
                            >
                              <History />
                              历史对话
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void startNewConversation()}
                              disabled={isBusy}
                            >
                              <Plus />
                              {conversationStarting ? '创建中' : '新对话'}
                            </Button>
                          </div>
                        </div>
                        <div ref={conversationScrollRootRef}>
                          <ScrollArea className="h-[min(32rem,60vh)]">
                            <div className="space-y-4 p-4 sm:p-5">
                              {conversationLoading ? (
                                <div className="space-y-5 py-4" aria-hidden="true">
                                  <div className="flex justify-end">
                                    <Skeleton className="h-14 w-48 rounded-xl" />
                                  </div>
                                  <Skeleton className="h-24 w-4/5 rounded-xl" />
                                  <div className="flex justify-end">
                                    <Skeleton className="h-14 w-56 rounded-xl" />
                                  </div>
                                  <Skeleton className="h-20 w-3/4 rounded-xl" />
                                </div>
                              ) : conversationMessages.length === 0 ? (
                                <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
                                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <MessageCircle className="size-6" />
                                  </span>
                                  <p className="mt-4 text-sm font-medium">从一句描述开始</p>
                                  <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                                    例如“画一只戴红围巾的柴犬”。生成后可以继续说“换成夜景”或“把背景改成海边”。
                                  </p>
                                </div>
                              ) : (
                                <>
                                  {conversationMessages.map((message) => {
                                    const generation = message.generationId
                                      ? history.find((item) => item.id === message.generationId)
                                      : undefined;
                                    return (
                                      <div
                                        key={message.id}
                                        className={cn(
                                          'flex',
                                          message.role === 'user' ? 'justify-end' : 'justify-start',
                                        )}
                                      >
                                        <ConversationMessageBubble
                                          role={message.role}
                                          content={message.content}
                                          createdAt={message.createdAt}
                                          footer={
                                            generation?.status === 'succeeded' ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setSaveTarget(generation)}
                                                disabled={
                                                  Boolean(generation.resourceId) ||
                                                  savingID === generation.id
                                                }
                                              >
                                                <Save />
                                                {generation.resourceId ? '已保存' : '保存图片'}
                                              </Button>
                                            ) : generation?.status === 'queued' ||
                                              generation?.status === 'running' ? (
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => void pauseGeneration(generation)}
                                                disabled={pausingGenerationID === generation.id}
                                              >
                                                <CirclePause />
                                                暂停生成
                                              </Button>
                                            ) : undefined
                                          }
                                        >
                                          {generation ? (
                                            <div className="mt-3 space-y-2">
                                              {generation.status === 'succeeded' &&
                                              generation.resultUrl ? (
                                                <button
                                                  type="button"
                                                  className="block max-w-full overflow-hidden rounded-xl border border-border/70 bg-background text-left outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                  onClick={() =>
                                                    setHistoryPreview({
                                                      src: generation.resultUrl,
                                                      title: generation.prompt || '生成图片预览',
                                                    })
                                                  }
                                                >
                                                  <AIImageGenerationImage
                                                    generationId={generation.id}
                                                    src={generation.resultUrl}
                                                    alt={generation.prompt || '生成图片'}
                                                    className="max-h-64 w-full object-contain"
                                                    onLoad={() => scheduleConversationScroll()}
                                                  />
                                                </button>
                                              ) : null}
                                              {generation.status === 'failed' ? (
                                                <div className="w-full min-w-0 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs leading-5 text-destructive break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                                                  {generation.errorMessage || '生成失败'}
                                                </div>
                                              ) : generation.status === 'paused' ? (
                                                <div className="w-[min(100%,20rem)] rounded-md border border-border bg-background/70 px-2.5 py-2 text-xs text-muted-foreground">
                                                  已暂停生成
                                                </div>
                                              ) : generation.status !== 'succeeded' ? (
                                                <div className="w-[min(100%,20rem)] space-y-2 rounded-lg border border-border/70 bg-background/60 p-2">
                                                  <GenerationPreview
                                                    compact
                                                    stage={generation.stage}
                                                    generation={generation}
                                                  />
                                                </div>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </ConversationMessageBubble>
                                      </div>
                                    );
                                  })}
                                  {showConversationGenerationPlaceholder ? (
                                    <div className="flex justify-start">
                                      {/* biome-ignore lint/a11y/useValidAriaRole: role identifies the conversation author, not an ARIA role. */}
                                      <ConversationMessageBubble
                                        role="assistant"
                                        content="我正在根据你的描述生成图片。"
                                      >
                                        <div className="mt-3 w-[min(100%,20rem)]">
                                          <GenerationPreview compact stage="preparing" />
                                        </div>
                                      </ConversationMessageBubble>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                        <div className="border-t border-border bg-card p-3">
                          {selectedStyleProfile ? (
                            <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-foreground">
                              <WandSparkles className="size-3.5 text-primary" />
                              <span className="min-w-0 flex-1 truncate">
                                视觉风格：{selectedStyleProfile.name}
                              </span>
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                className="shrink-0"
                                aria-label="恢复默认视觉风格"
                                onClick={() => setSelectedStyleProfile(null)}
                                disabled={isBusy}
                              >
                                <X />
                              </Button>
                            </div>
                          ) : null}
                          <Textarea
                            value={conversationInput}
                            placeholder="描述图片，或继续修改上一张结果"
                            disabled={isBusy || !modelID}
                            className="min-h-20 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                            onChange={(event) => setConversationInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void sendConversationMessage();
                              }
                            }}
                            maxLength={MAX_CONVERSATION_INPUT_LENGTH}
                          />
                          <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <ModelPicker
                                value={modelID}
                                onValueChange={handleImageModelChange}
                                capability="image_generation"
                                label="图片模型"
                                compact
                                compactLabel="模型："
                                compactTrigger
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setStyleRecognitionOpen(true)}
                                disabled={isBusy}
                              >
                                <ImageIcon />
                                识别风格
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setStyleQuery('');
                                  setStylePickerOpen(true);
                                }}
                                disabled={isBusy}
                              >
                                <WandSparkles />
                                视觉风格
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setPromptResourceQuery('');
                                  setPromptResourcePickerOpen(true);
                                }}
                                disabled={isBusy}
                              >
                                <FileText />
                                插入描述
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void clearConversationContext()}
                                disabled={isBusy || conversationMessages.length === 0}
                              >
                                <Trash2 />
                                清空上下文
                              </Button>
                            </div>
                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                              {latestConversationGeneration
                                ? supportsReference
                                  ? '下一轮会参考上一张图片'
                                  : '当前模型不支持参考图，将按文字继续生成'
                                : '首条消息会直接生成图片'}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void sendConversationMessage()}
                              disabled={isBusy || !conversationInput.trim() || !modelID}
                            >
                              <Send />
                              {conversationSending ? '生成中' : '发送'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Tabs>
            </Card>

            <Card className="flex h-fit max-h-none flex-col overflow-hidden shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)]">
              <CardHeader className="shrink-0 border-b border-border px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <SlidersHorizontal className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle>生成设置</CardTitle>
                    <CardDescription className="mt-1 truncate">
                      {selectedModel?.displayName || '选择图片模型'}
                    </CardDescription>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">清晰度</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {quality}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">比例</p>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                      {aspectRatio}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                    <p className="text-[10px] text-muted-foreground">尺寸</p>
                    <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">
                      {targetSize || '自动'}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-4">
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>创作类型</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <Button
                        key={preset.id}
                        type="button"
                        variant="outline"
                        aria-pressed={presetID === preset.id}
                        className={cn(
                          'h-10 min-w-0 justify-between gap-2 px-3 transition-[background-color,border-color,box-shadow]',
                          presetID === preset.id &&
                            'border-primary/40 bg-secondary shadow-sm hover:bg-secondary/80',
                        )}
                        onClick={() => selectPreset(preset)}
                        disabled={isBusy}
                      >
                        <span className="min-w-0 truncate">{preset.name}</span>
                        {presetID === preset.id ? (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        ) : null}
                      </Button>
                    ))}
                  </div>
                  {selectedPreset ? (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                      <p className="text-xs font-medium text-foreground">{selectedPreset.name}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {selectedPreset.description}
                      </p>
                    </div>
                  ) : null}
                  {selectedPresetSamples.length > 0 ? (
                    <details className="group rounded-lg border border-border bg-background px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">
                          快速示例 · {selectedPresetSamples.length}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => void refreshPresetSamples()}
                          disabled={refreshingPresetSamples}
                        >
                          <RefreshCw
                            className={`size-3.5 ${refreshingPresetSamples ? 'animate-spin' : ''}`}
                          />
                          {refreshingPresetSamples ? '生成中' : '换一些'}
                        </Button>
                      </div>
                      <summary className="mt-2 cursor-pointer text-xs text-muted-foreground marker:text-muted-foreground">
                        查看示例
                      </summary>
                      <div className="mt-3 flex flex-col gap-2">
                        {selectedPresetSamples.map((samplePrompt, index) => (
                          <Button
                            key={`${selectedPreset?.id}-${index}`}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-auto w-full justify-start whitespace-normal rounded-lg px-3 py-2.5 text-left"
                            onClick={() => applyPresetSamplePrompt(samplePrompt)}
                            disabled={isBusy}
                          >
                            <span className="block w-full break-words whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">
                              {samplePrompt}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </section>

                <section
                  className="space-y-3 rounded-xl border border-border bg-muted/20 p-3"
                  aria-label="本次生成请求摘要"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">本次请求</span>
                    <Badge variant="outline">{usesReferenceInput ? '参考生图' : '文生图'}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">模型</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">
                        {selectedModel?.displayName || '尚未选择'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">输出</dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                        {quality} · {targetSize || '由模型确定'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">服务商</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">
                        {selectedModel?.provider || '尚未选择'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-muted-foreground">参考</dt>
                      <dd className="mt-0.5 truncate font-medium text-foreground">
                        {requestReferenceLabel}
                      </dd>
                    </div>
                  </dl>
                  {is4KRequest ? (
                    <p className="rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-2 text-xs leading-5 text-foreground">
                      4K 将按 {targetSize || '3840×2160'}{' '}
                      作为目标尺寸发起请求；有效结果按服务商实际返回像素保存。
                    </p>
                  ) : null}
                  <p className="text-xs leading-5 text-muted-foreground">
                    请求提交后，服务商可能已经按一次调用计费；失败任务不会自动重试或再次扣费。
                  </p>
                </section>

                {studioMode === 'canvas' ? (
                  <section className="space-y-2.5 border-t border-border/70 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="ai-image-prompt">画面描述</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPromptResourceQuery('');
                            setPromptResourcePickerOpen(true);
                          }}
                          disabled={isBusy}
                        >
                          <FileText />
                          插入描述
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setStyleRecognitionOpen(true)}
                          disabled={isBusy}
                        >
                          <ImageIcon />
                          识别风格
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStyleQuery('');
                            setStylePickerOpen(true);
                          }}
                          disabled={isBusy}
                        >
                          <WandSparkles />
                          视觉风格
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy || !prompt.trim()}
                          onClick={() => setPromptAssistantOpen(true)}
                        >
                          <Sparkles />
                          AI 扩写
                        </Button>
                      </div>
                    </div>
                    {selectedStyleProfile ? (
                      <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs text-foreground">
                        <WandSparkles className="size-3.5 text-primary" />
                        <span className="min-w-0 flex-1 truncate">
                          视觉风格：{selectedStyleProfile.name}
                        </span>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="shrink-0"
                          aria-label="恢复默认视觉风格"
                          onClick={() => setSelectedStyleProfile(null)}
                          disabled={isBusy}
                        >
                          <X />
                        </Button>
                      </div>
                    ) : null}
                    <Textarea
                      id="ai-image-prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder="例如：雨后的山谷里，一间亮着暖光的木屋，远处有薄雾和松林"
                      className="min-h-28 resize-y"
                      maxLength={MAX_IMAGE_PROMPT_LENGTH}
                      disabled={isBusy}
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {prompt.length}/{MAX_IMAGE_PROMPT_LENGTH}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3 border-t border-border/70 pt-4">
                  <Label>画面比例</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {aspectRatios.map((ratio) => (
                      <Button
                        key={ratio}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'transition-[background-color,border-color,box-shadow]',
                          aspectRatio === ratio && SELECTED_OPTION_CLASS,
                        )}
                        aria-pressed={aspectRatio === ratio}
                        onClick={() => setAspectRatio(ratio)}
                        disabled={isBusy}
                      >
                        {ratio}
                      </Button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="flex items-center gap-1.5">
                      <Monitor className="size-3.5 text-muted-foreground" />
                      目标分辨率
                    </Label>
                    {targetSize ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {targetSize}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {modelQualities.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'transition-[background-color,border-color,box-shadow]',
                          quality === item && SELECTED_OPTION_CLASS,
                        )}
                        aria-pressed={quality === item}
                        onClick={() => setQuality(item)}
                        disabled={isBusy}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                  {referenceQualityLimited ? (
                    <p className="text-xs text-muted-foreground">
                      {referenceCapabilityMaxQuality
                        ? `带参考图时当前最高支持 ${referenceCapabilityMaxQuality}`
                        : '当前模型暂不支持参考图高分辨率'}
                    </p>
                  ) : null}
                </section>

                <div className="space-y-2.5 border-t border-border/70 pt-4">
                  <ModelPicker
                    value={modelID}
                    onValueChange={handleImageModelChange}
                    onModelChange={setSelectedModel}
                    onUnavailableValue={handleUnavailableImageModel}
                    capability="image_generation"
                    label="图片模型"
                    autoSelectFirst
                  />

                  {selectedModel ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      当前模型可选目标分辨率：{modelQualities.join('、')}；结果会记录实际返回像素
                    </p>
                  ) : null}
                </div>

                {studioMode === 'conversation' ? (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">对话参考图</span>
                      <Badge variant="secondary">
                        {conversationReferenceMode === 'latest'
                          ? conversationReferenceGeneration
                            ? '跟随最新'
                            : '暂无参考图'
                          : conversationReferenceMode === 'locked'
                            ? conversationReferenceGeneration
                              ? '已锁定'
                              : '未选择图片'
                            : '不使用参考图'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'px-2 text-xs',
                          conversationReferenceMode === 'latest' && SELECTED_OPTION_CLASS,
                        )}
                        aria-pressed={conversationReferenceMode === 'latest'}
                        onClick={() => setConversationReferenceMode('latest')}
                        disabled={isBusy}
                      >
                        跟随最新
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'px-2 text-xs',
                          conversationReferenceMode === 'locked' && SELECTED_OPTION_CLASS,
                        )}
                        aria-pressed={conversationReferenceMode === 'locked'}
                        onClick={() => {
                          const fallback =
                            lockedConversationReference ||
                            latestConversationGeneration ||
                            conversationReferenceCandidates[0];
                          if (!fallback) {
                            toast.info('暂无可锁定的成功图片');
                            return;
                          }
                          setLockedConversationReferenceID(fallback.id);
                          setConversationReferenceMode('locked');
                        }}
                        disabled={isBusy || conversationReferenceCandidates.length === 0}
                      >
                        锁定图片
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(
                          'px-2 text-xs',
                          conversationReferenceMode === 'none' && SELECTED_OPTION_CLASS,
                        )}
                        aria-pressed={conversationReferenceMode === 'none'}
                        onClick={() => setConversationReferenceMode('none')}
                        disabled={isBusy}
                      >
                        不使用
                      </Button>
                    </div>
                    {conversationReferenceMode === 'locked' ? (
                      <div className="grid grid-cols-4 gap-2">
                        {conversationReferenceCandidates.map((generation) => (
                          <button
                            key={generation.id}
                            type="button"
                            className={cn(
                              'group relative aspect-square overflow-hidden rounded-md border border-border bg-background text-left transition-[border-color,box-shadow]',
                              generation.id === lockedConversationReferenceID &&
                                'border-primary ring-2 ring-primary/20',
                            )}
                            aria-pressed={generation.id === lockedConversationReferenceID}
                            aria-label={`锁定参考图 ${generation.model} ${generation.id}`}
                            onClick={() => setLockedConversationReferenceID(generation.id)}
                            disabled={isBusy}
                          >
                            <AIImageGenerationImage
                              generationId={generation.id}
                              src={generation.resultUrl}
                              alt="可选参考图"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs leading-5 text-muted-foreground">
                      {supportsReference
                        ? conversationReferenceGeneration
                          ? '后续消息将使用当前选择的图片作为参考。'
                          : '本轮将直接按文字生成图片。'
                        : '当前模型不支持参考图，会使用所选图片的文字描述继续生成。'}
                    </p>
                  </div>
                ) : hasCanvasContent && supportsReference ? (
                  <div
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5',
                      useCanvasReference && 'border-primary/30 bg-primary/5',
                    )}
                  >
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={useCanvasReference}
                        onCheckedChange={(checked) => setUseCanvasReference(checked === true)}
                        disabled={isBusy}
                      />
                      使用当前画布作为构图参考
                    </label>
                    {useCanvasReference ? <Badge variant="secondary">参考图已启用</Badge> : null}
                  </div>
                ) : hasCanvasContent ? (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm leading-5 text-destructive">
                    当前模型不支持参考图，将仅按文字生成。
                  </p>
                ) : (
                  <Badge variant="secondary">当前为文字生成图片</Badge>
                )}

                {missingRequiredReference ? (
                  <p className="text-sm leading-5 text-destructive">
                    草图成图需要选择支持参考图的模型，并启用当前画布。
                  </p>
                ) : null}

                {studioMode === 'canvas' ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full shadow-sm"
                    onClick={() => void handleGenerate()}
                    disabled={isBusy || !prompt.trim() || !modelID || missingRequiredReference}
                  >
                    {isBusy ? (
                      <Sparkles className="animate-pulse motion-reduce:animate-none" />
                    ) : (
                      <WandSparkles />
                    )}
                    {creating ? '正在创建任务' : isGenerating ? '正在生成' : '生成图片'}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        <section data-testid="ai-image-history" className="relative mt-9 min-h-48">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                <LibraryBig className="size-4" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-foreground">创作历史</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">图片规格、模型与常用操作。</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Select
                value={historyStatusFilter}
                onValueChange={(value) =>
                  setHistoryFilters({ status: parseHistoryStatusFilter(value) })
                }
              >
                <SelectTrigger size="sm" className="w-30" aria-label="按生成状态筛选创作历史">
                  <SelectValue>{HISTORY_STATUS_LABELS[historyStatusFilter]}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="succeeded">已完成</SelectItem>
                  <SelectItem value="active">生成中</SelectItem>
                  <SelectItem value="failed">生成失败</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={historyModelFilter}
                onValueChange={(value) => setHistoryFilters({ model: value || 'all' })}
              >
                <SelectTrigger size="sm" className="w-52" aria-label="按图片模型筛选创作历史">
                  <SelectValue>{selectedHistoryModelLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">全部模型</SelectItem>
                  {historyModelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={favoritesOnly ? 'secondary' : 'outline'}
                size="sm"
                className="gap-1.5"
                aria-pressed={favoritesOnly}
                onClick={() => setHistoryFilters({ favoritesOnly: !favoritesOnly })}
              >
                <Heart
                  className={cn('size-3.5', favoritesOnly && 'fill-current')}
                  aria-hidden="true"
                />
                仅看收藏
              </Button>
              <Badge variant="outline">{visibleHistory.length} 条</Badge>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: HISTORY_CARD_SKELETON_COUNT }).map((_, index) => (
                <HistoryCardSkeleton key={index} />
              ))}
            </div>
          ) : !loading && visibleHistory.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
                <LibraryBig className="size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">还没有生成记录</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  完成第一张图片后，结果会出现在这里。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {pagedHistory.map((generation) => {
                const statusIsFailed = generation.status === 'failed';
                const statusIsPaused = generation.status === 'paused';
                const statusIsTerminal = statusIsFailed || statusIsPaused;
                const statusIsReady = generation.status === 'succeeded' && generation.resultUrl;
                const failureRecovery = statusIsFailed ? getGenerationRecovery(generation) : null;
                const resultSizeText =
                  generation.resultWidth > 0 && generation.resultHeight > 0
                    ? `${generation.resultWidth} × ${generation.resultHeight}`
                    : '';
                const recipeLabel =
                  generation.presetName ||
                  presets.find((preset) => preset.id === generation.presetId)?.name ||
                  generation.presetId;
                const statusBadgeVariant = statusIsFailed ? 'destructive' : 'secondary';
                return (
                  <Card
                    key={generation.id}
                    size="sm"
                    data-ai-history-card
                    className="group/card flex min-h-0 flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md"
                  >
                    <div className="relative flex aspect-[4/3] min-h-40 items-center justify-center overflow-hidden border-b border-border/70 bg-muted/30">
                      {generation.resultUrl ? (
                        <button
                          type="button"
                          className="group h-full w-full cursor-zoom-in outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-inset"
                          onClick={() =>
                            setHistoryPreview({
                              src: generation.resultUrl,
                              title: `${generation.model || '生成图片'} · ${
                                resultSizeText || generation.quality
                              }`,
                            })
                          }
                          aria-label="预览生成图片"
                        >
                          <AIImageGenerationImage
                            generationId={generation.id}
                            src={generation.resultUrl}
                            alt="AI 生成图片"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            loading="lazy"
                          />
                        </button>
                      ) : statusIsTerminal ? (
                        <div className="space-y-3 px-5 text-center">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              statusIsFailed ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {statusIsFailed
                              ? failureRecovery?.title || '生成失败'
                              : STATUS_LABELS[generation.status]}
                          </p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {statusIsFailed
                              ? generation.errorMessage || failureRecovery?.description
                              : '本次生成已暂停，可调整参数后再次创作。'}
                          </p>
                        </div>
                      ) : (
                        <GenerationPreview
                          stage={generation.stage}
                          generation={generation}
                          className="ai-image-generation-card-preview"
                        />
                      )}
                      <Badge
                        variant={statusBadgeVariant}
                        className={cn(
                          'absolute top-2 left-2',
                          statusIsFailed ? 'bg-destructive/10 text-destructive' : '',
                        )}
                      >
                        {STATUS_LABELS[generation.status]}
                      </Badge>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute top-2 right-2 z-10 bg-background/90 shadow-xs backdrop-blur-sm"
                        onClick={() => void updateGenerationFavorite(generation)}
                        disabled={favoriteUpdatingID === generation.id}
                        aria-label={generation.isFavorited ? '取消收藏图片' : '收藏图片'}
                        title={generation.isFavorited ? '取消收藏' : '收藏'}
                      >
                        <Heart
                          className={cn(
                            'size-3.5',
                            generation.isFavorited && 'fill-current text-primary',
                          )}
                        />
                      </Button>
                    </div>
                    <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-semibold text-foreground"
                            title={generation.model}
                          >
                            {generation.model || '图片模型'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(generation.createdAt)} · {generation.quality}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {generation.referenceCount > 0 ? (
                            <Badge variant="outline" className="px-2 text-[10px]">
                              参考图
                            </Badge>
                          ) : null}
                          {generation.parentGenerationId ? (
                            <Badge variant="outline" className="gap-1 px-2 text-[10px]">
                              <GitBranch className="size-3" />
                              派生版本
                            </Badge>
                          ) : null}
                          {generation.resourceId ? (
                            <Badge variant="outline" className="px-2 text-[10px]">
                              已保存
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] text-muted-foreground">实际尺寸</p>
                          <p className="mt-0.5 truncate text-xs font-medium tabular-nums text-foreground">
                            {resultSizeText || generation.requestedSize || '处理中'}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] text-muted-foreground">画面比例</p>
                          <p className="mt-0.5 truncate text-xs font-medium tabular-nums text-foreground">
                            {generation.aspectRatio}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] text-muted-foreground">服务</p>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            {generation.provider}
                          </p>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
                          <p className="text-[10px] text-muted-foreground">创作类型</p>
                          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                            {recipeLabel}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2 border-t border-border pt-3">
                        {failureRecovery ? (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {failureRecovery.description}
                          </p>
                        ) : null}
                        <div className="flex min-w-0 items-center gap-2">
                          {statusIsReady ? (
                            <Button
                              type="button"
                              size="sm"
                              className="min-w-0 flex-1"
                              onClick={() => startGenerationVariant(generation)}
                              disabled={isBusy || !supportsReference}
                              title={
                                supportsReference
                                  ? '基于这张图片创建新版本'
                                  : '请先选择支持参考图的图片模型'
                              }
                            >
                              <WandSparkles />
                              <span className="truncate">基于此图</span>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant={statusIsReady ? 'outline' : 'default'}
                            size="sm"
                            className="min-w-0 flex-1"
                            onClick={() => void reuseGeneration(generation)}
                            disabled={isBusy}
                            title={
                              statusIsTerminal ? '仅恢复原参数，不会自动再次调用模型' : undefined
                            }
                          >
                            <RefreshCw />
                            <span className="truncate">
                              {statusIsTerminal ? '恢复参数' : '再次创作'}
                            </span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="shrink-0"
                                  aria-label="更多图片操作"
                                  title="更多图片操作"
                                >
                                  <MoreHorizontal />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-44">
                              {statusIsReady ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      window.open(
                                        generation.resultUrl,
                                        '_blank',
                                        'noopener,noreferrer',
                                      )
                                    }
                                  >
                                    <Download />
                                    下载
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setHistoryPreview({
                                        src: generation.resultUrl,
                                        title: `${generation.model || '生成图片'} · ${
                                          resultSizeText || generation.quality
                                        }`,
                                      })
                                    }
                                  >
                                    <Eye />
                                    预览
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setSaveTarget(generation)}
                                    disabled={
                                      Boolean(generation.resourceId) || savingID === generation.id
                                    }
                                  >
                                    <Save />
                                    {generation.resourceId ? '已保存到资源库' : '保存到资源库'}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {statusIsReady ? <DropdownMenuSeparator /> : null}
                              <DropdownMenuItem onClick={() => setHistoryDetailTarget(generation)}>
                                <Info />
                                详情
                              </DropdownMenuItem>
                              {generation.parentGenerationId ? (
                                <DropdownMenuItem
                                  onClick={() => void previewParentGeneration(generation)}
                                >
                                  <GitBranch />
                                  查看来源
                                </DropdownMenuItem>
                              ) : null}
                              {generation.canvasSnapshotUrl ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setHistoryPreview({
                                      src: generation.canvasSnapshotUrl,
                                      title: '历史画布快照',
                                    })
                                  }
                                >
                                  <ImageIcon />
                                  画布快照
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(generation)}
                                disabled={
                                  deletingID === generation.id ||
                                  savingID === generation.id ||
                                  generation.status === 'queued' ||
                                  generation.status === 'running'
                                }
                              >
                                <Trash2 />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {visibleHistory.length > 0 && totalHistoryPages > 1 ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
              <div className="text-sm text-muted-foreground">
                显示 {historyStart}-{historyEnd} / {visibleHistory.length} 条
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeHistoryPage <= 1}
                  onClick={() => setHistoryPage(safeHistoryPage - 1)}
                >
                  上一页
                </Button>
                <span className="inline-flex min-w-14 justify-center rounded-md border border-border bg-muted/60 px-3 py-1 text-xs text-foreground">
                  {safeHistoryPage} / {totalHistoryPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeHistoryPage >= totalHistoryPages}
                  onClick={() => setHistoryPage(safeHistoryPage + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <Sheet open={conversationHistoryOpen} onOpenChange={setConversationHistoryOpen}>
        <SheetContent side="left" className="w-full gap-0 overflow-hidden p-0 sm:max-w-sm">
          <SheetHeader className="shrink-0 border-b border-border pr-12">
            <SheetTitle>历史对话</SheetTitle>
            <SheetDescription>{conversations.length} 个图片对话</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1.5 p-3">
              {conversations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <MessageCircle className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">还没有历史对话</p>
                </div>
              ) : (
                conversations.map((conversationItem) => (
                  <Button
                    key={conversationItem.id}
                    type="button"
                    variant={conversationItem.id === conversationID ? 'secondary' : 'ghost'}
                    className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-3 text-left font-normal"
                    onClick={() => void selectConversation(conversationItem)}
                    disabled={isBusy}
                    aria-current={conversationItem.id === conversationID ? 'page' : undefined}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border/70">
                      <MessageCircle className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {conversationItem.title}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDateTime(conversationItem.updatedAt)}
                      </span>
                    </span>
                    {conversationItem.id === conversationID ? (
                      <Badge variant="secondary" className="shrink-0">
                        当前
                      </Badge>
                    ) : null}
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <Dialog open={promptResourcePickerOpen} onOpenChange={setPromptResourcePickerOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>选择提示词资源</DialogTitle>
            <DialogDescription>生图标签优先展示，其他提示词仍可选择。</DialogDescription>
          </DialogHeader>
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={promptResourceQuery}
                onChange={(event) => setPromptResourceQuery(event.target.value)}
                className="pl-9"
                placeholder="搜索名称、描述或标签"
              />
            </div>
          </div>
          <ScrollArea className="max-h-[min(32rem,70vh)]">
            <div className="space-y-2 p-4">
              {promptResourcesLoading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : visiblePromptResources.length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    {promptResources.length === 0 ? '还没有可用提示词' : '没有匹配的提示词'}
                  </p>
                </div>
              ) : (
                visiblePromptResources.map((promptResource) => (
                  <Button
                    key={promptResource.id}
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start px-3 py-3 text-left font-normal"
                    onClick={() => applyPromptResource(promptResource)}
                    disabled={isBusy}
                  >
                    <span className="min-w-0 space-y-1 text-left">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                          {promptResource.name}
                        </span>
                        {promptResource.tags.includes('生图') ? (
                          <Badge variant="secondary">推荐</Badge>
                        ) : null}
                      </span>
                      {promptResource.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {promptResource.description}
                        </span>
                      ) : null}
                      <span className="block line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {promptResource.content}
                      </span>
                      <span className="flex flex-wrap items-center gap-1 pt-1">
                        {promptResource.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                        {promptResource.sourceUrl ? (
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            GitHub · {promptResource.sourceAuthor || '链接导入'}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <Dialog open={stylePickerOpen} onOpenChange={setStylePickerOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle>视觉风格</DialogTitle>
            <DialogDescription>风格只调整色彩、材质、光线与渲染语言。</DialogDescription>
          </DialogHeader>
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={styleQuery}
                onChange={(event) => setStyleQuery(event.target.value)}
                className="pl-9"
                placeholder="搜索视觉风格"
              />
            </div>
          </div>
          <ScrollArea className="max-h-[min(28rem,65vh)]">
            <div className="space-y-2 p-4">
              <Button
                type="button"
                variant={selectedStyleProfile ? 'outline' : 'secondary'}
                aria-pressed={!selectedStyleProfile}
                className="h-auto w-full items-start justify-start px-3 py-2.5 text-left font-normal"
                onClick={() => {
                  setSelectedStyleProfile(null);
                  setStylePickerOpen(false);
                }}
                disabled={isBusy}
              >
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <WandSparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">默认风格</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      不添加额外视觉风格
                    </span>
                  </span>
                </span>
                {!selectedStyleProfile ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="已选中" />
                ) : null}
              </Button>
              {visibleStyleProfiles.length === 0 ? (
                <div className="py-10 text-center">
                  <WandSparkles className="mx-auto size-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">没有匹配的视觉风格</p>
                </div>
              ) : (
                visibleStyleProfiles.map((profile) => (
                  <Button
                    key={profile.id}
                    type="button"
                    variant={selectedStyleProfile?.id === profile.id ? 'secondary' : 'outline'}
                    aria-pressed={selectedStyleProfile?.id === profile.id}
                    className="h-auto w-full items-start justify-start px-3 py-2.5 text-left font-normal !whitespace-normal"
                    onClick={() => selectStyleProfile(profile)}
                    disabled={isBusy}
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
                      <WandSparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {profile.name}
                          </span>
                          <Badge variant="outline" className="shrink-0">
                            {profile.source === 'skill' ? '已安装' : '内置'}
                          </Badge>
                        </span>
                        <span
                          className="mt-1 block overflow-hidden !whitespace-normal break-words text-xs leading-5 text-muted-foreground"
                          style={{
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }}
                        >
                          {profile.description || '未提供风格说明'}
                        </span>
                      </span>
                    </span>
                    {selectedStyleProfile?.id === profile.id ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="已选中" />
                    ) : null}
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <StyleRecognitionDialog
        open={styleRecognitionOpen}
        onOpenChange={setStyleRecognitionOpen}
        onApply={applyRecognizedStyle}
        onPromptSaved={(savedPrompt) => {
          setPromptResources((current) => [
            savedPrompt,
            ...current.filter((item) => item.id !== savedPrompt.id),
          ]);
        }}
      />
      <AlertDialog
        open={Boolean(pendingPromptResource)}
        onOpenChange={(open) => {
          if (!open) setPendingPromptResource(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>填入提示词</AlertDialogTitle>
            <AlertDialogDescription>
              当前已有画面描述，请选择如何填入“{pendingPromptResource?.name}”。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (pendingPromptResource) commitPromptResource(pendingPromptResource, 'append');
              }}
            >
              追加
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (pendingPromptResource) commitPromptResource(pendingPromptResource, 'replace');
              }}
            >
              替换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PromptAssistantDialog
        open={promptAssistantOpen}
        onOpenChange={setPromptAssistantOpen}
        target="image_studio"
        field="image_prompt"
        currentPrompt={prompt}
        onReplace={(suggestion) => setPrompt(suggestion.optimizedPrompt)}
      />
      <ImagePreviewDialog
        open={Boolean(historyPreview)}
        src={historyPreview?.src}
        title={historyPreview?.title}
        onOpenChange={(open) => {
          if (!open) setHistoryPreview(undefined);
        }}
      />
      <Dialog
        open={Boolean(variantSource)}
        onOpenChange={(open) => {
          if (!open && !creating) {
            setVariantSource(null);
            setVariantInstruction('');
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          {variantSource ? (
            <>
              <DialogHeader className="border-b border-border px-5 py-4 pr-12">
                <DialogTitle>基于原图创作</DialogTitle>
                <DialogDescription>保留原图的主体关系，生成一个新的版本。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 p-5">
                <div className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <AIImageGenerationImage
                    generationId={variantSource.id}
                    src={variantSource.resultUrl}
                    alt="作为参考的原图"
                    className="size-16 shrink-0 rounded-md border border-border object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {variantSource.model || '图片模型'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {variantSource.resultWidth > 0 && variantSource.resultHeight > 0
                        ? `${variantSource.resultWidth} × ${variantSource.resultHeight}`
                        : variantSource.quality}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-image-variant-instruction">修改要求</Label>
                  <Textarea
                    id="ai-image-variant-instruction"
                    value={variantInstruction}
                    onChange={(event) => setVariantInstruction(event.target.value)}
                    placeholder="例如：保留人物姿态，将背景改为雨夜街景，补充电影感灯光。"
                    className="min-h-28 resize-y"
                    maxLength={1200}
                    disabled={creating}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-muted-foreground">当前模型</p>
                    <p className="mt-1 truncate font-medium text-foreground">
                      {selectedModel?.displayName || '未选择'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground">输出设置</p>
                    <p className="mt-1 truncate font-medium text-foreground">
                      {quality} · {aspectRatio} · {targetSize || '自动'}
                    </p>
                  </div>
                </div>
                {!variantQualitySupported ? (
                  <p className="text-xs leading-5 text-destructive">
                    当前模型或清晰度不支持参考图创作，请先调整右侧设置。
                  </p>
                ) : null}
              </div>
              <DialogFooter className="border-t border-border px-5 py-4 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setVariantSource(null);
                    setVariantInstruction('');
                  }}
                  disabled={creating}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={() => void createGenerationVariant()}
                  disabled={!variantInstruction.trim() || creating || !variantQualitySupported}
                >
                  <WandSparkles />
                  {creating ? '正在创建任务' : '创建新版本'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Sheet
        open={Boolean(historyDetailTarget)}
        onOpenChange={(open) => {
          if (!open && !favoriteUpdatingID) setHistoryDetailTarget(null);
        }}
      >
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
          {historyDetailTarget ? (
            <>
              <SheetHeader className="border-b border-border pr-12">
                <SheetTitle>生成详情</SheetTitle>
                <SheetDescription>仅展示本次生成的技术信息，不展示提示词。</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {historyDetailTarget.resultUrl ? (
                  <button
                    type="button"
                    className="group relative block w-full overflow-hidden rounded-lg border border-border bg-muted/30 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() =>
                      setHistoryPreview({
                        src: historyDetailTarget.resultUrl,
                        title: `${historyDetailTarget.model || '生成图片'} · ${
                          historyDetailTarget.resultWidth > 0 &&
                          historyDetailTarget.resultHeight > 0
                            ? `${historyDetailTarget.resultWidth} × ${historyDetailTarget.resultHeight}`
                            : historyDetailTarget.quality
                        }`,
                      })
                    }
                    aria-label="预览生成图片"
                  >
                    <AIImageGenerationImage
                      generationId={historyDetailTarget.id}
                      src={historyDetailTarget.resultUrl}
                      alt="AI 生成图片"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.015] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  </button>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
                    {STATUS_LABELS[historyDetailTarget.status]}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {historyDetailTarget.model || '图片模型'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(historyDetailTarget.createdAt)} 创建
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        historyDetailTarget.status === 'failed' ? 'destructive' : 'secondary'
                      }
                    >
                      {STATUS_LABELS[historyDetailTarget.status]}
                    </Badge>
                    <Button
                      type="button"
                      variant={historyDetailTarget.isFavorited ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => void updateGenerationFavorite(historyDetailTarget)}
                      disabled={favoriteUpdatingID === historyDetailTarget.id}
                    >
                      <Heart
                        className={cn(
                          'size-3.5',
                          historyDetailTarget.isFavorited && 'fill-current text-primary',
                        )}
                      />
                      {historyDetailTarget.isFavorited ? '已收藏' : '收藏'}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    {
                      label: '实际尺寸',
                      value:
                        historyDetailTarget.resultWidth > 0 && historyDetailTarget.resultHeight > 0
                          ? `${historyDetailTarget.resultWidth} × ${historyDetailTarget.resultHeight}`
                          : '处理中',
                    },
                    { label: '目标尺寸', value: historyDetailTarget.requestedSize || '未记录' },
                    { label: '画面比例', value: historyDetailTarget.aspectRatio || '未记录' },
                    { label: '目标清晰度', value: historyDetailTarget.quality || '未记录' },
                    { label: '模型服务', value: historyDetailTarget.provider || '未记录' },
                    {
                      label: '创作类型',
                      value:
                        historyDetailTarget.presetName ||
                        presets.find((preset) => preset.id === historyDetailTarget.presetId)
                          ?.name ||
                        historyDetailTarget.presetId ||
                        '未记录',
                    },
                    {
                      label: '视觉风格',
                      value: historyDetailTarget.skillName || '默认风格',
                    },
                    { label: '参考内容', value: `${historyDetailTarget.referenceCount} 项` },
                    { label: '文件大小', value: formatByteSize(historyDetailTarget.resultSize) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                    >
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p
                        className="mt-0.5 truncate text-xs font-medium text-foreground"
                        title={item.value}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">版本来源</span>
                    <span className="font-medium text-foreground">
                      {historyDetailTarget.parentGenerationId ? '派生自历史图片' : '独立创作'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">完成时间</span>
                    <span className="font-medium text-foreground">
                      {historyDetailTarget.finishedAt
                        ? formatDateTime(historyDetailTarget.finishedAt)
                        : '尚未完成'}
                    </span>
                  </div>
                  {historyDetailTarget.status === 'failed' ||
                  historyDetailTarget.status === 'paused' ? (
                    <div className="border-t border-border pt-2 text-muted-foreground">
                      {historyDetailTarget.status === 'paused'
                        ? '本次生成已暂停，可恢复参数后再次提交。'
                        : historyDetailTarget.errorMessage ||
                          '本次生成未完成，可恢复参数后再次提交。'}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <SaveResourceDialog
        open={Boolean(saveTarget)}
        onOpenChange={(open) => {
          if (!open && !savingID) {
            setSaveTarget(null);
            setSaveError(undefined);
            setSaveModelName(undefined);
          }
        }}
        pending={Boolean(savingID)}
        progress={saveProgress}
        modelName={saveModelName}
        error={saveError}
        onConfirm={(visibility) =>
          saveTarget ? saveToResources(saveTarget, visibility) : undefined
        }
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingID) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条图片历史？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将移除这条生成记录及其历史图片，无法恢复。已保存到资源库的副本不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingID)}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={Boolean(deletingID)}
              onClick={() => void deleteGeneration()}
            >
              {deletingID ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
