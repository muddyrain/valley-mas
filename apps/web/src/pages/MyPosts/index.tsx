import {
  ChevronDown,
  ExternalLink,
  FileText,
  FolderTree,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
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

export default function MyPosts() {
  const navigate = useNavigate();
  const { canAccess } = usePageRoleGuard({
    allowRoles: ['creator'],
    unauthorizedMessage: '该页面仅创作者可访问',
  });

  const [myPosts, setMyPosts] = useState<BlogPost[]>([]);
  const [blogGroups, setBlogGroups] = useState<BlogGroup[]>([]);
  const [imageTextGroups, setImageTextGroups] = useState<BlogGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [blogGroupFilter, setBlogGroupFilter] = useState('');
  const [imageTextGroupFilter, setImageTextGroupFilter] = useState('');

  // 删除确认
  const [deletePostTarget, setDeletePostTarget] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const loadMyPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const [postsData, blogGroupsData, imageTextGroupsData] = await Promise.all([
        getAdminPosts({ page: 1, pageSize: 100 }),
        getAdminGroups({ groupType: 'blog' }),
        getAdminGroups({ groupType: 'image_text' }),
      ]);
      setMyPosts(postsData.list || []);
      setBlogGroups(blogGroupsData || []);
      setImageTextGroups(imageTextGroupsData || []);
    } catch {
      toast.error('加载内容失败');
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      void loadMyPosts();
    }
  }, [canAccess, loadMyPosts]);

  const filteredBlogPosts = useMemo(
    () =>
      myPosts.filter((post) => {
        if (post.postType !== 'blog') return false;
        if (blogGroupFilter && post.groupId !== blogGroupFilter) return false;
        return true;
      }),
    [blogGroupFilter, myPosts],
  );

  const filteredImageTextPosts = useMemo(
    () =>
      myPosts.filter((post) => {
        if (post.postType !== 'image_text') return false;
        if (imageTextGroupFilter && post.groupId !== imageTextGroupFilter) return false;
        return true;
      }),
    [imageTextGroupFilter, myPosts],
  );

  const handleDeletePost = async () => {
    if (!deletePostTarget) return;
    try {
      setDeletingPost(true);
      await deletePost(deletePostTarget.id);
      toast.success('删除成功');
      setDeletePostTarget(null);
      await loadMyPosts();
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setDeletingPost(false);
    }
  };

  const renderPostFooter = (post: BlogPost) => (
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

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        {/* 页头 */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/my-space')}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-theme-primary transition-colors"
            >
              ← 返回创作空间
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">内容管理</h1>
            <p className="mt-1 text-sm text-slate-500">管理你的全部博客与图文内容</p>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* 内容面板 */}
        <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6 space-y-10">
          {/* 博客列表 */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-theme-primary" />
                  <h2 className="text-xl font-semibold text-slate-900">博客列表</h2>
                </div>
                <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary">
                  {filteredBlogPosts.length} 篇
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
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                ))}
              </div>
            ) : filteredBlogPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                当前筛选下还没有博客内容，先去发布一篇吧。
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredBlogPosts.map((post) => (
                  <BlogPostCard
                    key={post.id}
                    post={post}
                    mode="creator"
                    footer={renderPostFooter(post)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* 图文列表 */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-theme-primary" />
                  <h2 className="text-xl font-semibold text-slate-900">图文展示列</h2>
                </div>
                <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary-hover">
                  {filteredImageTextPosts.length} 组
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
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                ))}
              </div>
            ) : filteredImageTextPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft p-10 text-center text-sm text-theme-primary-hover">
                当前筛选下还没有图文内容。
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {filteredImageTextPosts.map((post) => (
                  <ImageTextPostCard
                    key={post.id}
                    post={post}
                    mode="creator"
                    footer={renderPostFooter(post)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== 内容删除弹窗 ===== */}
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
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {deletingPost ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
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
