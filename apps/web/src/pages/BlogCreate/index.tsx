import {
  ArrowLeft,
  Clock3,
  Eye,
  FileStack,
  FileUp,
  ImagePlus,
  Loader2,
  PenSquare,
  Plus,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createGroup,
  createPost,
  type Group,
  generateBlogCover,
  generateBlogExcerpt,
  getAdminGroups,
  getAdminPostDetail,
  updatePost,
  uploadBlogCover,
  uploadBlogCoverByUrl,
  type Visibility,
} from '@/api/blog';
import type { Resource } from '@/api/resource';
import {
  BLOG_COVER_ASPECT_CLASS,
  BLOG_COVER_OUTPUT_HEIGHT,
  BLOG_COVER_OUTPUT_WIDTH,
  MarkdownPreview,
} from '@/components/blog';
import { CoverCropDialog } from '@/components/blog/CoverCropDialog';
import { MdxMarkdownEditor } from '@/components/blog/MdxMarkdownEditor';
import { PublicWallpaperPickerDialog } from '@/components/blog/PublicWallpaperPickerDialog';
import { Button } from '@/components/ui/button';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { base64ToImageFile, createAutoExcerpt, parseMarkdownImport, waitNextPaint } from './utils';

type CoverImageMeta = {
  width: number;
  height: number;
};

type BatchMarkdownItem = {
  fileName: string;
  title: string;
  content: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  applyCover?: boolean;
  cover?: string;
  coverStorageKey?: string;
  coverUploading?: boolean;
};

function getErrorText(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || fallback;
  }
  return fallback;
}

