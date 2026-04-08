import {
  ArrowLeft,
  Clock3,
  Eye,
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
import { MarkdownPreview } from '@/components/blog';
import { CoverCropDialog } from '@/components/blog/CoverCropDialog';
import { MdxMarkdownEditor } from '@/components/blog/MdxMarkdownEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';
import { createPlainTextExcerpt } from '@/utils/blog';

type CoverImageMeta = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createAutoExcerpt(excerpt: string, content: string) {
  const trimmedExcerpt = excerpt.trim();
  if (trimmedExcerpt) return trimmedExcerpt;
  return createPlainTextExcerpt(content.trim(), 180);
}

function base64ToImageFile(base64: string, mimeType: string, fileName: string) {
  const normalized = base64.includes(',') ? (base64.split(',').pop() ?? '') : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

function normalizeImportedTitle(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseMarkdownImport(fileName: string, rawText: string) {
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let body = normalized.trim();
  let frontMatterTitle = '';

  const frontMatterMatch = body.match(/^---\n([\s\S]*?)\n---\n*/);
  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1];
    body = body.slice(frontMatterMatch[0].length).trim();
    const titleMatch = frontMatter.match(/^\s*title\s*:\s*(.+)\s*$/im);
    if (titleMatch) {
      frontMatterTitle = normalizeImportedTitle(titleMatch[1]);
    }
  }

  const headingMatch = body.match(/^(?:\s*\n)*#\s+(.+?)\s*(?:\n|$)/);
  const headingTitle = headingMatch ? normalizeImportedTitle(headingMatch[1]) : '';
  const fileTitle = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const parsedTitle = frontMatterTitle || headingTitle || fileTitle || '未命名博客';

  if (!frontMatterTitle && headingMatch) {
    body = body.slice(headingMatch[0].length).trim();
  }

  return {
    title: parsedTitle,
    content: body,
  };
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
  const currentEditingIdRef = useRef<string | undefined>(editingId);

  const coverViewportRef = useRef<HTMLDivElement | null>(null);
  const markdownImportInputRef = useRef<HTMLInputElement | null>(null);

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

    const sourceX = clamp((0 - drawX) / renderScale, 0, coverImageMeta.width);
    const sourceY = clamp((0 - drawY) / renderScale, 0, coverImageMeta.height);
    const sourceW = clamp(boxW / renderScale, 1, coverImageMeta.width - sourceX);
    const sourceH = clamp(boxH / renderScale, 1, coverImageMeta.height - sourceY);

    const outputW = 1200;
    const outputH = 480;
    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, outputW, outputH);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
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
      if (!pendingCoverRemoteUrl) {
        return {
          cover: cover.trim(),
          coverStorageKey: coverStorageKey.trim(),
        };
      }

      setCoverUploading(true);
      try {
        const result = await uploadBlogCoverByUrl({ url: pendingCoverRemoteUrl });
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
        if (coverFile || coverObjectUrl) {
          resetLocalCoverEditing();
        }
        setCover(result.imageUrl);
        setCoverStorageKey('');
        setPendingCoverRemoteUrl(result.imageUrl);
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

      toast.success('MD 导入成功，正在生成 AI 封面...');
      await handleAIGenerateCover({
        title: parsed.title,
        excerpt: '',
        content: parsedContent,
        source: 'import',
      });
    } catch {
      toast.error('MD 导入失败，请检查文件后重试');
    } finally {
      setImportingMarkdown(false);
      event.target.value = '';
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
  const actionBusy =
    submitting || coverUploading || aiExcerptLoading || aiCoverLoading || importingMarkdown;
  const previewMarkdown = useMemo(() => {
    return `# ${title.trim() || '未命名标题'}\n\n${content.trim() || '开始输入正文内容吧。'}`;
  }, [title, content]);
  const isEditBootLoading = isEditMode && loadingPost && !title && !content;

  if (isEditBootLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="theme-panel-shell mb-5 flex items-center gap-3 rounded-2xl border bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <Loader2 className="text-theme-primary h-4 w-4 animate-spin" />
            <span className="text-sm text-slate-600">正在加载博客内容...</span>
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
          </div>
        </div>

        <div
          className={
            previewMode === 'split' ? 'grid gap-5 lg:grid-cols-[1.2fr_0.8fr]' : 'grid gap-5'
          }
        >
          {previewMode !== 'preview' && (
            <section className="theme-panel-shell w-full rounded-2xl border bg-white/95 p-4 shadow-sm md:p-5">
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
            <section className="space-y-4 lg:sticky lg:top-20 lg:self-start">
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
                          className="relative aspect-[5/2] w-full overflow-hidden"
                        >
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
                  className={`border-theme-panel-border bg-theme-soft/20 overflow-auto rounded-xl border p-4 ${
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
    </div>
  );
}
