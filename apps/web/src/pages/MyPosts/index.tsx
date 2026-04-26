import {
  ArrowUpDown,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  FileUp,
  FolderTree,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Group as BlogGroup,
  type Post as BlogPost,
  deletePost,
  getAdminGroups,
  getAdminPosts,
  updatePost,
  uploadBlogCover,
  uploadBlogCoverByUrl,
  type Visibility,
} from '@/api/blog';
import type { Resource } from '@/api/resource';
import { BlogPostCard, ImageTextPostCard } from '@/components/blog';
import { BatchMarkdownImportDialog } from '@/components/blog/BatchMarkdownImportDialog';
import BlogSortDialog from '@/components/blog/BlogSortDialog';
import PostGroupDropdown from '@/components/blog/PostGroupDropdown';
import { PublicWallpaperPickerDialog } from '@/components/blog/PublicWallpaperPickerDialog';
import PanelLoadingOverlay from '@/components/PanelLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePageRoleGuard } from '@/hooks/usePageRoleGuard';
import { numberParam, stringParam, useUrlQueryState } from '@/hooks/useUrlPaginationQuery';

const BLOG_PAGE_SIZE = 6;
const IMAGE_TEXT_PAGE_SIZE = 4;
const MY_POSTS_QUERY_SCHEMA = {
  blogPage: numberParam(1, { min: 1 }),
  imageTextPage: numberParam(1, { min: 1 }),
  blogGroupId: stringParam('', { resetPageOnChange: true }),
  imageTextGroupId: stringParam('', { resetPageOnChange: true }),
};

type BatchCoverItem = {
  id: string;
  title: string;
  postType: 'blog' | 'image_text';
  applyCover: boolean;
  cover: string;
  coverStorageKey: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error?: string;
  uploading?: boolean;
};