export default function BlogCreate() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const isEditMode = Boolean(editingId);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
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
  const [aiExcerptLoading, setAiExcerptLoading] = useState(false);
  const [aiCoverLoading, setAiCoverLoading] = useState(false);
  const [aiCoverSource, setAiCoverSource] = useState<'manual' | 'import'>('manual');
  const [importingMarkdown, setImportingMarkdown] = useState(false);
  const [batchPreparing, setBatchPreparing] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchMarkdownItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [batchHasUploadedFiles, setBatchHasUploadedFiles] = useState(false);
  const [batchGroupId, setBatchGroupId] = useState('');
  const [batchVisibility, setBatchVisibility] = useState<Visibility>('private');
  const [batchCoverTargetIndex, setBatchCoverTargetIndex] = useState<number | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [previewMode, setPreviewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [loadingPost, setLoadingPost] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [pendingCropUrl, setPendingCropUrl] = useState('');
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const currentEditingIdRef = useRef<string | undefined>(editingId);

  const coverViewportRef = useRef<HTMLDivElement | null>(null);
  const markdownImportInputRef = useRef<HTMLInputElement | null>(null);
  const markdownBatchInputRef = useRef<HTMLInputElement | null>(null);
  const batchCoverUploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    currentEditingIdRef.current = editingId;
  }, [editingId]);

  const loadGroups = async () => {
    try {
      const list = await getAdminGroups({ groupType: 'blog' });
      setGroups(list || []);
      if ((!groupId || !isEditMode) && list?.[0]?.id) {
        setGroupId(list[0].id);
      }
    } catch {
      toast.error('加载分组失败');
    }
  };

  const loadPost = async (postId: string) => {
    try {
      setLoadingPost(true);
      const detail = await getAdminPostDetail(postId);
      if (currentEditingIdRef.current !== postId) return;
      if (detail.postType !== 'blog') {
        toast.error('当前仅支持编辑博客类型内容');
        navigate('/my-space');
        return;
      }
      setTitle(detail.title || '');
      setExcerpt(detail.excerpt || '');
      setCover(detail.cover || '');
      setCoverStorageKey(detail.coverStorageKey || '');
      setPendingCoverRemoteUrl('');
      setContent(detail.content || '');
      setGroupId(detail.groupId || '');
      setVisibility(detail.visibility || 'private');
    } catch {
      toast.error('加载博客内容失败');
      navigate('/my-space');
    } finally {
      if (currentEditingIdRef.current === postId) {
        setLoadingPost(false);
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator' && user?.role !== 'admin') {
      toast.error('当前账号不是创作者，无法发布博客');
      navigate('/');
      return;
    }

    void loadGroups();
    if (editingId) {
      void loadPost(editingId);
    } else {
      resetCreateForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, user?.role, editingId]);

  useEffect(() => {
    // 彻底禁用本地草稿缓存，并清理历史遗留数据
    if (!isEditMode) {
      localStorage.removeItem('valley-blog-create-draft-v3');
    }
  }, [isEditMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSubmit('draft', { stayOnPage: isEditMode, fromShortcut: true });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    content,
    excerpt,
    cover,
    coverStorageKey,
    groupId,
    visibility,
    isEditMode,
    editingId,
    coverFile,
  ]);

  useEffect(() => {
    return () => {
      if (coverObjectUrl) {
        URL.revokeObjectURL(coverObjectUrl);
      }
    };
  }, [coverObjectUrl]);

  const resetLocalCoverEditing = () => {
    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl);
    }
    setCoverFile(null);
    setCoverObjectUrl('');
    setCoverImageMeta(null);
    setCoverZoom(1);
    setCoverOffsetX(0);
    setCoverOffsetY(0);
  };

  const applyTemporaryCoverFile = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const meta = await new Promise<CoverImageMeta>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('read cover failed'));
      img.src = objectUrl;
    });

    if (coverObjectUrl) {
      URL.revokeObjectURL(coverObjectUrl);
    }

    setCoverFile(file);
    setCoverObjectUrl(objectUrl);
    setCoverImageMeta(meta);
    setCoverZoom(1);
    setCoverOffsetX(0);
    setCoverOffsetY(0);
    setCover('');
    setCoverStorageKey('');
    setPendingCoverRemoteUrl('');
  };

  const importRemoteCoverAsLocalFile = async (url: string, filePrefix = 'ai-blog-cover') => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('remote cover fetch failed');
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('remote cover is empty');
    }

    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const file = new File([blob], `${filePrefix}-${Date.now()}.${extension}`, {
      type: mimeType,
    });
    await applyTemporaryCoverFile(file);
  };

  const resetCreateForm = () => {
    setTitle('');
    setExcerpt('');
    setCover('');
    setCoverStorageKey('');
    setPendingCoverRemoteUrl('');
    setContent('');
    setVisibility('private');
    setGroupId('');
    setLoadingPost(false);
    resetLocalCoverEditing();
  };

  const renderCoverToBlob = async (): Promise<Blob | null> => {
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
    gradient.addColorStop(0, '#f7eff3');
    gradient.addColorStop(1, '#efe3ea');
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
  };

  const uploadCoverIfNeeded = async (shouldUpload: boolean) => {
    if (!shouldUpload) {
      if (pendingCoverRemoteUrl) {
        return {
          cover: '',
          coverStorageKey: '',
        };
      }
      return {
        cover: cover.trim(),
        coverStorageKey: coverStorageKey.trim(),
      };
    }

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
  };

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
  }) => {
    const trimmedContent = (payload?.content ?? content).trim();
    if (!trimmedContent) return;

    try {
      setAiCoverSource(payload?.source ?? 'manual');
      setAiCoverLoading(true);
      const result = await generateBlogCover({
        title: (payload?.title ?? title).trim(),
        excerpt: (payload?.excerpt ?? excerpt).trim(),
        content: trimmedContent,
      });

      if (result.imageBase64) {
        const mimeType = result.mimeType || 'image/jpeg';
        const fileExt = mimeType.includes('png') ? 'png' : 'jpg';
        const nextCoverFile = base64ToImageFile(
          result.imageBase64,
          mimeType,
          `ai-blog-cover-${Date.now()}.${fileExt}`,
        );
        await applyTemporaryCoverFile(nextCoverFile);
        toast.success('AI 封面已生成（临时预览，发布时上传）');
        return;
      }

      if (result.imageUrl) {
        try {
          await importRemoteCoverAsLocalFile(result.imageUrl);
        } catch {
          if (coverFile || coverObjectUrl) {
            resetLocalCoverEditing();
          }
          setCover(result.imageUrl);
          setCoverStorageKey('');
          setPendingCoverRemoteUrl(result.imageUrl);
        }
        toast.success('AI 封面已生成（临时预览，发布时上传）');
        return;
      }

      toast.error('AI 未返回可用封面图');
    } catch {
      // 请求层已统一处理并展示后端错误信息（例如模型配置错误）
    } finally {
      setAiCoverLoading(false);
      setAiCoverSource('manual');
    }
  };

  const handleImportMarkdown = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingMarkdown(true);
      const rawText = await file.text();
      const parsed = parseMarkdownImport(file.name, rawText);
      const parsedContent = parsed.content.trim();
      if (!parsedContent) {
        toast.error('导入失败，文件正文为空');
        return;
      }

      if (coverFile || coverObjectUrl) {
        resetLocalCoverEditing();
      }
      setTitle(parsed.title);
      setContent(parsedContent);
      setExcerpt('');
      setCover('');
      setCoverStorageKey('');
      setPendingCoverRemoteUrl('');

      // 先让标题和正文完成一次渲染，再弹出 AI 配图确认。
      await waitNextPaint();
      toast.success('MD 导入成功');
      setImportingMarkdown(false);
      openConfirmToast({
        title: '是否立即生成 AI 封面？',
        description: '你也可以稍后手动点击「AI配图封面」。',
        confirmText: '立即生成',
        cancelText: '稍后再说',
        onConfirm: () =>
          handleAIGenerateCover({
            title: parsed.title,
            excerpt: '',
            content: parsedContent,
            source: 'import',
          }),
      });
    } catch {
      toast.error('MD 导入失败，请检查文件后重试');
    } finally {
      setImportingMarkdown(false);
      event.target.value = '';
    }
  };

  const resetBatchDialog = () => {
    setBatchItems([]);
    setBatchRunning(false);
    setBatchDone(false);
    setBatchPreparing(false);
    setBatchHasUploadedFiles(false);
    setBatchCoverTargetIndex(null);
    if (markdownBatchInputRef.current) {
      markdownBatchInputRef.current.value = '';
    }
    if (batchCoverUploadInputRef.current) {
      batchCoverUploadInputRef.current.value = '';
    }
  };

  const openBatchImportDialog = () => {
    resetBatchDialog();
    setBatchGroupId(groupId);
    setBatchVisibility(visibility);
    setBatchDialogOpen(true);
  };

  const handleBatchSelectMarkdown = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const files = selectedFiles;
    if (!files.length) return;

    try {
      setBatchPreparing(true);
      const parsedItems = await Promise.all(
        files.map(async (file): Promise<BatchMarkdownItem> => {
          try {
            const rawText = await file.text();
            const parsed = parseMarkdownImport(file.name, rawText);
            const parsedContent = parsed.content.trim();
            if (!parsedContent) {
              return {
                fileName: file.name,
                title: parsed.title,
                content: '',
                status: 'error',
                error: '正文为空，已跳过',
              };
            }
            return {
              fileName: file.name,
              title: parsed.title.trim() || '未命名博客',
              content: parsedContent,
              status: 'pending',
            };
          } catch {
            return {
              fileName: file.name,
              title: file.name.replace(/\.[^.]+$/, '') || '未命名博客',
              content: '',
              status: 'error',
              error: '文件读取失败',
            };
          }
        }),
      );

      setBatchItems((prev) => [...prev, ...parsedItems]);
      setBatchDone(false);
      setBatchHasUploadedFiles(true);
      toast.success(
        `本次识别 ${parsedItems.length} 篇，当前共 ${batchItems.length + parsedItems.length} 篇`,
      );
    } catch {
      toast.error('批量读取 MD 失败，请稍后重试');
    } finally {
      setBatchPreparing(false);
      event.target.value = '';
    }
  };

  const handleBatchImport = async (options?: { retryFailedOnly?: boolean }) => {
    const retryFailedOnly = options?.retryFailedOnly ?? false;
    const results = [...batchItems];
    const runnableIndexes = results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (retryFailedOnly ? item.status === 'error' : item.status === 'pending'))
      .map(({ index }) => index);

    if (!runnableIndexes.length) {
      toast.error(retryFailedOnly ? '没有可重试的失败项' : '没有可创建的博客，请检查导入结果');
      return;
    }
    const missingCoverIndexes = runnableIndexes.filter((index) => {
      const item = results[index];
      return Boolean(item.applyCover) && !item.cover;
    });
    if (missingCoverIndexes.length > 0) {
      toast.error('有已勾选封面的博客尚未选择图片，请先上传或选择资源壁纸');
      return;
    }

    try {
      setBatchRunning(true);
      setBatchDone(false);

      for (const index of runnableIndexes) {
        const item = results[index];
        results[index] = { ...item, status: 'running', error: undefined };
        setBatchItems([...results]);
        try {
          await createPost({
            title: item.title.trim(),
            postType: 'blog',
            content: item.content,
            excerpt: createAutoExcerpt('', item.content),
            groupId: batchGroupId || undefined,
            visibility: batchVisibility,
            cover: item.applyCover ? item.cover : undefined,
            coverStorageKey: item.applyCover ? item.coverStorageKey : undefined,
            status: 'published',
            publishNow: true,
          });
          results[index] = { ...item, status: 'success', error: undefined };
        } catch (error) {
          results[index] = {
            ...item,
            status: 'error',
            error: getErrorText(error, '创建失败，请稍后重试'),
          };
        }
        setBatchItems([...results]);
      }

      setBatchDone(true);
      const successCount = results.filter((item) => item.status === 'success').length;
      const errorCount = results.filter((item) => item.status === 'error').length;
      if (successCount > 0) {
        toast.success(
          `批量创建完成：成功 ${successCount} 篇${errorCount ? `，失败 ${errorCount} 篇` : ''}`,
        );
      } else {
        toast.error('批量创建失败，请检查结果后重试');
      }
    } finally {
      setBatchRunning(false);
    }
  };

  const handleSubmit = async (
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
      setSubmitting(true);
      const resolvedCover = await uploadCoverIfNeeded(status === 'published');
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
          toast.success('博客更新并发布成功');
        } else if (options?.fromShortcut) {
          toast.success('草稿已快捷保存（未离开当前页面）');
        } else {
          toast.success('博客更新成功');
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
        toast.success(status === 'published' ? '博客发布成功' : '草稿保存成功');
      }

      if (!options?.stayOnPage) {
        navigate(-1);
      }
    } catch {
      toast.error(status === 'published' ? '提交失败，请稍后重试' : '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

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
      // 清理 pending 状态
      if (pendingCropUrl) URL.revokeObjectURL(pendingCropUrl);
      setPendingCropFile(null);
      setPendingCropUrl('');
    } catch {
      toast.error('封面处理失败，请重试');
    }
  };

  const handleBatchCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const index = batchCoverTargetIndex;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (index === null || !file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('封面仅支持图片');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('封面大小不能超过 30MB');
      return;
    }

    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, coverUploading: true, applyCover: true } : item,
      ),
    );

    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadBlogCover(formData);
      setBatchItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                applyCover: true,
                cover: result.url,
                coverStorageKey: result.storageKey,
                coverUploading: false,
              }
            : item,
        ),
      );
      toast.success('博客封面已上传');
    } catch {
      setBatchItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index ? { ...item, coverUploading: false } : item,
        ),
      );
      toast.error('封面上传失败，请重试');
    } finally {
      setBatchCoverTargetIndex(null);
    }
  };

  const handleOpenBatchCoverUpload = (index: number) => {
    setBatchCoverTargetIndex(index);
    batchCoverUploadInputRef.current?.click();
  };

  const handleOpenBatchWallpaperPicker = (index: number) => {
    setBatchCoverTargetIndex(index);
    setWallpaperPickerOpen(true);
  };

  const handleBatchCoverToggle = (index: number, checked: boolean) => {
    setBatchItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, applyCover: checked } : item,
      ),
    );
  };

  const handleWallpaperPickerOpenChange = (open: boolean) => {
    setWallpaperPickerOpen(open);
    if (!open) {
      setBatchCoverTargetIndex(null);
    }
  };

  const handleSelectPublicWallpaperCover = (resource: Resource) => {
    if (batchCoverTargetIndex !== null) {
      const selectedUrl = (resource.url || '').trim();
      const targetIndex = batchCoverTargetIndex;
      setBatchItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === targetIndex
            ? {
                ...item,
                applyCover: true,
                cover: selectedUrl,
                coverStorageKey: '',
                coverUploading: false,
              }
            : item,
        ),
      );
      setBatchCoverTargetIndex(null);
      setWallpaperPickerOpen(false);
      toast.success('已为该博客选择资源壁纸');
      return;
    }

    if (coverFile || coverObjectUrl) {
      resetLocalCoverEditing();
    }
    const selectedUrl = (resource.url || '').trim();
    setCover(selectedUrl);
    setCoverStorageKey('');
    setPendingCoverRemoteUrl(selectedUrl);
    setWallpaperPickerOpen(false);
    toast.success('已选择公用壁纸，发布时会自动转存为你的博客封面');
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error('请输入分组名称');
      return;
    }
    try {
      setCreatingGroup(true);
      const created = await createGroup({
        name,
        groupType: 'blog',
        description: newGroupDesc.trim() || undefined,
      });
      toast.success('分组创建成功');
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
      setGroupId(created.id);
    } catch {
      toast.error('分组创建失败，请稍后重试');
    } finally {
      setCreatingGroup(false);
    }
  };

  const wordCount = useMemo(() => content.replace(/\s+/g, '').length, [content]);
  const readMinutes = useMemo(() => Math.max(1, Math.ceil(wordCount / 500)), [wordCount]);
  const isContentEmpty = !content.trim();
  const currentBatchGroupName = useMemo(
    () => groups.find((item) => item.id === batchGroupId)?.name || '',
    [groups, batchGroupId],
  );
  const actionBusy =
    submitting ||
    coverUploading ||
    aiExcerptLoading ||
    aiCoverLoading ||
    importingMarkdown ||
    batchPreparing ||
    batchRunning;
  const previewMarkdown = useMemo(() => {
    return `# ${title.trim() || '未命名标题'}\n\n${content.trim() || '开始输入正文内容吧。'}`;
  }, [title, content]);
  const isEditBootLoading = isEditMode && loadingPost && !title && !content;

  if (isEditBootLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-350 space-y-5">
          <div className="theme-panel-shell flex items-center gap-3 rounded-2xl border bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-theme-primary/20 bg-theme-soft/80">
              <Loader2 className="text-theme-primary h-4 w-4 animate-spin" />
              <span className="absolute inset-0 rounded-xl border border-theme-primary/15" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">正在加载博客内容...</p>
              <p className="text-xs text-slate-500">即将恢复编辑状态</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="theme-panel-shell w-full min-w-0 rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
              <Skeleton className="mb-4 h-5 w-28 rounded-lg bg-theme-soft/85" />
              <Skeleton className="mb-3 h-12 w-full rounded-xl" />
              <Skeleton className="mb-3 h-28 w-full rounded-xl" />
              <Skeleton className="mb-3 h-28 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </section>

            <section className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="theme-panel-shell rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
                <Skeleton className="mb-4 h-5 w-32 rounded-lg bg-theme-soft/85" />
                <Skeleton className="mb-3 h-9 w-full rounded-xl" />
                <Skeleton className="mb-3 h-9 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
              <div className="theme-panel-shell rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
                <Skeleton className="mb-3 h-5 w-28 rounded-lg bg-theme-soft/85" />
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
      <div className="mx-auto max-w-350">
        <div className="theme-panel-shell mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {isEditMode ? '编辑博客' : '博客创作'}
            </h1>
            <span className="border-theme-shell-border bg-theme-soft text-theme-primary rounded-full border px-3 py-1 text-xs shadow-sm">
              Markdown Pro
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="border-theme-panel-border bg-theme-soft/65 hidden items-center rounded-lg border p-1 md:inline-flex">
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'editor'
                    ? 'bg-theme-soft text-theme-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('editor')}
              >
                <PenSquare className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'split'
                    ? 'bg-theme-soft text-theme-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('split')}
              >
                分屏
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'preview'
                    ? 'bg-theme-soft text-theme-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setPreviewMode('preview')}
              >
                <Eye className="h-3.5 w-3.5" />
                预览
              </button>
            </div>
            <span className="hidden items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500 md:inline-flex">
              <Clock3 className="h-3.5 w-3.5" />
              Ctrl/Cmd + S 草稿保存
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
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                disabled={actionBusy || loadingPost}
                onClick={openBatchImportDialog}
                className="rounded-xl"
              >
                {batchPreparing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileStack className="mr-2 h-4 w-4" />
                )}
                {batchPreparing ? '识别中' : '批量导入 MD'}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={actionBusy}
              onClick={() => void handleSubmit('draft', { stayOnPage: isEditMode })}
              className="rounded-xl"
            >
              <Save className="mr-2 h-4 w-4" />
              保存草稿
            </Button>
            <Button
              disabled={actionBusy}
              onClick={() => void handleSubmit('published')}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              {isEditMode ? '更新并发布' : '发布博客'}
            </Button>
            <input
              ref={markdownImportInputRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              className="hidden"
              onChange={(event) => void handleImportMarkdown(event)}
            />
            <input
              ref={markdownBatchInputRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              multiple
              className="hidden"
              onChange={(event) => void handleBatchSelectMarkdown(event)}
            />
            <input
              ref={batchCoverUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleBatchCoverUpload(event)}
            />
          </div>
        </div>

        <div
          className={
            previewMode === 'split' ? 'grid gap-5 lg:grid-cols-[1.2fr_0.8fr]' : 'grid gap-5'
          }
        >
          {previewMode !== 'preview' && (
            <section className="theme-panel-shell w-full min-w-0 rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-500">写作区</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>字数：{wordCount}</span>
                  <span>预计阅读：{readMinutes} 分钟</span>
                </div>
              </div>

              {loadingPost ? (
                <div className="mb-2 h-12 animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入标题，抓住读者注意力"
                  maxLength={200}
                  className="theme-input-border mb-2 h-12 rounded-xl text-base"
                />
              )}

              <MdxMarkdownEditor value={content} onChange={setContent} />
            </section>
          )}

          {(previewMode === 'split' || previewMode === 'preview') && (
            <section className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="theme-panel-shell rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Sparkles className="text-theme-primary h-4 w-4" />
                  发布设置
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-500">摘要（可选）</span>
                      <button
                        type="button"
                        onClick={() => void handleAIGenerateExcerpt()}
                        disabled={isContentEmpty || aiExcerptLoading || submitting}
                        className="inline-flex h-6 items-center gap-1 rounded-lg border border-theme-primary/30 bg-theme-soft px-1.5 text-xs font-medium text-theme-primary transition hover:bg-theme-soft/75 disabled:cursor-not-allowed disabled:opacity-45"
                        title={isContentEmpty ? '请先输入正文内容' : 'AI 自动提取摘要'}
                      >
                        {aiExcerptLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {aiExcerptLoading ? '提取中' : 'AI截取摘要'}
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
                      <span className="text-xs text-slate-500">封面 URL（可选）</span>
                      <button
                        type="button"
                        onClick={() => void handleAIGenerateCover()}
                        disabled={isContentEmpty || aiCoverLoading || coverUploading || submitting}
                        className="inline-flex h-6 items-center gap-1 rounded-lg border border-theme-primary/30 bg-theme-soft px-1.5 text-xs font-medium text-theme-primary transition hover:bg-theme-soft/75 disabled:cursor-not-allowed disabled:opacity-45"
                        title={isContentEmpty ? '请先输入正文内容' : 'AI 自动配图为封面'}
                      >
                        {aiCoverLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="h-3.5 w-3.5" />
                        )}
                        {aiCoverLoading ? '配图中' : 'AI配图封面'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={cover}
                        onChange={(e) => {
                          if (coverFile || coverObjectUrl) resetLocalCoverEditing();
                          setCover(e.target.value);
                          setCoverStorageKey('');
                          setPendingCoverRemoteUrl('');
                        }}
                        placeholder="https://..."
                        maxLength={500}
                        className="rounded-xl"
                      />
                      <label className="border-theme-shell-border bg-theme-soft text-theme-primary hover:bg-theme-soft/75 inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border px-2.5 text-sm whitespace-nowrap">
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
                        选择壁纸
                      </Button>
                    </div>
                    {aiCoverLoading && (
                      <div className="border-theme-panel-border bg-theme-soft/55 relative mt-3 overflow-hidden rounded-xl border p-3">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 animate-pulse" />
                        <div className="relative flex items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-theme-primary/25 bg-white/80">
                            <div className="absolute inset-0 animate-ping rounded-xl bg-theme-primary/12" />
                            <Sparkles className="text-theme-primary relative h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-700">
                              {aiCoverSource === 'import'
                                ? '正在根据导入内容生成封面图...'
                                : 'AI 正在生成封面图...'}
                            </p>
                            <p className="text-xs text-slate-500">
                              你可以继续编辑正文，完成后会自动更新封面预览。
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[0, 1, 2].map((item) => (
                            <span
                              key={`ai-cover-loading-${item}`}
                              className="bg-theme-primary/20 h-1.5 rounded-full animate-pulse"
                              style={{ animationDelay: `${item * 180}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {(!!cover || !!coverObjectUrl) && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <div
                          ref={coverViewportRef}
                          className={`relative w-full overflow-hidden ${BLOG_COVER_ASPECT_CLASS}`}
                        >
                          <img
                            src={coverObjectUrl || cover}
                            alt=""
                            aria-hidden
                            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-3xl"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.34),rgba(255,255,255,0.06)_48%,transparent_78%)]" />
                          <img
                            src={coverObjectUrl || cover}
                            alt="博客封面预览"
                            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                            draggable={false}
                          />
                        </div>
                        {/* 可见范围标签 */}
                        <div className="px-3 py-1 text-xs text-slate-500">
                          当前可见范围：
                          {visibility === 'public'
                            ? '公开'
                            : visibility === 'shared'
                              ? '共享'
                              : '私密'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-slate-500">可见范围</div>
                    <div className="border-theme-panel-border bg-theme-soft/45 flex flex-wrap gap-2 rounded-xl border p-2">
                      {[
                        { label: '私密', value: 'private' as const },
                        { label: '共享', value: 'shared' as const },
                        { label: '公开', value: 'public' as const },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.value}
                          onClick={() => setVisibility(item.value)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            visibility === item.value
                              ? 'bg-theme-primary text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>文章分组</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                          onClick={() => navigate('/my-space/blog-groups?type=blog')}
                        >
                          管理分组
                        </button>
                        <button
                          type="button"
                          className="text-theme-primary hover:text-theme-primary-hover inline-flex items-center gap-1"
                          onClick={() => setShowCreateGroup((v) => !v)}
                        >
                          <Plus className="h-3 w-3" />
                          新建分组
                        </button>
                      </div>
                    </div>
                    <div className="border-theme-panel-border bg-theme-soft/45 flex flex-wrap gap-2 rounded-xl border p-2">
                      <button
                        type="button"
                        onClick={() => setGroupId('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          !groupId
                            ? 'bg-theme-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        未分组
                      </button>
                      {groups.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setGroupId(item.id)}
                          className={`rounded-full px-3 py-1.5 text-sm transition ${
                            groupId === item.id
                              ? 'bg-theme-primary text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>

                    {showCreateGroup && (
                      <div className="border-theme-shell-border bg-theme-soft/65 mt-3 rounded-xl border p-3">
                        <Input
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="分组名称，例如：前端思考"
                          className="mb-2 rounded-lg bg-white"
                        />
                        <Input
                          value={newGroupDesc}
                          onChange={(e) => setNewGroupDesc(e.target.value)}
                          placeholder="分组描述（可选）"
                          className="mb-2 rounded-lg bg-white"
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
              </div>

              <div className="theme-panel-shell rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-2 text-sm font-medium text-slate-800">实时预览</div>
                <div
                  className={`border-theme-panel-border bg-theme-soft/20 min-w-0 overflow-auto rounded-xl border p-4 ${
                    previewMode === 'preview' ? 'max-h-[760px]' : 'max-h-[520px]'
                  }`}
                >
                  <MarkdownPreview markdown={previewMarkdown} />
                </div>
              </div>
            </section>
          )}
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
      <PublicWallpaperPickerDialog
        open={wallpaperPickerOpen}
        onOpenChange={handleWallpaperPickerOpenChange}
        currentCoverUrl={
          batchCoverTargetIndex !== null ? batchItems[batchCoverTargetIndex]?.cover || '' : cover
        }
        onSelect={handleSelectPublicWallpaperCover}
      />
      <Dialog
        open={batchDialogOpen}
        onOpenChange={(open) => {
          if (!batchRunning) {
            setBatchDialogOpen(open);
            if (!open) resetBatchDialog();
          }
        }}
      >
        <DialogContent className="max-w-160!">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="text-theme-primary h-4 w-4" />
              批量导入博客 MD
            </DialogTitle>
            <DialogDescription>
              先上传 Markdown 文件，再确认识别结果并批量创建博客。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-theme-primary/20 bg-theme-soft/60 p-3">
              <div className="mb-2 text-xs font-medium text-theme-primary">批量发布设置</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-xs text-slate-500">目标分组</div>
                  <div className="border-theme-panel-border bg-theme-soft/45 flex max-h-28 flex-wrap gap-2 overflow-y-auto rounded-xl border p-2">
                    <button
                      type="button"
                      onClick={() => setBatchGroupId('')}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        !batchGroupId
                          ? 'bg-theme-primary text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      未分组
                    </button>
                    {groups.map((item) => (
                      <button
                        type="button"
                        key={`batch-${item.id}`}
                        onClick={() => setBatchGroupId(item.id)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          batchGroupId === item.id
                            ? 'bg-theme-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-slate-500">可见范围</div>
                  <div className="border-theme-panel-border bg-theme-soft/45 flex flex-wrap gap-2 rounded-xl border p-2">
                    {[
                      { label: '私密', value: 'private' as const },
                      { label: '共享', value: 'shared' as const },
                      { label: '公开', value: 'public' as const },
                    ].map((item) => (
                      <button
                        type="button"
                        key={`batch-visibility-${item.value}`}
                        onClick={() => setBatchVisibility(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          batchVisibility === item.value
                            ? 'bg-theme-primary text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                当前将发布到：{currentBatchGroupName || '未分组'}，
                {batchVisibility === 'public'
                  ? '公开'
                  : batchVisibility === 'shared'
                    ? '共享'
                    : '私密'}
              </p>
            </div>

            {!batchHasUploadedFiles && (
              <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-theme-primary/35 bg-theme-soft/35 px-6 text-center">
                <FileUp className="text-theme-primary mb-3 h-10 w-10" />
                <p className="mb-1 text-sm font-medium text-slate-700">上传 Markdown 文件</p>
                <p className="mb-4 text-xs text-slate-500">
                  支持一次导入多个 `.md` 文件并自动识别标题与正文。
                </p>
                <Button
                  type="button"
                  className="theme-btn-primary"
                  onClick={() => markdownBatchInputRef.current?.click()}
                  disabled={batchPreparing || batchRunning}
                >
                  {batchPreparing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      识别中…
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-1.5 h-4 w-4" />
                      上传文件
                    </>
                  )}
                </Button>
              </div>
            )}

            {batchHasUploadedFiles && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-600">
                    识别结果（共 {batchItems.length} 篇）
                  </label>
                  {!batchRunning && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 transition hover:text-slate-600"
                      onClick={() => markdownBatchInputRef.current?.click()}
                    >
                      上传文件
                    </button>
                  )}
                </div>
                <div className="max-h-84 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                  {batchItems.map((item, index) => (
                    <div
                      key={`${item.fileName}-${index}`}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        item.status === 'success'
                          ? 'border-emerald-100 bg-emerald-50'
                          : item.status === 'error'
                            ? 'border-rose-100 bg-rose-50'
                            : item.status === 'running'
                              ? 'border-theme-primary/30 bg-theme-soft/50'
                              : 'border-slate-100 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {item.status === 'running' ? (
                            <Loader2 className="text-theme-primary h-3.5 w-3.5 animate-spin" />
                          ) : item.status === 'success' ? (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-emerald-500" />
                          ) : item.status === 'error' ? (
                            <span className="inline-block h-3.5 w-3.5 rounded-full bg-rose-500" />
                          ) : (
                            <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-theme-primary/20 bg-theme-soft px-2 py-0.5 text-xs font-semibold text-theme-primary">
                              {item.title}
                            </span>
                            <span className="truncate text-xs text-slate-400">{item.fileName}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {item.error || item.content.slice(0, 120) || '未识别到正文内容'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(item.applyCover)}
                                onChange={(event) =>
                                  handleBatchCoverToggle(index, event.target.checked)
                                }
                                disabled={
                                  batchRunning ||
                                  item.status === 'running' ||
                                  item.status === 'success'
                                }
                              />
                              设置封面
                            </label>
                            {item.applyCover && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-xs"
                                  disabled={
                                    batchRunning || item.coverUploading || item.status === 'success'
                                  }
                                  onClick={() => handleOpenBatchCoverUpload(index)}
                                >
                                  {item.coverUploading ? (
                                    <>
                                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      上传中
                                    </>
                                  ) : (
                                    '上传图片'
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-xs"
                                  disabled={
                                    batchRunning || item.coverUploading || item.status === 'success'
                                  }
                                  onClick={() => handleOpenBatchWallpaperPicker(index)}
                                >
                                  选择资源壁纸
                                </Button>
                                <span className="text-slate-400">
                                  {item.cover ? '已设置封面' : '尚未选择图片'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {batchDone && (
                  <div className="flex gap-3 text-xs">
                    <span className="text-emerald-600">
                      成功 {batchItems.filter((item) => item.status === 'success').length}
                    </span>
                    {batchItems.filter((item) => item.status === 'error').length > 0 && (
                      <span className="text-rose-500">
                        失败 {batchItems.filter((item) => item.status === 'error').length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={batchRunning}
                onClick={() => {
                  setBatchDialogOpen(false);
                  resetBatchDialog();
                }}
              >
                {batchDone ? '关闭' : '取消'}
              </Button>
              {batchDone && batchItems.some((item) => item.status === 'error') && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={batchRunning}
                  onClick={() => void handleBatchImport({ retryFailedOnly: true })}
                >
                  重试失败项
                </Button>
              )}
              {!batchDone && batchHasUploadedFiles && (
                <Button
                  type="button"
                  className="theme-btn-primary"
                  disabled={batchRunning || batchItems.every((item) => item.status !== 'pending')}
                  onClick={() => void handleBatchImport()}
                >
                  {batchRunning ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      创建中…
                    </>
                  ) : (
                    <>
                      <FileStack className="mr-1.5 h-4 w-4" />
                      确认创建
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
