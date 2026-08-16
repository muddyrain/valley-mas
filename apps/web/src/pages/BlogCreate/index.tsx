import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileUp,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { createAIImageGeneration, getAIImageGeneration } from '@/api/aiImages';
import {
  createGroup,
  createPost,
  type ExternalCoverImage,
  type Group,
  generateBlogExcerpt,
  getAdminGroups,
  getAdminPostDetail,
  pickBlogCoverFromResources,
  triggerUnsplashDownload,
  updatePost,
  uploadBlogCover,
  uploadBlogCoverByUrl,
  type Visibility,
} from '@/api/blog';
import type { Resource } from '@/api/resource';
import BlockingLoadingSurface from '@/components/BlockingLoadingSurface';
import { BLOG_COVER_OUTPUT_HEIGHT, BLOG_COVER_OUTPUT_WIDTH } from '@/components/blog';
import {
  AICoverAssistantDialog,
  type AICoverAssistantPayload,
  BLOG_COVER_AI_ASPECT_RATIO,
  BLOG_COVER_AI_QUALITY,
} from '@/components/blog/AICoverAssistantDialog';
import { BlogCoverPreview } from '@/components/blog/BlogCoverPreview';
import { CoverCropDialog } from '@/components/blog/CoverCropDialog';
import { CoverPickerDialog } from '@/components/blog/CoverPickerDialog';
import { MdxMarkdownEditor } from '@/components/blog/MdxMarkdownEditor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { createAutoExcerpt, parseMarkdownImport } from '@/utils/blogImport';
import { navigateBackOrFallback } from '@/utils/navigation';
import { buildBlogCoverSubjectContext } from './blogCoverGeneration';
import {
  clearBlogCoverGenerationRecovery,
  readBlogCoverGenerationRecovery,
  writeBlogCoverGenerationRecovery,
} from './blogCoverGenerationRecovery';
import {
  clearStudioArticleDraft,
  readStudioArticleDraft,
  writeStudioArticleDraft,
} from './studioArticleDraft';
import { waitNextPaint } from './utils';

type CoverImageMeta = {
  width: number;
  height: number;
};

type CoverRecoveryTransition = {
  previousSrc: string;
  revealCurrent: boolean;
};

const BLOG_EDITOR_HEADING_OPTIONS = [
  { label: '正文', level: null },
  { label: '标题 1', level: 1 },
  { label: '标题 2', level: 2 },
  { label: '标题 3', level: 3 },
  { label: '标题 4', level: 4 },
];
const BLOG_COVER_AI_RECIPE_ID = 'cover';
const BLOG_COVER_AI_POLL_INTERVAL_MS = 1500;
const BLOG_COVER_AI_POLL_ERROR_INTERVAL_MS = 3000;
const BLOG_COVER_AI_POLL_TIMEOUT_MS = 120000;
const BLOG_COVER_RECOVERY_TRANSITION_MS = 500;
const BLOG_COVER_RECOVERY_NOTICE_MS = 3200;

async function preloadCoverImage(src: string) {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    // The preview still gets a chance to load through the browser's regular image pipeline.
  }
}