export default function MyPosts() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    values: {
      blogPage,
      imageTextPage,
      blogGroupId: blogGroupFilter,
      imageTextGroupId: imageTextGroupFilter,
    },
    setValue,
  } = useUrlQueryState(MY_POSTS_QUERY_SCHEMA);
  const { canAccess } = usePageRoleGuard({
    allowRoles: ['creator'],
    unauthorizedMessage: '该页面仅创作者可访问',
  });

  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [imageTextPosts, setImageTextPosts] = useState<BlogPost[]>([]);
  const [imageTextTotal, setImageTextTotal] = useState(0);
  const [blogGroups, setBlogGroups] = useState<BlogGroup[]>([]);
  const [imageTextGroups, setImageTextGroups] = useState<BlogGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [deletePostTarget, setDeletePostTarget] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchVisibilityOpen, setBatchVisibilityOpen] = useState(false);
  const [batchUpdatingVisibility, setBatchUpdatingVisibility] = useState(false);
  const [batchCoverDialogOpen, setBatchCoverDialogOpen] = useState(false);
  const [batchCoverItems, setBatchCoverItems] = useState<BatchCoverItem[]>([]);
  const [batchCoverRunning, setBatchCoverRunning] = useState(false);
  const [batchCoverDone, setBatchCoverDone] = useState(false);
  const [batchCoverTargetIndex, setBatchCoverTargetIndex] = useState<number | null>(null);
  const [batchWallpaperPickerOpen, setBatchWallpaperPickerOpen] = useState(false);
  const [batchSettingsOpen, setBatchSettingsOpen] = useState(false);
  const [batchImportDialogOpen, setBatchImportDialogOpen] = useState(false);
  const [blogSortDialogOpen, setBlogSortDialogOpen] = useState(false);
  const batchCoverUploadInputRef = useRef<HTMLInputElement | null>(null);

  const blogTotalPages = Math.max(1, Math.ceil(blogTotal / BLOG_PAGE_SIZE));
  const imageTextTotalPages = Math.max(1, Math.ceil(imageTextTotal / IMAGE_TEXT_PAGE_SIZE));

  const visiblePosts = useMemo(
    () => [...blogPosts, ...imageTextPosts],
    [blogPosts, imageTextPosts],
  );
  const hasLoadedPosts = visiblePosts.length > 0;
  const showPostLoadingOverlay = loadingPosts && hasLoadedPosts;
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visiblePosts.length > 0 && visiblePosts.every((post) => selectedIds.has(post.id));

  const loadGroups = useCallback(async () => {
    try {
      const [blogGroupsData, imageTextGroupsData] = await Promise.all([
        getAdminGroups({ groupType: 'blog' }),
        getAdminGroups({ groupType: 'image_text' }),
      ]);
      setBlogGroups(blogGroupsData || []);
      setImageTextGroups(imageTextGroupsData || []);
    } catch {
      toast.error('加载分组失败');
    }
  }, []);

  const loadPostsPage = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const [blogData, imageTextData] = await Promise.all([
        getAdminPosts({
          page: blogPage,
          pageSize: BLOG_PAGE_SIZE,
          postType: 'blog',
          groupId: blogGroupFilter || undefined,
        }),
        getAdminPosts({
          page: imageTextPage,
          pageSize: IMAGE_TEXT_PAGE_SIZE,
          postType: 'image_text',
          groupId: imageTextGroupFilter || undefined,
        }),
      ]);
      setBlogPosts(blogData.list || []);
      setBlogTotal(blogData.total || 0);
      setImageTextPosts(imageTextData.list || []);
      setImageTextTotal(imageTextData.total || 0);
    } catch {
      toast.error('加载内容失败');
    } finally {
      setLoadingPosts(false);
    }
  }, [blogGroupFilter, blogPage, imageTextGroupFilter, imageTextPage]);

  useEffect(() => {
    if (!canAccess) return;
    void loadGroups();
  }, [canAccess, loadGroups]);

  useEffect(() => {
    if (!canAccess) return;
    void loadPostsPage();
  }, [canAccess, loadPostsPage]);

  useEffect(() => {
    const refreshPostsAt = (location.state as { refreshPostsAt?: number } | null)?.refreshPostsAt;
    if (!refreshPostsAt || !canAccess) return;

    void loadPostsPage();
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [canAccess, loadPostsPage, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (blogPage <= blogTotalPages) return;
    setValue('blogPage', blogTotalPages);
  }, [blogPage, blogTotalPages, setValue]);

  useEffect(() => {
    if (imageTextPage <= imageTextTotalPages) return;
    setValue('imageTextPage', imageTextTotalPages);
  }, [imageTextPage, imageTextTotalPages, setValue]);

  useEffect(() => {
    if (!batchMode) return;
    const visibleIdSet = new Set(visiblePosts.map((post) => post.id));
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => visibleIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [batchMode, visiblePosts]);

  const handleDeletePost = async () => {
    if (!deletePostTarget) return;
    try {
      setDeletingPost(true);
      await deletePost(deletePostTarget.id);
      toast.success('删除成功');
      setDeletePostTarget(null);
      await loadPostsPage();
    } finally {
      setDeletingPost(false);
    }
  };

  const handleToggleSelect = (postId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visiblePosts.map((post) => post.id)));
  };

  const handleExitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
    setBatchVisibilityOpen(false);
    setBatchCoverDialogOpen(false);
    setBatchCoverItems([]);
    setBatchCoverRunning(false);
    setBatchCoverDone(false);
    setBatchCoverTargetIndex(null);
    setBatchWallpaperPickerOpen(false);
    setBatchSettingsOpen(false);
  };

  const handleOpenBatchSettings = () => {
    setBatchMode(true);
    setBatchSettingsOpen(false);
  };

  const handleBatchVisibility = async (visibility: Visibility) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setBatchUpdatingVisibility(true);
      const result = await Promise.allSettled(ids.map((id) => updatePost(id, { visibility })));
      const successIds = new Set<string>();
      let failed = 0;

      result.forEach((item, index) => {
        if (item.status === 'fulfilled') {
          successIds.add(ids[index]);
        } else {
          failed += 1;
        }
      });

      if (successIds.size > 0) {
        setBlogPosts((prev) =>
          prev.map((post) => (successIds.has(post.id) ? { ...post, visibility } : post)),
        );
        setImageTextPosts((prev) =>
          prev.map((post) => (successIds.has(post.id) ? { ...post, visibility } : post)),
        );
        toast.success(`已更新 ${successIds.size} 篇内容的访问状态`);
      }
      if (failed > 0) {
        toast.error(`${failed} 篇内容更新失败，请稍后重试`);
      }

      setBatchVisibilityOpen(false);
      if (failed === 0) {
        handleExitBatchMode();
      } else {
        setSelectedIds(new Set(ids.filter((id) => !successIds.has(id))));
      }
    } catch {
      toast.error('批量设置访问状态失败');
    } finally {
      setBatchUpdatingVisibility(false);
    }
  };

  const openBatchCoverDialog = () => {
    const selectedPosts = visiblePosts.filter((post) => selectedIds.has(post.id));
    if (selectedPosts.length === 0) {
      toast.error('请先选择要设置封面的内容');
      return;
    }
    setBatchCoverItems(
      selectedPosts.map((post) => ({
        id: post.id,
        title: post.title || '未命名内容',
        postType: post.postType,
        applyCover: true,
        cover: post.cover || '',
        coverStorageKey: post.coverStorageKey || '',
        status: 'pending',
      })),
    );
    setBatchCoverDone(false);
    setBatchCoverDialogOpen(true);
  };

  const handleBatchCoverToggle = (index: number, checked: boolean) => {
    setBatchCoverItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              applyCover: checked,
              status: item.status === 'success' ? 'pending' : item.status,
              error: undefined,
            }
          : item,
      ),
    );
  };

  const handleOpenBatchCoverUpload = (index: number) => {
    if (batchCoverRunning) return;
    setBatchCoverTargetIndex(index);
    batchCoverUploadInputRef.current?.click();
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
    setBatchCoverItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, uploading: true, applyCover: true, status: 'pending', error: undefined }
          : item,
      ),
    );
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadBlogCover(formData);
      setBatchCoverItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                uploading: false,
                applyCover: true,
                cover: result.url,
                coverStorageKey: result.storageKey,
                status: 'pending',
                error: undefined,
              }
            : item,
        ),
      );
      toast.success('封面上传成功');
    } catch {
      setBatchCoverItems((prev) =>
        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, uploading: false } : item)),
      );
      toast.error('封面上传失败，请重试');
    } finally {
      setBatchCoverTargetIndex(null);
    }
  };

  const handleOpenBatchWallpaperPicker = (index: number) => {
    if (batchCoverRunning) return;
    setBatchCoverTargetIndex(index);
    setBatchWallpaperPickerOpen(true);
  };

  const handleSelectBatchCoverWallpaper = (resource: Resource) => {
    const index = batchCoverTargetIndex;
    if (index === null) return;
    const selectedUrl = (resource.url || '').trim();
    if (!selectedUrl) {
      toast.error('所选壁纸无可用地址');
      return;
    }
    setBatchCoverItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              applyCover: true,
              cover: selectedUrl,
              coverStorageKey: '',
              status: 'pending',
              error: undefined,
            }
          : item,
      ),
    );
    setBatchWallpaperPickerOpen(false);
    setBatchCoverTargetIndex(null);
    toast.success('已选择资源壁纸');
  };

  const handleBatchCoverSave = async (options?: { retryFailedOnly?: boolean }) => {
    const retryFailedOnly = options?.retryFailedOnly ?? false;
    const results = [...batchCoverItems];
    const runnableIndexes = results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (retryFailedOnly ? item.status === 'error' : item.applyCover))
      .map(({ index }) => index);

    if (runnableIndexes.length === 0) {
      toast.error(retryFailedOnly ? '没有可重试的失败项' : '没有可保存的封面项');
      return;
    }
    const missingCover = runnableIndexes.some((index) => !results[index].cover);
    if (missingCover) {
      toast.error('有条目尚未选择封面图片，请先上传或选择资源壁纸');
      return;
    }

    try {
      setBatchCoverRunning(true);
      setBatchCoverDone(false);
      const successMap = new Map<string, { cover: string; coverStorageKey: string }>();

      for (const index of runnableIndexes) {
        const item = results[index];
        results[index] = { ...item, status: 'running', error: undefined };
        setBatchCoverItems([...results]);
        try {
          let finalCover = item.cover;
          let finalStorageKey = item.coverStorageKey;
          if (!finalStorageKey) {
            const uploaded = await uploadBlogCoverByUrl({ url: item.cover });
            finalCover = uploaded.url;
            finalStorageKey = uploaded.storageKey;
          }
          await updatePost(item.id, { cover: finalCover, coverStorageKey: finalStorageKey });
          successMap.set(item.id, { cover: finalCover, coverStorageKey: finalStorageKey });
          results[index] = {
            ...item,
            cover: finalCover,
            coverStorageKey: finalStorageKey,
            status: 'success',
            error: undefined,
          };
        } catch {
          results[index] = {
            ...item,
            status: 'error',
            error: '设置失败，请稍后重试',
          };
        }
        setBatchCoverItems([...results]);
      }

      if (successMap.size > 0) {
        setBlogPosts((prev) =>
          prev.map((post) => {
            const next = successMap.get(post.id);
            return next
              ? { ...post, cover: next.cover, coverStorageKey: next.coverStorageKey }
              : post;
          }),
        );
        setImageTextPosts((prev) =>
          prev.map((post) => {
            const next = successMap.get(post.id);
            return next
              ? { ...post, cover: next.cover, coverStorageKey: next.coverStorageKey }
              : post;
          }),
        );
      }

      setBatchCoverDone(true);
      const successCount = results.filter((item) => item.status === 'success').length;
      const errorCount = results.filter((item) => item.status === 'error').length;
      if (successCount > 0) {
        toast.success(
          `批量设置封面完成：成功 ${successCount} 篇${errorCount ? `，失败 ${errorCount} 篇` : ''}`,
        );
      } else {
        toast.error('批量设置封面失败，请重试');
      }
    } finally {
      setBatchCoverRunning(false);
    }
  };

  const renderPostFooter = (post: BlogPost) => {
    if (batchMode) {
      const selected = selectedIds.has(post.id);
      return (
        <div className="flex items-center justify-end">
          <Button
            size="sm"
            variant={selected ? 'default' : 'outline'}
            className={`h-8 rounded-lg ${selected ? 'theme-btn-primary' : ''}`}
            onClick={() => handleToggleSelect(post.id)}
          >
            {selected ? (
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Square className="mr-1 h-3.5 w-3.5" />
            )}
            {selected ? '已选中' : '选择'}
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg"
          onClick={() =>
            navigate(`/blog/${post.id}`, {
              state: { returnTo: '/my-space/posts', returnLabel: '返回内容管理' },
            })
          }
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          查看
        </Button>
        {post.postType === 'blog' ? (
          <Button
            size="sm"
            className="h-8 rounded-lg"
            onClick={() => navigate(`/my-space/blog-edit/${post.id}`)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑博客
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 rounded-lg"
            onClick={() => navigate(`/my-space/image-text-edit/${post.id}`)}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            编辑图文
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          className="h-8 rounded-lg"
          onClick={() => setDeletePostTarget(post)}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          删除
        </Button>
      </div>
    );
  };

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/my-space')}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-theme-primary"
            >
              ← 返回创作空间
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">内容管理</h1>
            <p className="mt-1 text-sm text-slate-500">管理你的全部博客与图文内容</p>
          </div>

          <div className="flex items-center gap-2">
            {!batchMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/blog-create')}
                  className="rounded-xl"
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  新建博客
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBatchImportDialogOpen(true)}
                  className="rounded-xl"
                >
                  <FileUp className="mr-1.5 h-4 w-4" />
                  批量导入 MD
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/image-text')}
                  className="rounded-xl"
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" />
                  新建图文
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBlogSortDialogOpen(true)}
                  disabled={loadingPosts || blogTotal === 0}
                  className="rounded-xl"
                >
                  <ArrowUpDown className="mr-1.5 h-4 w-4" />
                  排序博客
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/blog-groups?type=blog')}
                  className="rounded-xl"
                >
                  <FolderTree className="mr-1.5 h-4 w-4" />
                  博客分组
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/blog-groups?type=image_text')}
                  className="rounded-xl"
                >
                  <FolderTree className="mr-1.5 h-4 w-4" />
                  图文分组
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenBatchSettings}
                  disabled={loadingPosts || visiblePosts.length === 0}
                  className="rounded-xl"
                >
                  <CheckSquare className="mr-1.5 h-4 w-4" />
                  批量设置博客
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={handleExitBatchMode} className="rounded-xl">
                <X className="mr-1.5 h-4 w-4" />
                退出批量
              </Button>
            )}
          </div>
        </div>

        <div className="relative space-y-10 rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
          {batchMode && (
            <div className="rounded-2xl border border-theme-soft-strong bg-theme-soft/45 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllVisible}
                  className="h-8 rounded-lg border-theme-soft-strong text-slate-700"
                >
                  {allVisibleSelected ? (
                    <CheckSquare className="mr-1 h-3.5 w-3.5 text-theme-primary" />
                  ) : (
                    <Square className="mr-1 h-3.5 w-3.5" />
                  )}
                  {allVisibleSelected ? '取消全选' : '全选当前页'}
                </Button>
                <span className="text-sm text-slate-500">
                  已选 <span className="font-semibold text-theme-primary">{selectedCount}</span> 篇
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={batchUpdatingVisibility || batchCoverRunning}
                  onClick={() => setBatchSettingsOpen(true)}
                  className="theme-btn-primary ml-auto h-8 rounded-lg"
                >
                  <ImagePlus className="mr-1 h-3.5 w-3.5" />
                  批量设置博客
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-theme-primary" />
                  <h2 className="text-xl font-semibold text-slate-900">博客列表</h2>
                </div>
                <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary">
                  {blogTotal} 篇
                </span>
              </div>
              <PostGroupDropdown
                groups={blogGroups}
                value={blogGroupFilter}
                onChange={(value) => setValue('blogGroupId', value)}
                allLabel="全部博客分组"
                triggerClassName="h-9 max-w-[min(18rem,100%)] px-3"
              />
            </div>

            {loadingPosts && !hasLoadedPosts ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: BLOG_PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                ))}
              </div>
            ) : blogPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                当前筛选下还没有博客内容，先去发布一篇吧。
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {blogPosts.map((post) => (
                    <BlogPostCard
                      key={post.id}
                      post={post}
                      mode="creator"
                      footer={renderPostFooter(post)}
                    />
                  ))}
                </div>
                {blogTotalPages > 1 ? (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={blogPage <= 1}
                      onClick={() => setValue('blogPage', Math.max(1, blogPage - 1))}
                      className="gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <span className="text-sm text-slate-500">
                      第 {blogPage} / {blogTotalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={blogPage >= blogTotalPages}
                      onClick={() => setValue('blogPage', Math.min(blogTotalPages, blogPage + 1))}
                      className="gap-1.5"
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-theme-primary" />
                  <h2 className="text-xl font-semibold text-slate-900">图文展示列表</h2>
                </div>
                <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary-hover">
                  {imageTextTotal} 篇
                </span>
              </div>
              <PostGroupDropdown
                groups={imageTextGroups}
                value={imageTextGroupFilter}
                onChange={(value) => setValue('imageTextGroupId', value)}
                allLabel="全部图文分组"
                triggerClassName="h-9 max-w-[min(18rem,100%)] px-3"
              />
            </div>

            {loadingPosts && !hasLoadedPosts ? (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {Array.from({ length: IMAGE_TEXT_PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                ))}
              </div>
            ) : imageTextPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft p-10 text-center text-sm text-theme-primary-hover">
                当前筛选下还没有图文内容。
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {imageTextPosts.map((post) => (
                    <ImageTextPostCard
                      key={post.id}
                      post={post}
                      mode="creator"
                      footer={renderPostFooter(post)}
                    />
                  ))}
                </div>
                {imageTextTotalPages > 1 ? (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={imageTextPage <= 1}
                      onClick={() => setValue('imageTextPage', Math.max(1, imageTextPage - 1))}
                      className="gap-1.5"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <span className="text-sm text-slate-500">
                      第 {imageTextPage} / {imageTextTotalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={imageTextPage >= imageTextTotalPages}
                      onClick={() =>
                        setValue('imageTextPage', Math.min(imageTextTotalPages, imageTextPage + 1))
                      }
                      className="gap-1.5"
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <PanelLoadingOverlay
            show={showPostLoadingOverlay}
            title="正在同步内容列表..."
            hint="分页和筛选结果更新中"
            className="rounded-[30px]"
          />
        </div>
      </div>

      <PublicWallpaperPickerDialog
        open={batchWallpaperPickerOpen}
        onOpenChange={(open) => {
          if (batchCoverRunning) return;
          setBatchWallpaperPickerOpen(open);
          if (!open) {
            setBatchCoverTargetIndex(null);
          }
        }}
        currentCoverUrl={
          batchCoverTargetIndex !== null ? batchCoverItems[batchCoverTargetIndex]?.cover || '' : ''
        }
        onSelect={handleSelectBatchCoverWallpaper}
      />
      <BatchMarkdownImportDialog
        open={batchImportDialogOpen}
        onOpenChange={setBatchImportDialogOpen}
        groups={blogGroups}
        defaultGroupId={blogGroupFilter}
        defaultVisibility="private"
        onCreated={async () => {
          await loadPostsPage();
        }}
      />
      <BlogSortDialog
        open={blogSortDialogOpen}
        onOpenChange={setBlogSortDialogOpen}
        groups={blogGroups}
        onSorted={async () => {
          await loadPostsPage();
        }}
      />

      <Dialog
        open={batchSettingsOpen}
        onOpenChange={(open) => {
          if (batchUpdatingVisibility || batchCoverRunning) return;
          setBatchSettingsOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <CheckSquare className="h-5 w-5 text-theme-primary" />
              批量设置博客
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">
              已选 <span className="font-semibold text-theme-primary">{selectedCount}</span> 篇内容
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={selectedCount === 0 || batchUpdatingVisibility || batchCoverRunning}
              onClick={() => {
                setBatchSettingsOpen(false);
                setBatchVisibilityOpen(true);
              }}
            >
              <Globe className="mr-2 h-4 w-4" />
              批量设置访问状态
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={selectedCount === 0 || batchUpdatingVisibility || batchCoverRunning}
              onClick={() => {
                setBatchSettingsOpen(false);
                openBatchCoverDialog();
              }}
            >
              <ImagePlus className="mr-2 h-4 w-4" />
              在线批量设置封面
            </Button>
            {selectedCount === 0 && (
              <p className="text-xs text-slate-400">请先在列表中勾选要批量处理的内容。</p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBatchSettingsOpen(false)}
            disabled={batchUpdatingVisibility || batchCoverRunning}
          >
            关闭
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={batchCoverDialogOpen}
        onOpenChange={(open) => {
          if (batchCoverRunning) return;
          setBatchCoverDialogOpen(open);
        }}
      >
        <DialogContent className="w-[92vw] max-w-[92vw] overflow-hidden sm:max-w-[1120px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <ImagePlus className="h-5 w-5 text-theme-primary" />
              在线批量设置封面
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500">
              参考批量导入识别结果流程：逐条确认要设置封面的内容，然后统一保存。
            </p>
            <div className="max-h-[60vh] space-y-2 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
              {batchCoverItems.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    item.status === 'success'
                      ? 'border-emerald-100 bg-emerald-50'
                      : item.status === 'error'
                        ? 'border-rose-100 bg-rose-50'
                        : item.status === 'running'
                          ? 'border-theme-primary/30 bg-theme-soft/45'
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
                        <span className="text-xs text-slate-400">
                          {item.postType === 'blog' ? '博客' : '图文'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600">
                          <input
                            type="checkbox"
                            checked={item.applyCover}
                            onChange={(event) =>
                              handleBatchCoverToggle(index, event.target.checked)
                            }
                            disabled={batchCoverRunning || item.status === 'running'}
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
                              disabled={batchCoverRunning || item.uploading}
                              onClick={() => handleOpenBatchCoverUpload(index)}
                            >
                              {item.uploading ? (
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
                              disabled={batchCoverRunning || item.uploading}
                              onClick={() => handleOpenBatchWallpaperPicker(index)}
                            >
                              选择资源壁纸
                            </Button>
                            <span className="text-slate-400">
                              {item.cover ? '已选择封面' : '尚未选择封面'}
                            </span>
                          </>
                        )}
                      </div>
                      {(item.error || item.cover) && (
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {item.error || `封面地址：${item.cover}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {batchCoverDone && (
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-600">
                  成功 {batchCoverItems.filter((item) => item.status === 'success').length}
                </span>
                {batchCoverItems.filter((item) => item.status === 'error').length > 0 && (
                  <span className="text-rose-500">
                    失败 {batchCoverItems.filter((item) => item.status === 'error').length}
                  </span>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={batchCoverRunning}
                onClick={() => setBatchCoverDialogOpen(false)}
              >
                关闭
              </Button>
              {batchCoverDone && batchCoverItems.some((item) => item.status === 'error') && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={batchCoverRunning}
                  onClick={() => void handleBatchCoverSave({ retryFailedOnly: true })}
                >
                  重试失败项
                </Button>
              )}
              <Button
                type="button"
                className="theme-btn-primary"
                disabled={batchCoverRunning}
                onClick={() => void handleBatchCoverSave()}
              >
                {batchCoverRunning ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <ImagePlus className="mr-1.5 h-4 w-4" />
                    保存封面设置
                  </>
                )}
              </Button>
            </div>
            <input
              ref={batchCoverUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleBatchCoverUpload(event)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={batchVisibilityOpen} onOpenChange={setBatchVisibilityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Globe className="h-5 w-5 text-theme-primary" />
              批量设置访问状态
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">
              将以下 <span className="font-semibold text-slate-700">{selectedCount}</span>{' '}
              篇内容统一设为：
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  value: 'public' as const,
                  icon: Globe,
                  label: '公开',
                  desc: '所有用户可见',
                  color:
                    'text-emerald-600 border-emerald-200 bg-emerald-50 hover:border-emerald-400',
                },
                {
                  value: 'shared' as const,
                  icon: Users,
                  label: '共享',
                  desc: '有链接或口令才可访问',
                  color: 'text-sky-600 border-sky-200 bg-sky-50 hover:border-sky-400',
                },
                {
                  value: 'private' as const,
                  icon: Lock,
                  label: '私密',
                  desc: '仅自己可见',
                  color: 'text-slate-600 border-slate-200 bg-slate-50 hover:border-slate-400',
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={batchUpdatingVisibility}
                  onClick={() => void handleBatchVisibility(opt.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all disabled:opacity-60 ${opt.color}`}
                >
                  <opt.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </div>
                  {batchUpdatingVisibility && (
                    <Loader2 className="ml-auto mt-0.5 h-4 w-4 animate-spin opacity-60" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBatchVisibilityOpen(false)}
            disabled={batchUpdatingVisibility}
          >
            取消
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletePostTarget}
        onOpenChange={(open) => !open && !deletingPost && setDeletePostTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              确认删除内容
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {deletePostTarget && (
              <div className="mb-4 rounded-xl bg-gray-50 p-3">
                <p className="line-clamp-2 text-sm font-medium text-gray-900">
                  {deletePostTarget.title}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {deletePostTarget.postType === 'image_text' ? '图文创作' : '博客'}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600">删除后将无法恢复，确认继续？</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeletePostTarget(null)}
              className="flex-1"
              disabled={deletingPost}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleDeletePost()}
              disabled={deletingPost}
              className="flex-1 bg-red-500 font-semibold text-white hover:bg-red-600"
            >
              {deletingPost ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  确认删除
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
