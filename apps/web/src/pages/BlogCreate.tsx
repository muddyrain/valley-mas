import {
  ArrowLeft,
  Clock3,
  Eye,
  ImagePlus,
  Loader2,
  PenSquare,
  Plus,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createGroup,
  createPost,
  type Group,
  getAdminGroups,
  getAdminPostDetail,
  updatePost,
  uploadBlogCover,
} from '@/api/blog';
import { MarkdownPreview } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';

type LocalDraft = {
  title: string;
  excerpt: string;
  cover: string;
  coverStorageKey: string;
  content: string;
  groupId: string;
  updatedAt: string;
};

const LOCAL_CREATE_DRAFT_KEY = 'valley-blog-create-draft-v2';

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function BlogCreate() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const isEditMode = Boolean(editingId);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [cover, setCover] = useState('');
  const [coverStorageKey, setCoverStorageKey] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [previewMode, setPreviewMode] = useState<'editor' | 'split' | 'preview'>('split');
  const [loadingPost, setLoadingPost] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState('');
  const [draftRecovered, setDraftRecovered] = useState(false);

  const loadGroups = async () => {
    try {
      const list = await getAdminGroups();
      setGroups(list || []);
      if (!groupId && list?.[0]?.id) {
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
      if (detail.postType !== 'blog') {
        toast.error('当前仅支持编辑博客类型内容');
        navigate('/my-space');
        return;
      }
      setTitle(detail.title || '');
      setExcerpt(detail.excerpt || '');
      setCover(detail.cover || '');
      setCoverStorageKey(detail.coverStorageKey || '');
      setContent(detail.content || '');
      setGroupId(detail.groupId || '');
    } catch {
      toast.error('加载博客内容失败');
      navigate('/my-space');
    } finally {
      setLoadingPost(false);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, user?.role, editingId]);

  useEffect(() => {
    if (isEditMode) return;
    try {
      const raw = localStorage.getItem(LOCAL_CREATE_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as LocalDraft;
      if (!draft) return;
      if (!draft.title && !draft.content && !draft.excerpt && !draft.cover) return;
      setTitle(draft.title || '');
      setExcerpt(draft.excerpt || '');
      setCover(draft.cover || '');
      setCoverStorageKey(draft.coverStorageKey || '');
      setContent(draft.content || '');
      setGroupId(draft.groupId || '');
      setLastAutoSavedAt(draft.updatedAt || '');
      setDraftRecovered(true);
    } catch {
      // ignore local parse error
    }
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode || loadingPost) return;
    const timer = setTimeout(() => {
      const draft: LocalDraft = {
        title,
        excerpt,
        cover,
        coverStorageKey,
        content,
        groupId,
        updatedAt: new Date().toISOString(),
      };

      const hasData = [title, excerpt, cover, coverStorageKey, content, groupId].some((item) =>
        item.trim(),
      );
      if (!hasData) {
        localStorage.removeItem(LOCAL_CREATE_DRAFT_KEY);
        setLastAutoSavedAt('');
        return;
      }
      localStorage.setItem(LOCAL_CREATE_DRAFT_KEY, JSON.stringify(draft));
      setLastAutoSavedAt(draft.updatedAt);
    }, 700);

    return () => clearTimeout(timer);
  }, [isEditMode, loadingPost, title, excerpt, cover, coverStorageKey, content, groupId]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSubmit('draft', {
          stayOnPage: isEditMode,
          fromShortcut: true,
        });
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, excerpt, cover, coverStorageKey, groupId, isEditMode, editingId]);

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
      if (isEditMode && editingId) {
        await updatePost(editingId, {
          title: trimmedTitle,
          postType: 'blog',
          content: trimmedContent,
          excerpt: excerpt.trim() || trimmedContent.slice(0, 120),
          cover: cover.trim() || '',
          coverStorageKey: coverStorageKey.trim() || '',
          groupId: groupId || '0',
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
          excerpt: excerpt.trim() || trimmedContent.slice(0, 120),
          cover: cover.trim() || undefined,
          coverStorageKey: coverStorageKey.trim() || undefined,
          groupId: groupId || undefined,
          status,
          publishNow: status === 'published',
        });
        toast.success(status === 'published' ? '博客发布成功' : '草稿保存成功');
        if (status !== 'published') {
          localStorage.removeItem(LOCAL_CREATE_DRAFT_KEY);
        }
      }
      if (!options?.stayOnPage) {
        navigate('/blog');
      }
    } catch {
      toast.error(status === 'published' ? '提交失败，请稍后重试' : '保存失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('封面仅支持图片');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('封面大小不能超过 10MB');
      return;
    }

    try {
      setCoverUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadBlogCover(formData);
      setCover(result.url);
      setCoverStorageKey(result.storageKey);
      toast.success('封面上传成功');
    } catch {
      toast.error('封面上传失败，请重试');
    } finally {
      setCoverUploading(false);
      event.target.value = '';
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
  const previewMarkdown = useMemo(() => {
    return `# ${title.trim() || '未命名标题'}\n\n${content.trim() || '开始输入正文内容吧。'}`;
  }, [title, content]);
  const isEditBootLoading = isEditMode && loadingPost && !title && !content;

  if (isEditBootLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(145deg,#f4f3ff_0%,#edf6ff_48%,#f8fbff_100%)] px-4 py-6 md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-violet-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            <span className="text-sm text-slate-600">正在加载博客内容...</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
              <div className="mb-4 h-5 w-20 animate-pulse rounded bg-slate-100" />
              <div className="mb-3 h-12 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-[620px] animate-pulse rounded-xl bg-slate-100" />
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-3 h-5 w-24 animate-pulse rounded bg-slate-100" />
                <div className="space-y-3">
                  <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                  <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-3 h-5 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-[380px] animate-pulse rounded-xl bg-slate-100" />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[linear-gradient(145deg,#f4f3ff_0%,#edf6ff_48%,#f8fbff_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回
            </Button>
            <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
              {isEditMode ? '编辑博客' : '博客创作'}
            </h1>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-700 shadow-sm">
              Markdown Pro
            </span>
            {!isEditMode && draftRecovered && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                已恢复本地草稿
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-1 md:inline-flex">
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                  previewMode === 'editor'
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
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
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
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
                    ? 'bg-violet-50 text-violet-700 shadow-sm'
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
              variant="outline"
              disabled={submitting}
              onClick={() =>
                void handleSubmit('draft', {
                  stayOnPage: isEditMode,
                })
              }
              className="rounded-xl"
            >
              <Save className="mr-2 h-4 w-4" />
              保存草稿
            </Button>
            <Button
              disabled={submitting}
              onClick={() => void handleSubmit('published')}
              className="rounded-xl"
            >
              <Send className="mr-2 h-4 w-4" />
              {isEditMode ? '更新并发布' : '发布博客'}
            </Button>
          </div>
        </div>

        <div
          className={
            previewMode === 'split' ? 'grid gap-5 lg:grid-cols-[1.2fr_0.8fr]' : 'grid gap-5'
          }
        >
          {previewMode !== 'preview' && (
            <section className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-slate-500">写作区</div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>字数：{wordCount}</span>
                  <span>预计阅读：{readMinutes} 分钟</span>
                  {lastAutoSavedAt && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                      自动保存 {formatTime(lastAutoSavedAt)}
                    </span>
                  )}
                </div>
              </div>

              {loadingPost ? (
                <div className="mb-3 h-12 animate-pulse rounded-xl bg-slate-100" />
              ) : (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入标题，抓住读者注意力"
                  maxLength={200}
                  className="mb-3 h-12 rounded-xl border-slate-300 text-base"
                />
              )}

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在这里直接写 Markdown 原文。支持标题、列表、代码块、引用等标准语法。"
                className="min-h-[620px] w-full rounded-xl border border-slate-300 bg-[#fcfcff] p-4 font-mono text-[15px] leading-8 outline-none focus:ring-2 focus:ring-violet-200"
              />
            </section>
          )}

          {(previewMode === 'split' || previewMode === 'preview') && (
            <section className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  发布设置
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">摘要（可选）</div>
                    <Input
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      placeholder="留空则自动截取正文"
                      maxLength={500}
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-slate-500">封面 URL（可选）</div>
                    <div className="flex gap-2">
                      <Input
                        value={cover}
                        onChange={(e) => {
                          setCover(e.target.value);
                          setCoverStorageKey('');
                        }}
                        placeholder="https://..."
                        maxLength={500}
                        className="rounded-xl"
                      />
                      <label className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-violet-300 bg-violet-50 px-2.5 text-sm text-violet-700 whitespace-nowrap hover:bg-violet-100">
                        <ImagePlus className="mr-1 h-4 w-4" />
                        {coverUploading ? '上传中' : '上传'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={coverUploading}
                          onChange={handleUploadCover}
                        />
                      </label>
                    </div>
                    {!!cover && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        <img src={cover} alt="博客封面预览" className="h-32 w-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>文章分组</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                          onClick={() => navigate('/my-space/blog-groups')}
                        >
                          管理分组
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700"
                          onClick={() => setShowCreateGroup((v) => !v)}
                        >
                          <Plus className="h-3 w-3" />
                          新建分组
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                      <button
                        type="button"
                        onClick={() => setGroupId('')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          !groupId
                            ? 'bg-violet-600 text-white shadow-sm'
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
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>

                    {showCreateGroup && (
                      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
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

              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm md:p-5">
                <div className="mb-2 text-sm font-medium text-slate-800">实时预览</div>
                <div
                  className={`overflow-auto rounded-xl border border-slate-200 bg-[#fdfdff] p-4 ${
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
    </div>
  );
}