export default function BlogCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editingId } = useParams<{ id?: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const isEditMode = Boolean(editingId);
  const navigationState = (location.state as {
    returnTo?: string;
    returnLabel?: string;
    refreshPostsAt?: number;
    generatedCover?: string;
    generatedCoverId?: string;
  } | null) ?? { returnTo: '', returnLabel: '' };
  const returnTo = navigationState.returnTo || '/studio/articles';
  const returnLabel = navigationState.returnLabel || '返回';
  const generatedCover = navigationState.generatedCover?.trim() || '';
  const [loadedPostStatus, setLoadedPostStatus] = useState<'draft' | 'published' | 'archived'>(
    'draft',
  );

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [cover, setCover] = useState('');
  const [coverStorageKey, setCoverStorageKey] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverObjectUrl, setCoverObjectUrl] = useState('');
  const [pendingCoverRemoteUrl, setPendingCoverRemoteUrl] = useState('');
  const [coverImageMeta, setCoverImageMeta] = useState<CoverImageMeta | null>(null);
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverOffsetX, setCoverOffsetX] = useState(0);
  const [coverOffsetY, setCoverOffsetY] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'draft' | 'published' | null>(null);
  const [aiExcerptLoading, setAiExcerptLoading] = useState(false);
  const [aiCoverLoading, setAiCoverLoading] = useState(false);
  const [aiCoverSource, setAiCoverSource] = useState<'manual' | 'import'>('manual');
  const [recoveringCover, setRecoveringCover] = useState(false);
  const [coverRecoveryTransition, setCoverRecoveryTransition] =
    useState<CoverRecoveryTransition | null>(null);
  const [showCoverRecoveryNotice, setShowCoverRecoveryNotice] = useState(false);
  const [importingMarkdown, setImportingMarkdown] = useState(false);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [loadingPost, setLoadingPost] = useState(false);
  const [loadedEditorScope, setLoadedEditorScope] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [pendingCropUrl, setPendingCropUrl] = useState('');
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const [aiPickLoading, setAiPickLoading] = useState(false);
  const [aiPickExcludedIds, setAiPickExcludedIds] = useState<string[]>([]);
  const [pendingUnsplashDownloadLocation, setPendingUnsplashDownloadLocation] = useState('');
  const currentEditingIdRef = useRef<string | undefined>(editingId);

  const coverViewportRef = useRef<HTMLDivElement | null>(null);
  const markdownImportInputRef = useRef<HTMLInputElement | null>(null);
  const aiCoverGenerationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverRecoveryTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverRecoveryNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiCoverGenerationSessionRef = useRef(0);
  const recoveredEditorScopeRef = useRef('');
  const restoredArticleDraftScopeRef = useRef('');

  useEffect(() => {
    currentEditingIdRef.current = editingId;
  }, [editingId]);

  const loadGroups = useCallback(async () => {
    try {
      const list = await getAdminGroups({ groupType: 'blog' });
      setGroups(list || []);
    } catch {
      toast.error('加载专栏失败');
    }
  }, []);

  const loadPost = useCallback(
    async (postId: string) => {
      try {
        setLoadingPost(true);
        const detail = await getAdminPostDetail(postId);
        if (currentEditingIdRef.current !== postId) return;
        if (detail.postType !== 'blog') {
          toast.error('当前文章需要使用兼容编辑器打开');
          navigate('/studio/articles');
          return;
        }
        setTitle(detail.title || '');
        setExcerpt(detail.excerpt || '');
        setCover(detail.cover || '');
        setCoverStorageKey(detail.coverStorageKey || '');
        setPendingCoverRemoteUrl('');
        setPendingUnsplashDownloadLocation('');
        setAiPickExcludedIds([]);
        setContent(detail.content || '');
        setGroupId(detail.groupId || '');
        setVisibility(detail.visibility || 'public');
        setLoadedPostStatus(detail.status || 'draft');
        setLoadedEditorScope(postId);
      } catch {
        toast.error('加载文章失败');
        navigate('/studio/articles');
      } finally {
        if (currentEditingIdRef.current === postId) {
          setLoadingPost(false);
        }
      }
    },
    [navigate],
  );

  useEffect(() => {
    // 清理旧编辑器遗留的单键草稿，新的创作室草稿按用户和文章隔离。
    if (!isEditMode) {
      try {
        localStorage.removeItem('valley-blog-create-draft-v3');
      } catch {
        // 浏览器禁用存储时仍允许继续创作和生成封面。
      }
    }
  }, [isEditMode]);

  useEffect(() => {
    return () => {
      if (coverObjectUrl) {
        URL.revokeObjectURL(coverObjectUrl);
      }
    };
  }, [coverObjectUrl]);

  useEffect(() => {
    return () => {
      if (aiCoverGenerationTimerRef.current) {
        window.clearTimeout(aiCoverGenerationTimerRef.current);
      }
      if (coverRecoveryTransitionTimerRef.current) {
        window.clearTimeout(coverRecoveryTransitionTimerRef.current);
      }
      if (coverRecoveryNoticeTimerRef.current) {
        window.clearTimeout(coverRecoveryNoticeTimerRef.current);
      }
      aiCoverGenerationSessionRef.current += 1;
    };
  }, []);

  const resetLocalCoverEditing = useCallback(() => {
    setCoverFile(null);
    setCoverObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return '';
    });
    setCoverImageMeta(null);
    setCoverZoom(1);
    setCoverOffsetX(0);
    setCoverOffsetY(0);
  }, []);

  const resetCreateForm = useCallback(() => {
    setTitle('');
    setExcerpt('');
    setCover('');
    setCoverStorageKey('');
    setPendingCoverRemoteUrl('');
    setPendingUnsplashDownloadLocation('');
    setAiPickExcludedIds([]);
    setContent('');
    setVisibility('public');
    setGroupId('');
    setLoadingPost(false);
    setLoadedPostStatus('draft');
    setLoadedEditorScope('new');
    resetLocalCoverEditing();
  }, [resetLocalCoverEditing]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    void loadGroups();
    if (editingId) {
      setLoadedEditorScope('');
      void loadPost(editingId);
    } else {
      resetCreateForm();
      const restoreScope = `${user?.id || 'anonymous'}:new`;
      if (user?.id && restoredArticleDraftScopeRef.current !== restoreScope) {
        restoredArticleDraftScopeRef.current = restoreScope;
        const restored = readStudioArticleDraft(localStorage, user.id, 'new');
        if (restored) {
          setTitle(restored.title);
          setContent(restored.content);
          setExcerpt(restored.excerpt);
          setGroupId(restored.groupId);
          setVisibility(restored.visibility);
          setCover(restored.cover);
          if (restored.cover) setPendingCoverRemoteUrl(restored.cover);
          toast.info('已恢复自动保存的文章');
        }
      }
      if (generatedCover) {
        setCover(generatedCover);
        setCoverStorageKey('');
        setPendingCoverRemoteUrl(generatedCover);
      }
    }
  }, [
    editingId,
    generatedCover,
    isAuthenticated,
    loadGroups,
    loadPost,
    navigate,
    resetCreateForm,
    user?.id,
  ]);

  const editorRecoveryScope = editingId || 'new';

  const clearAutoSavedArticle = useCallback(() => {
    if (!user?.id) return;
    clearStudioArticleDraft(localStorage, user.id, editorRecoveryScope);
    setAutoSaveState('idle');
  }, [editorRecoveryScope, user?.id]);

  const handleResetCreateForm = useCallback(() => {
    if (isEditMode) return;
    resetCreateForm();
    clearAutoSavedArticle();
    setShowCreateGroup(false);
    setNewGroupName('');
    setNewGroupDesc('');
    toast.success('已清空草稿');
  }, [clearAutoSavedArticle, isEditMode, resetCreateForm]);

  useEffect(() => {
    if (!user?.id || !loadedEditorScope || loadingPost) return;
    if (!title.trim() && !content.trim() && !cover.trim()) return;
    setAutoSaveState('saving');
    const timeoutId = window.setTimeout(() => {
      try {
        writeStudioArticleDraft(localStorage, user.id, editorRecoveryScope, {
          title,
          content,
          excerpt,
          groupId,
          visibility,
          cover: coverObjectUrl || cover,
          savedAt: Date.now(),
        });
        setAutoSaveState('saved');
      } catch {
        setAutoSaveState('idle');
      }
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [
    content,
    cover,
    coverObjectUrl,
    editorRecoveryScope,
    excerpt,
    groupId,
    loadedEditorScope,
    loadingPost,
    title,
    user?.id,
    visibility,
  ]);

  const rememberCoverGeneration = useCallback(
    (generationId: string) => {
      if (!user?.id) return;
      writeBlogCoverGenerationRecovery(localStorage, user.id, editorRecoveryScope, {
        generationId,
        createdAt: Date.now(),
      });
    },
    [editorRecoveryScope, user?.id],
  );

  const clearRememberedCoverGeneration = useCallback(() => {
    if (!user?.id) return;
    clearBlogCoverGenerationRecovery(localStorage, user.id, editorRecoveryScope);
  }, [editorRecoveryScope, user?.id]);

  const resetCoverRecoveryFeedback = useCallback(() => {
    if (coverRecoveryTransitionTimerRef.current) {
      window.clearTimeout(coverRecoveryTransitionTimerRef.current);
      coverRecoveryTransitionTimerRef.current = null;
    }
    if (coverRecoveryNoticeTimerRef.current) {
      window.clearTimeout(coverRecoveryNoticeTimerRef.current);
      coverRecoveryNoticeTimerRef.current = null;
    }
    setCoverRecoveryTransition(null);
    setShowCoverRecoveryNotice(false);
  }, []);

  useEffect(() => {
    if (editorRecoveryScope) resetCoverRecoveryFeedback();
  }, [editorRecoveryScope, resetCoverRecoveryFeedback]);

  const discardCoverGeneration = useCallback(() => {
    clearRememberedCoverGeneration();
    resetCoverRecoveryFeedback();
    aiCoverGenerationSessionRef.current += 1;
    if (aiCoverGenerationTimerRef.current) {
      window.clearTimeout(aiCoverGenerationTimerRef.current);
      aiCoverGenerationTimerRef.current = null;
    }
    setAiCoverLoading(false);
    setAiCoverSource('manual');
    setRecoveringCover(false);
  }, [clearRememberedCoverGeneration, resetCoverRecoveryFeedback]);

  const applyGeneratedCover = useCallback(
    (resultUrl: string) => {
      resetLocalCoverEditing();
      setCover(resultUrl);
      setCoverStorageKey('');
      setPendingCoverRemoteUrl(resultUrl);
      setPendingUnsplashDownloadLocation('');
    },
    [resetLocalCoverEditing],
  );

  const monitorCoverGeneration = useCallback(
    async (generationId: string, options: { source: 'manual' | 'import'; recovered?: boolean }) => {
      const sessionId = ++aiCoverGenerationSessionRef.current;
      let recoveredCoverReady = false;
      if (aiCoverGenerationTimerRef.current) {
        window.clearTimeout(aiCoverGenerationTimerRef.current);
        aiCoverGenerationTimerRef.current = null;
      }

      resetCoverRecoveryFeedback();
      setAiCoverSource(options.source);
      setRecoveringCover(Boolean(options.recovered));
      setAiCoverLoading(true);
      const startedAt = Date.now();

      try {
        await new Promise<void>((resolve) => {
          const poll = async () => {
            if (sessionId !== aiCoverGenerationSessionRef.current) {
              resolve();
              return;
            }

            if (Date.now() - startedAt >= BLOG_COVER_AI_POLL_TIMEOUT_MS) {
              toast.error('AI 生成仍在处理中，稍后返回页面会自动继续恢复');
              resolve();
              return;
            }

            try {
              const generationResult = await getAIImageGeneration(generationId);
              if (sessionId !== aiCoverGenerationSessionRef.current) {
                resolve();
                return;
              }

              const generation = generationResult.generation;
              if (generation.status === 'succeeded') {
                if (!generation.resultUrl) {
                  clearRememberedCoverGeneration();
                  toast.error('AI 未返回可用封面图');
                  resolve();
                  return;
                }
                if (options.recovered) {
                  await preloadCoverImage(generation.resultUrl);
                  if (sessionId !== aiCoverGenerationSessionRef.current) {
                    resolve();
                    return;
                  }
                  setCoverRecoveryTransition({
                    previousSrc: coverObjectUrl ? '' : cover,
                    revealCurrent: false,
                  });
                  applyGeneratedCover(generation.resultUrl);
                  recoveredCoverReady = true;
                } else {
                  applyGeneratedCover(generation.resultUrl);
                  toast.success('AI 生图完成，保存草稿或发布时会自动转存');
                }
                resolve();
                return;
              }

              if (generation.status === 'failed') {
                clearRememberedCoverGeneration();
                toast.error(generation.errorMessage || 'AI 生图失败');
                resolve();
                return;
              }

              if (generation.status === 'paused') {
                clearRememberedCoverGeneration();
                toast.error('AI 生图任务已暂停，请稍后重试');
                resolve();
                return;
              }

              aiCoverGenerationTimerRef.current = window.setTimeout(() => {
                void poll();
              }, BLOG_COVER_AI_POLL_INTERVAL_MS);
            } catch {
              if (sessionId !== aiCoverGenerationSessionRef.current) {
                resolve();
                return;
              }
              aiCoverGenerationTimerRef.current = window.setTimeout(() => {
                void poll();
              }, BLOG_COVER_AI_POLL_ERROR_INTERVAL_MS);
            }
          };

          void poll();
        });
      } finally {
        if (sessionId === aiCoverGenerationSessionRef.current) {
          setAiCoverLoading(false);
          setAiCoverSource('manual');
          setRecoveringCover(false);

          if (recoveredCoverReady) {
            await waitNextPaint();
            if (sessionId === aiCoverGenerationSessionRef.current) {
              setCoverRecoveryTransition((current) =>
                current ? { ...current, revealCurrent: true } : current,
              );
              setShowCoverRecoveryNotice(true);
              coverRecoveryTransitionTimerRef.current = window.setTimeout(() => {
                setCoverRecoveryTransition(null);
                coverRecoveryTransitionTimerRef.current = null;
              }, BLOG_COVER_RECOVERY_TRANSITION_MS);
              coverRecoveryNoticeTimerRef.current = window.setTimeout(() => {
                setShowCoverRecoveryNotice(false);
                coverRecoveryNoticeTimerRef.current = null;
              }, BLOG_COVER_RECOVERY_NOTICE_MS);
            }
          }
        }
      }
    },
    [
      applyGeneratedCover,
      clearRememberedCoverGeneration,
      cover,
      coverObjectUrl,
      resetCoverRecoveryFeedback,
    ],
  );

  useEffect(() => {
    if (!user?.id || loadedEditorScope !== editorRecoveryScope) return;
    const recoveryAttemptKey = `${user.id}:${editorRecoveryScope}`;
    if (recoveredEditorScopeRef.current === recoveryAttemptKey) return;
    recoveredEditorScopeRef.current = recoveryAttemptKey;

    const recovery = readBlogCoverGenerationRecovery(localStorage, user.id, editorRecoveryScope);
    if (recovery) {
      void monitorCoverGeneration(recovery.generationId, {
        source: 'manual',
        recovered: true,
      });
    }
  }, [editorRecoveryScope, loadedEditorScope, monitorCoverGeneration, user?.id]);

  const renderCoverToBlob = useCallback(async (): Promise<Blob | null> => {
    if (!coverFile || !coverImageMeta) return null;
    const viewport = coverViewportRef.current;
    if (!viewport) return null;

    const boxW = viewport.clientWidth;
    const boxH = viewport.clientHeight;
    if (!boxW || !boxH) return null;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('cover image load failed'));
      img.src = coverObjectUrl;
    });

    const baseScale = Math.max(boxW / coverImageMeta.width, boxH / coverImageMeta.height);
    const renderScale = baseScale * coverZoom;
    const renderW = coverImageMeta.width * renderScale;
    const renderH = coverImageMeta.height * renderScale;
    const drawX = (boxW - renderW) / 2 + coverOffsetX;
    const drawY = (boxH - renderH) / 2 + coverOffsetY;

    const outputW = BLOG_COVER_OUTPUT_WIDTH;
    const outputH = BLOG_COVER_OUTPUT_HEIGHT;
    const boxScaleX = outputW / boxW;
    const boxScaleY = outputH / boxH;
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const backdropScale = Math.max(outputW / coverImageMeta.width, outputH / coverImageMeta.height);
    const backdropW = coverImageMeta.width * backdropScale;
    const backdropH = coverImageMeta.height * backdropScale;
    const gradient = ctx.createLinearGradient(0, 0, 0, outputH);
    gradient.addColorStop(0, '#f5f5f5');
    gradient.addColorStop(1, '#ebebeb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, outputW, outputH);
    ctx.save();
    ctx.filter = 'blur(26px)';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(
      image,
      (outputW - backdropW) / 2,
      (outputH - backdropH) / 2,
      backdropW,
      backdropH,
    );
    ctx.restore();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      drawX * boxScaleX,
      drawY * boxScaleY,
      renderW * boxScaleX,
      renderH * boxScaleY,
    );
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  }, [coverFile, coverImageMeta, coverOffsetX, coverOffsetY, coverObjectUrl, coverZoom]);

  const uploadCoverIfNeeded = useCallback(async () => {
    if (!coverFile || !coverObjectUrl) {
      const remoteCoverUrl = pendingCoverRemoteUrl || (!coverStorageKey ? cover.trim() : '');
      if (!remoteCoverUrl) {
        return {
          cover: cover.trim(),
          coverStorageKey: coverStorageKey.trim(),
        };
      }

      setCoverUploading(true);
      try {
        const result = await uploadBlogCoverByUrl({ url: remoteCoverUrl });
        setCover(result.url);
        setCoverStorageKey(result.storageKey);
        setPendingCoverRemoteUrl('');
        return {
          cover: result.url,
          coverStorageKey: result.storageKey,
        };
      } finally {
        setCoverUploading(false);
      }
    }

    setCoverUploading(true);
    try {
      const blob = await renderCoverToBlob();
      if (!blob) throw new Error('cover process failed');
      const formData = new FormData();
      const uploadName = coverFile.name.replace(/\.[^.]+$/, '') || 'blog-cover';
      const uploadFile = new File([blob], `${uploadName}.jpg`, { type: 'image/jpeg' });
      formData.append('file', uploadFile);
      const result = await uploadBlogCover(formData);
      setCover(result.url);
      setCoverStorageKey(result.storageKey);
      setPendingCoverRemoteUrl('');
      resetLocalCoverEditing();
      return {
        cover: result.url,
        coverStorageKey: result.storageKey,
      };
    } finally {
      setCoverUploading(false);
    }
  }, [
    cover,
    coverFile,
    coverObjectUrl,
    coverStorageKey,
    pendingCoverRemoteUrl,
    renderCoverToBlob,
    resetLocalCoverEditing,
  ]);

  const handleAIGenerateExcerpt = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    try {
      setAiExcerptLoading(true);
      const result = await generateBlogExcerpt({
        title: title.trim(),
        content: trimmedContent,
      });
      const nextExcerpt = result.excerpt?.trim();
      if (!nextExcerpt) {
        toast.error('AI 未生成有效摘要');
        return;
      }
      setExcerpt(nextExcerpt);
      toast.success('AI 摘要已填充');
    } catch {
      // 请求层已统一处理并展示后端错误信息（例如模型配置错误）
    } finally {
      setAiExcerptLoading(false);
    }
  };

  const handleAIGenerateCover = async (payload?: {
    title?: string;
    excerpt?: string;
    content?: string;
    source?: 'manual' | 'import';
    modelId?: string;
    aspectRatio?: string;
    quality?: string;
    variationMode?: AICoverAssistantPayload['variationMode'];
    prompt?: string;
  }) => {
    const trimmedContent = (payload?.content ?? content).trim();
    if (!trimmedContent) return;
    const modelId = (payload?.modelId || '').trim();
    if (!modelId) {
      toast.error('请先选择生图模型');
      return;
    }
    const aspectRatio = payload?.aspectRatio || BLOG_COVER_AI_ASPECT_RATIO;
    const quality = payload?.quality || BLOG_COVER_AI_QUALITY;
    const generationPrompt = (payload?.prompt || '').trim();
    const subjectContext = buildBlogCoverSubjectContext({
      title: payload?.title ?? title,
      excerpt: payload?.excerpt ?? excerpt,
      content: trimmedContent,
    });
    const source = payload?.source ?? 'manual';
    let monitoringStarted = false;
    try {
      setAiCoverSource(source);
      setAiCoverLoading(true);
      const result = await createAIImageGeneration({
        modelId,
        recipeId: BLOG_COVER_AI_RECIPE_ID,
        brief: generationPrompt,
        subjectContext,
        variationMode: payload?.variationMode || 'balanced',
        aspectRatio,
        quality,
        references: [],
      });
      const generationId = result.generation.id;
      rememberCoverGeneration(generationId);
      monitoringStarted = true;
      await monitorCoverGeneration(generationId, { source });
    } catch {
      // 请求层已统一处理并展示后端错误信息（例如模型配置错误）
    } finally {
      if (!monitoringStarted) {
        setAiCoverLoading(false);
        setAiCoverSource('manual');
      }
    }
  };

  const handleImportMarkdown = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingMarkdown(true);
      const rawText = await file.text();
      const parsed = parseMarkdownImport(file.name, rawText);
      if (!parsed.content.trim()) {
        toast.error('导入失败，文件正文为空');
        return;
      }

      if (coverFile || coverObjectUrl) {
        resetLocalCoverEditing();
      }
      setTitle(parsed.title);
      setContent(parsed.content);
      setExcerpt('');
      setCover('');
      setCoverStorageKey('');
      setPendingCoverRemoteUrl('');
      discardCoverGeneration();

      await waitNextPaint();
      toast.success('MD 导入成功');
      setImportingMarkdown(false);
    } catch {
      toast.error('MD 导入失败，请检查文件后重试');
    } finally {
      setImportingMarkdown(false);
      event.target.value = '';
    }
  };

  const handleSubmit = useCallback(
    async (
      status: 'draft' | 'published',
      options?: { stayOnPage?: boolean; fromShortcut?: boolean },
    ) => {
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      if (!trimmedTitle) {
        toast.error('请输入标题');
        return;
      }
      if (!trimmedContent) {
        toast.error('请输入正文内容');
        return;
      }

      try {
        setSubmitIntent(status);
        setSubmitting(true);
        const shouldTriggerUnsplashDownload =
          status === 'published' && !!pendingUnsplashDownloadLocation;
        const unsplashDownloadLocation = pendingUnsplashDownloadLocation;
        const resolvedCover = await uploadCoverIfNeeded();
        if (shouldTriggerUnsplashDownload && resolvedCover.coverStorageKey) {
          void triggerUnsplashDownload(unsplashDownloadLocation).catch(() => undefined);
          setPendingUnsplashDownloadLocation('');
        }
        const resolvedExcerpt =
          status === 'published' ? createAutoExcerpt(excerpt, trimmedContent) : excerpt.trim();
        if (isEditMode && editingId) {
          await updatePost(editingId, {
            title: trimmedTitle,
            postType: 'blog',
            content: trimmedContent,
            excerpt: resolvedExcerpt,
            cover: resolvedCover.cover || '',
            coverStorageKey: resolvedCover.coverStorageKey || '',
            groupId: groupId || '0',
            visibility,
            status,
          });
          if (status === 'published') {
            setLoadedPostStatus('published');
            toast.success('文章已更新并发布');
          } else if (loadedPostStatus === 'published') {
            toast.success('草稿已保存，当前线上正文未受影响');
          } else if (options?.fromShortcut) {
            toast.success('草稿已快捷保存（未离开当前页面）');
          } else {
            toast.success('文章草稿已更新');
          }
        } else {
          await createPost({
            title: trimmedTitle,
            postType: 'blog',
            content: trimmedContent,
            excerpt: resolvedExcerpt,
            cover: resolvedCover.cover || undefined,
            coverStorageKey: resolvedCover.coverStorageKey || undefined,
            groupId: groupId || undefined,
            visibility,
            status,
            publishNow: status === 'published',
          });
          setLoadedPostStatus(status);
          toast.success(status === 'published' ? '文章已发布' : '草稿保存成功');
        }

        clearRememberedCoverGeneration();
        clearAutoSavedArticle();

        if (!options?.stayOnPage) {
          if (isEditMode) {
            navigate(returnTo, {
              state: { refreshPostsAt: Date.now() },
            });
          } else {
            navigateBackOrFallback(navigate, '/my-space/posts');
          }
        }
      } catch {
        toast.error(status === 'published' ? '提交失败，请稍后重试' : '保存失败，请稍后重试');
      } finally {
        setSubmitting(false);
        setSubmitIntent(null);
      }
    },
    [
      title,
      content,
      excerpt,
      loadedPostStatus,
      pendingUnsplashDownloadLocation,
      groupId,
      visibility,
      isEditMode,
      editingId,
      uploadCoverIfNeeded,
      clearRememberedCoverGeneration,
      clearAutoSavedArticle,
      navigate,
      returnTo,
    ],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSubmit('draft', { stayOnPage: isEditMode, fromShortcut: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSubmit, isEditMode]);

  const handleSelectLocalCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('封面仅支持图片');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('封面大小不能超过 30MB');
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      // 先弹出裁剪框，让用户自由选择裁剪范围
      if (pendingCropUrl) URL.revokeObjectURL(pendingCropUrl);
      setPendingCropFile(file);
      setPendingCropUrl(objectUrl);
      setCropDialogOpen(true);
    } catch {
      toast.error('封面读取失败，请重试');
    } finally {
      event.target.value = '';
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    try {
      const objectUrl = URL.createObjectURL(croppedFile);
      const meta = await new Promise<CoverImageMeta>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('read cover failed'));
        img.src = objectUrl;
      });
      if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
      setCoverFile(croppedFile);
      setCoverObjectUrl(objectUrl);
      setCoverImageMeta(meta);
      setCoverZoom(1);
      setCoverOffsetX(0);
      setCoverOffsetY(0);
      setCover('');
      setCoverStorageKey('');
      setPendingCoverRemoteUrl('');
      discardCoverGeneration();
      // 清理 pending 状态
      if (pendingCropUrl) URL.revokeObjectURL(pendingCropUrl);
      setPendingCropFile(null);
      setPendingCropUrl('');
    } catch {
      toast.error('封面处理失败，请重试');
    }
  };

  const handleWallpaperPickerOpenChange = (open: boolean) => {
    setWallpaperPickerOpen(open);
  };

  const handleSelectPublicWallpaperCover = (resource: Resource) => {
    if (coverFile || coverObjectUrl) {
      resetLocalCoverEditing();
    }
    const selectedUrl = (resource.url || '').trim();
    setCover(selectedUrl);
    setCoverStorageKey('');
    setPendingCoverRemoteUrl(selectedUrl);
    setPendingUnsplashDownloadLocation('');
    discardCoverGeneration();
    setAiPickExcludedIds((prev) => (prev.includes(resource.id) ? prev : [...prev, resource.id]));
    setWallpaperPickerOpen(false);
    toast.success('已选择图片，保存时会转存为文章封面');
  };

  const handleSelectExternalCoverImage = (image: ExternalCoverImage) => {
    if (coverFile || coverObjectUrl) {
      resetLocalCoverEditing();
    }
    const selectedUrl = (image.previewUrl || image.fullUrl || '').trim();
    if (!selectedUrl) {
      toast.error('该图片没有可用的地址，请换一张');
      return;
    }
    setCover(selectedUrl);
    setCoverStorageKey('');
    setPendingCoverRemoteUrl(selectedUrl);
    discardCoverGeneration();
    if (image.attribution.provider === 'unsplash' && image.downloadLocation) {
      setPendingUnsplashDownloadLocation(image.downloadLocation);
    } else {
      setPendingUnsplashDownloadLocation('');
    }
    setWallpaperPickerOpen(false);
    toast.success('已选择外部图片，保存时会转存为文章封面');
  };

  const handleAIPickCover = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      toast.error('请先输入正文内容');
      return;
    }
    try {
      setAiPickLoading(true);
      const result = await pickBlogCoverFromResources({
        title: title.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        content: trimmedContent,
        excludedIds: aiPickExcludedIds,
      });
      const resource = result.resource;
      if (!resource || !resource.url) {
        toast.error('未找到合适的封面资源，稍后再试');
        return;
      }
      if (coverFile || coverObjectUrl) {
        resetLocalCoverEditing();
      }
      const selectedUrl = (resource.url || '').trim();
      setCover(selectedUrl);
      setCoverStorageKey('');
      setPendingCoverRemoteUrl(selectedUrl);
      setPendingUnsplashDownloadLocation('');
      discardCoverGeneration();
      setAiPickExcludedIds((prev) => (prev.includes(resource.id) ? prev : [...prev, resource.id]));
      if (result.matchedKeywords && result.matchedKeywords.length > 0) {
        toast.success(`已按关键词「${result.matchedKeywords.join('、')}」选择封面`);
      } else {
        toast.success('已从资源池随机挑选一张封面');
      }
    } catch {
      // 请求层已统一处理并展示后端错误信息
    } finally {
      setAiPickLoading(false);
    }
  };

  const handleAICoverAssistantConfirm = async (payload: AICoverAssistantPayload) => {
    if (isContentEmpty) {
      toast.error('请先输入正文内容');
      return;
    }
    if (payload.mode === 'generate' && !payload.modelId) {
      toast.error('请先选择生图模型');
      return;
    }

    if (payload.mode === 'pick') {
      await handleAIPickCover();
      return;
    }

    await handleAIGenerateCover({
      modelId: payload.modelId,
      aspectRatio: payload.aspectRatio,
      quality: payload.quality,
      variationMode: payload.variationMode,
      prompt: payload.prompt,
      source: 'manual',
    });
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('请输入专栏名称');
      return;
    }
    try {
      setCreatingGroup(true);
      const created = await createGroup({
        name,
        groupType: 'blog',
        description: newGroupDesc.trim() || undefined,
      });
      toast.success('专栏创建成功');
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
      setGroupId(created.id);
    } catch {
      toast.error('专栏创建失败，请稍后重试');
    } finally {
      setCreatingGroup(false);
    }
  };

  const wordCount = useMemo(() => content.replace(/\s+/g, '').length, [content]);
  const readMinutes = useMemo(() => Math.max(1, Math.ceil(wordCount / 500)), [wordCount]);
  const isContentEmpty = !content.trim();
  const actionBusy =
    submitting || coverUploading || aiExcerptLoading || aiCoverLoading || importingMarkdown;
  const coverAssistantBusy = aiPickLoading || aiCoverLoading;
  const coverAssistantBusyTitle = recoveringCover
    ? '正在恢复上次生成的封面...'
    : aiPickLoading
      ? 'AI 正在从资源池挑选封面...'
      : aiCoverSource === 'import'
        ? 'AI 生图工具正在根据导入内容生成封面图...'
        : 'AI 生图工具正在生成封面图...';
  const isEditBootLoading = isEditMode && loadingPost && !title && !content;

  if (isEditBootLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-360 space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border-border/50 bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-accent/80">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              <span className="absolute inset-0 rounded-xl border border-primary/15" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">正在加载文章...</p>
              <p className="text-xs text-muted-foreground">即将恢复编辑状态</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="w-full min-w-0 rounded-2xl border-border/50 bg-card/95 p-4 shadow-sm md:p-5">
              <Skeleton className="mb-4 h-5 w-28 rounded-lg bg-accent/80" />
              <Skeleton className="mb-3 h-12 w-full rounded-xl" />
              <Skeleton className="mb-3 h-28 w-full rounded-xl" />
              <Skeleton className="mb-3 h-28 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </section>

            <section className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border-border/50 bg-card/95 p-4 shadow-sm md:p-5">
                <Skeleton className="mb-4 h-5 w-32 rounded-lg bg-accent/80" />
                <Skeleton className="mb-3 h-9 w-full rounded-xl" />
                <Skeleton className="mb-3 h-9 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
              <div className="rounded-2xl border-border/50 bg-card/95 p-4 shadow-sm md:p-5">
                <Skeleton className="mb-3 h-5 w-28 rounded-lg bg-accent/80" />
                <Skeleton className="h-52 w-full rounded-xl" />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-360">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-border/50 bg-card/75 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              {returnLabel}
            </Button>
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">
              {isEditMode ? '编辑文章' : '写文章'}
            </h1>
            <span className="bg-accent text-primary rounded-full border-border/50 border px-3 py-1 text-xs shadow-sm">
              Markdown
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground md:inline-flex">
              <Clock3 className="h-3.5 w-3.5" />
              {autoSaveState === 'saving'
                ? '正在自动保存'
                : autoSaveState === 'saved'
                  ? '已自动保存'
                  : 'Ctrl/Cmd + S 保存'}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={actionBusy || loadingPost}
              onClick={() => markdownImportInputRef.current?.click()}
              className="rounded-xl"
            >
              {importingMarkdown ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {importingMarkdown ? '导入中' : '导入 MD'}
            </Button>
            <Button
              variant="outline"
              disabled={actionBusy}
              onClick={() => void handleSubmit('draft', { stayOnPage: isEditMode })}
              className="rounded-xl"
            >
              <Save className="mr-2 h-4 w-4" />
              保存草稿
            </Button>
            {!isEditMode && (
              <Button
                variant="outline"
                disabled={actionBusy || loadingPost}
                onClick={() => void handleResetCreateForm()}
                className="rounded-xl"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重置
              </Button>
            )}
            <Button
              disabled={actionBusy}
              onClick={() => setPublishReviewOpen(true)}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              发布检查
            </Button>
            <input
              ref={markdownImportInputRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              className="hidden"
              onChange={(event) => void handleImportMarkdown(event)}
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.46fr)_minmax(340px,0.72fr)]">
          <section className="w-full min-w-0 rounded-2xl border-border/50 bg-card/95 p-4 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">内容画布</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>字数：{wordCount}</span>
                <span>预计阅读：{readMinutes} 分钟</span>
              </div>
            </div>

            {loadingPost ? (
              <div className="mb-2 h-12 animate-pulse rounded-xl bg-muted" />
            ) : (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入标题，抓住读者注意力"
                maxLength={200}
                className="mb-2 h-12 rounded-lg text-base border-border/50 bg-card/95"
              />
            )}

            <MdxMarkdownEditor
              value={content}
              onChange={setContent}
              selectionHeadingOptions={BLOG_EDITOR_HEADING_OPTIONS}
            />
          </section>

          <section className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
            <BlockingLoadingSurface
              show={coverAssistantBusy}
              title={coverAssistantBusyTitle}
              hint="你可以继续编辑正文，完成后会自动更新预览。"
              className="rounded-2xl border-border/50 bg-card/95 p-4 shadow-sm md:p-5"
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="text-primary h-4 w-4" />
                文章准备
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">摘要（可选）</span>
                    <button
                      type="button"
                      onClick={() => void handleAIGenerateExcerpt()}
                      disabled={isContentEmpty || aiExcerptLoading || submitting}
                      className="inline-flex h-6 items-center gap-1 rounded-lg border border-primary/30 bg-accent px-1.5 text-xs font-medium text-primary transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                      title={isContentEmpty ? '请先输入正文内容' : 'AI 自动提取摘要'}
                    >
                      {aiExcerptLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {aiExcerptLoading ? '生成中' : 'AI 生成摘要'}
                    </button>
                  </div>
                  <Input
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="留空则自动截取正文"
                    maxLength={500}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">封面 URL（可选）</span>
                    <div className="flex items-center gap-1.5">
                      <AICoverAssistantDialog
                        disabled={actionBusy || loadingPost}
                        isContentEmpty={isContentEmpty}
                        busy={aiPickLoading || aiCoverLoading || submitting}
                        onConfirm={handleAICoverAssistantConfirm}
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionBusy || loadingPost}
                            className="rounded-xl"
                          >
                            {aiCoverLoading || aiPickLoading ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="mr-1.5 h-4 w-4" />
                            )}
                            AI 封面助手
                          </Button>
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={cover}
                      onChange={(e) => {
                        if (coverFile || coverObjectUrl) resetLocalCoverEditing();
                        setCover(e.target.value);
                        setCoverStorageKey('');
                        setPendingCoverRemoteUrl('');
                        setPendingUnsplashDownloadLocation('');
                        discardCoverGeneration();
                      }}
                      placeholder="https://..."
                      maxLength={500}
                      className="rounded-xl"
                    />
                    <label className="bg-accent text-primary hover:bg-accent inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border-border/50 border px-2.5 text-sm whitespace-nowrap">
                      <ImagePlus className="mr-1 h-4 w-4" />
                      {coverUploading ? '上传中' : coverObjectUrl ? '重新选图' : '选择图片'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={coverUploading}
                        onChange={handleSelectLocalCover}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-xl whitespace-nowrap"
                      disabled={actionBusy || loadingPost}
                      onClick={() => setWallpaperPickerOpen(true)}
                    >
                      <ImagePlus className="mr-1 h-4 w-4" />
                      选择封面
                    </Button>
                  </div>
                  {(!!cover || !!coverObjectUrl) && (
                    <BlogCoverPreview
                      src={coverObjectUrl || cover}
                      previousSrc={coverRecoveryTransition?.previousSrc}
                      revealCurrent={coverRecoveryTransition?.revealCurrent}
                      showRecoveryNotice={showCoverRecoveryNotice}
                      visibilityLabel={
                        visibility === 'public' ? '公开' : visibility === 'shared' ? '共享' : '私密'
                      }
                      viewportRef={coverViewportRef}
                    />
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs text-muted-foreground">可见范围</div>
                  <div className="flex flex-wrap gap-2 rounded-xl border-border/50 border p-2">
                    {[
                      { label: '仅自己', value: 'private' as const },
                      { label: '公开', value: 'public' as const },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.value}
                        onClick={() => setVisibility(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          visibility === item.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-card text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>专栏</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => navigate('/studio/columns?type=blog')}
                      >
                        管理专栏
                      </button>
                      <button
                        type="button"
                        className="text-primary hover:text-primary inline-flex items-center gap-1"
                        onClick={() => setShowCreateGroup((v) => !v)}
                      >
                        <Plus className="h-3 w-3" />
                        新建专栏
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border-border/50 border p-2">
                    <button
                      type="button"
                      onClick={() => setGroupId('')}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        !groupId
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      未设专栏
                    </button>
                    {groups.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setGroupId(item.id)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          groupId === item.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-card text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>

                  {showCreateGroup && (
                    <div className="mt-3 rounded-xl border-border/50 border p-3">
                      <Input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="专栏名称，例如：React"
                        className="mb-2 rounded-lg bg-card"
                      />
                      <Input
                        value={newGroupDesc}
                        onChange={(e) => setNewGroupDesc(e.target.value)}
                        placeholder="专栏描述（可选）"
                        className="mb-2 rounded-lg bg-card"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => setShowCreateGroup(false)}
                          disabled={creatingGroup}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg"
                          onClick={() => void handleCreateGroup()}
                          disabled={creatingGroup}
                        >
                          创建
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </BlockingLoadingSurface>
          </section>
        </div>
      </div>

      {/* 封面裁剪弹窗 */}
      {pendingCropUrl && pendingCropFile && (
        <CoverCropDialog
          open={cropDialogOpen}
          imageUrl={pendingCropUrl}
          fileName={pendingCropFile.name}
          onOpenChange={(open) => {
            if (!open) {
              setCropDialogOpen(false);
              if (pendingCropUrl) URL.revokeObjectURL(pendingCropUrl);
              setPendingCropFile(null);
              setPendingCropUrl('');
            }
          }}
          onConfirm={(file) => void handleCropConfirm(file)}
        />
      )}
      <CoverPickerDialog
        open={wallpaperPickerOpen}
        onOpenChange={handleWallpaperPickerOpenChange}
        currentCoverUrl={cover}
        onSelectResource={handleSelectPublicWallpaperCover}
        onSelectExternalImage={handleSelectExternalCoverImage}
      />
      <Dialog open={publishReviewOpen} onOpenChange={setPublishReviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>发布检查</DialogTitle>
            <DialogDescription>确认标题、摘要、专栏、封面与可见范围。</DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-border border-y border-border text-sm">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-muted-foreground">标题</dt>
              <dd className={title.trim() ? 'font-medium' : 'text-destructive'}>
                {title.trim() || '尚未填写'}
              </dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-muted-foreground">摘要</dt>
              <dd>{excerpt.trim() || '发布时从正文生成'}</dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-muted-foreground">专栏</dt>
              <dd>{groups.find((group) => group.id === groupId)?.name || '未设专栏'}</dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-muted-foreground">封面</dt>
              <dd>{cover || coverObjectUrl ? '已准备' : '未设置'}</dd>
            </div>
            <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-muted-foreground">范围</dt>
              <dd>
                {visibility === 'public' ? '公开' : visibility === 'shared' ? '兼容共享' : '仅自己'}
              </dd>
            </div>
          </dl>
          {!content.trim() ? (
            <p className="text-sm text-destructive">正文为空，暂时不能发布。</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" />
              正文 {wordCount} 字，预计阅读 {readMinutes} 分钟
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishReviewOpen(false)}>
              返回修改
            </Button>
            <Button
              type="button"
              disabled={actionBusy || !title.trim() || !content.trim()}
              onClick={() => {
                setPublishReviewOpen(false);
                void handleSubmit('published');
              }}
            >
              {submitIntent === 'published' && submitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send />
              )}
              确认发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
