import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderTree,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Group as BlogGroup,
  type Post as BlogPost,
  deletePost,
  getAdminGroups,
  getAdminPosts,
  updatePost,
  type Visibility,
} from '@/api/blog';
import { BlogPostCard, ImageTextPostCard } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePageRoleGuard } from '@/hooks/usePageRoleGuard';

const BLOG_PAGE_SIZE = 6;
const IMAGE_TEXT_PAGE_SIZE = 4;

export default function MyPosts() {
  const navigate = useNavigate();
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

  const [blogGroupFilter, setBlogGroupFilter] = useState('');
  const [imageTextGroupFilter, setImageTextGroupFilter] = useState('');
  const [blogPage, setBlogPage] = useState(1);
  const [imageTextPage, setImageTextPage] = useState(1);

  const [deletePostTarget, setDeletePostTarget] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchVisibilityOpen, setBatchVisibilityOpen] = useState(false);
  const [batchUpdatingVisibility, setBatchUpdatingVisibility] = useState(false);

  const blogTotalPages = Math.max(1, Math.ceil(blogTotal / BLOG_PAGE_SIZE));
  const imageTextTotalPages = Math.max(1, Math.ceil(imageTextTotal / IMAGE_TEXT_PAGE_SIZE));

  const visiblePosts = useMemo(
    () => [...blogPosts, ...imageTextPosts],
    [blogPosts, imageTextPosts],
  );
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
    setBlogPage(1);
  }, [blogGroupFilter]);

  useEffect(() => {
    setImageTextPage(1);
  }, [imageTextGroupFilter]);

  useEffect(() => {
    setBlogPage((prev) => Math.min(prev, blogTotalPages));
  }, [blogTotalPages]);

  useEffect(() => {
    setImageTextPage((prev) => Math.min(prev, imageTextTotalPages));
  }, [imageTextTotalPages]);

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
                  onClick={() => navigate('/my-space/image-text')}
                  className="rounded-xl"
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" />
                  新建图文
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
                  onClick={() => setBatchMode(true)}
                  disabled={loadingPosts || visiblePosts.length === 0}
                  className="rounded-xl"
                >
                  <CheckSquare className="mr-1.5 h-4 w-4" />
                  批量设置访问状态
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

        <div className="space-y-10 rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
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
                  disabled={selectedCount === 0 || batchUpdatingVisibility}
                  onClick={() => setBatchVisibilityOpen(true)}
                  className="theme-btn-primary ml-auto h-8 rounded-lg"
                >
                  <Globe className="mr-1 h-3.5 w-3.5" />
                  设置访问状态
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
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-theme-shell-border hover:text-theme-primary">
                  {blogGroupFilter
                    ? blogGroups.find((g) => g.id === blogGroupFilter)?.name || '博客分组'
                    : '全部博客分组'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => setBlogGroupFilter('')}>
                    全部博客分组
                  </DropdownMenuItem>
                  {blogGroups.map((group) => (
                    <DropdownMenuItem key={group.id} onClick={() => setBlogGroupFilter(group.id)}>
                      {group.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loadingPosts ? (
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
                      onClick={() => setBlogPage((prev) => Math.max(1, prev - 1))}
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
                      onClick={() => setBlogPage((prev) => Math.min(blogTotalPages, prev + 1))}
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
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-theme-shell-border hover:text-theme-primary">
                  {imageTextGroupFilter
                    ? imageTextGroups.find((g) => g.id === imageTextGroupFilter)?.name || '图文分组'
                    : '全部图文分组'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => setImageTextGroupFilter('')}>
                    全部图文分组
                  </DropdownMenuItem>
                  {imageTextGroups.map((group) => (
                    <DropdownMenuItem
                      key={group.id}
                      onClick={() => setImageTextGroupFilter(group.id)}
                    >
                      {group.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loadingPosts ? (
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
                      onClick={() => setImageTextPage((prev) => Math.max(1, prev - 1))}
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
                        setImageTextPage((prev) => Math.min(imageTextTotalPages, prev + 1))
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
        </div>
      </div>

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
