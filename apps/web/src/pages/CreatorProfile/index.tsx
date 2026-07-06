import {
  ArrowLeft,
  Award,
  Copy,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Search,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Album,
  type Creator,
  followCreator,
  getCreatorAlbums,
  getCreatorByCode,
  getCreatorFollowStatus,
  getCreatorWorks,
  type Resource,
  unfollowCreator,
} from '@/api/creator';
import { favoriteResource, unfavoriteResource } from '@/api/resource';
import PageBanner from '@/components/PageBanner';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  enumParam,
  numberParam,
  stringParam,
  useUrlQueryState,
} from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const categories = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const WORKS_PAGE_SIZE = 20;
const CREATOR_PROFILE_QUERY_SCHEMA = {
  page: numberParam(1, { min: 1 }),
  keyword: stringParam('', { resetPageOnChange: true }),
  type: enumParam(['', 'wallpaper', 'avatar'] as const, '', { resetPageOnChange: true }),
  albumId: stringParam('', { resetPageOnChange: true }),
  tab: enumParam(['works', 'albums'] as const, 'works'),
};

type WorksQueryParams = {
  keyword?: string;
  type?: string;
  albumId?: string;
  page?: number;
};

export default function CreatorProfile() {
  const { code } = useParams<{ code: string }>();
  const {
    values: {
      page: currentPage,
      keyword: currentKeyword,
      type: activeCategory,
      albumId: activeAlbumId,
      tab: activeTab,
    },
    setValue,
    setValues,
  } = useUrlQueryState(CREATOR_PROFILE_QUERY_SCHEMA, { pageKey: 'page' });
  const [creator, setCreator] = useState<Creator | null>(null);
  const [works, setWorks] = useState<Resource[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [searchKeyword, setSearchKeyword] = useState(currentKeyword);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksTotal, setWorksTotal] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});
  const user = useAuthStore((state) => state.user);
  const worksTotalPages = Math.max(1, Math.ceil(worksTotal / WORKS_PAGE_SIZE));

  const buildWorksParams = (overrides: WorksQueryParams = {}) => {
    const params: WorksQueryParams = {
      keyword: currentKeyword || undefined,
      type: activeCategory || undefined,
      albumId: activeAlbumId || undefined,
      page: currentPage,
      ...overrides,
    };

    if (params.keyword !== undefined && !params.keyword.trim()) {
      delete params.keyword;
    }
    if (!params.type) delete params.type;
    if (!params.albumId) delete params.albumId;
    if (!params.page || params.page < 1) params.page = 1;
    return params;
  };

  const hydrateWorks = (list: Resource[]) => {
    setWorks(list);
    const map: Record<string, boolean> = {};
    list.forEach((work) => {
      map[work.id] = work.isFavorited ?? false;
    });
    setFavoritedMap(map);
  };

  const loadWorks = async (creatorId: string, params: WorksQueryParams = {}) => {
    setWorksLoading(true);
    try {
      const page = params.page ?? 1;
      const data = await getCreatorWorks(creatorId, {
        ...params,
        page,
        pageSize: WORKS_PAGE_SIZE,
      });
      hydrateWorks(data.list);
      setWorksTotal(data.total || 0);
    } catch (error) {
      console.error('加载作品失败:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  useEffect(() => {
    setSearchKeyword(currentKeyword);
  }, [currentKeyword]);

  useEffect(() => {
    if (!code) return;

    const loadCreatorData = async () => {
      try {
        setLoading(true);
        const creatorData = await getCreatorByCode(code);
        setCreator(creatorData);
        setFollowerCount(creatorData.followerCount || 0);

        const [albumsData] = await Promise.all([
          getCreatorAlbums(creatorData.id),
          user?.id
            ? getCreatorFollowStatus(creatorData.id)
                .then((res) => {
                  setIsFollowing(res.following);
                  setFollowerCount(res.followerCount);
                  setIsSelf(res.isSelf);
                })
                .catch(() => {})
            : Promise.resolve(),
        ]);
        setAlbums(albumsData.list || []);
      } catch (error) {
        console.error('加载创作者数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [code, user?.id]);

  useEffect(() => {
    if (!creator) return;
    void loadWorks(creator.id, buildWorksParams());
  }, [creator, buildWorksParams, loadWorks]);

  const handleFollow = async () => {
    if (!creator || followLoading) return;

    try {
      setFollowLoading(true);
      if (isFollowing) {
        const res = await unfollowCreator(creator.id);
        setIsFollowing(res.following);
        setFollowerCount((n) => Math.max(0, n - 1));
      } else {
        const res = await followCreator(creator.id);
        setIsFollowing(res.following);
        setFollowerCount((n) => n + 1);
      }
    } catch (error) {
      console.error('关注操作失败:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent, work: Resource) => {
    e.stopPropagation();
    const isFav = favoritedMap[work.id] ?? false;
    try {
      if (isFav) {
        await unfavoriteResource(work.id);
        setFavoritedMap((prev) => ({ ...prev, [work.id]: false }));
        toast.success('已取消收藏');
      } else {
        await favoriteResource(work.id);
        setFavoritedMap((prev) => ({ ...prev, [work.id]: true }));
        toast.success('收藏成功');
      }
    } catch {
      toast.error('请先登录后再收藏');
    }
  };

  const handleShareProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('主页链接已复制');
    } catch {
      toast.error('复制失败，请手动复制地址栏链接');
    }
  };

  const handleCopyCreatorCode = async () => {
    if (!creator?.code) return;
    try {
      await navigator.clipboard.writeText(creator.code);
      toast.success('创作者编号已复制');
    } catch {
      toast.error('复制失败，请稍后重试');
    }
  };

  const handleSearch = async () => {
    setValue('keyword', searchKeyword);
  };

  const handleCategoryChange = async (categoryValue: string) => {
    setValue('type', categoryValue as '' | 'wallpaper' | 'avatar');
  };

  const handleAlbumOpen = async (albumId: string) => {
    setValues({
      albumId,
      tab: 'works',
    });
  };

  const handleClearAlbumFilter = async () => {
    setValue('albumId', '');
  };

  const handleWorksPageChange = async (page: number) => {
    if (worksLoading) return;
    const nextPage = Math.max(1, Math.min(worksTotalPages, page));
    if (nextPage === currentPage) return;
    setValue('page', nextPage);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)]">
        <PageBanner padding="py-6 md:py-8" maxWidth="max-w-6xl" tone="soft">
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-[5.5rem] rounded-xl" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-[5.5rem] rounded-full" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
              <div className="rounded-2xl border border-border bg-card p-4">
                <Skeleton className="mx-auto h-24 w-24 rounded-full md:h-28 md:w-28" />
                <Skeleton className="mx-auto mt-3 h-6 w-[8.5rem] rounded-lg" />
                <Skeleton className="mx-auto mt-2 h-4 w-24 rounded-md" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="space-y-3">
                  <Skeleton className="h-9 w-2/3 rounded-xl" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-5/6 rounded-md" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-[4.5rem] rounded-2xl" />
                  <Skeleton className="h-[4.5rem] rounded-2xl" />
                  <Skeleton className="h-[4.5rem] rounded-2xl" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-32 rounded-xl" />
                  <Skeleton className="h-9 w-28 rounded-xl" />
                  <Skeleton className="h-9 w-[6.5rem] rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </PageBanner>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card px-8 py-10 text-center">
          <div className="mb-2 text-lg font-semibold text-foreground">创作者不存在</div>
          <p className="mb-5 text-sm text-muted-foreground">可能已停用，或者链接已经失效。</p>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <PageBanner padding="py-6 md:py-8" maxWidth="max-w-6xl" tone="soft">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="h-10 gap-2 rounded-xl border border-border bg-card px-4 text-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-8">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                创作者主页
              </Badge>
              <Badge variant="secondary" className="h-8">
                <Award className="mr-1 h-3.5 w-3.5" />
                品牌创作者
              </Badge>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[280px,1fr]">
            <aside className="space-y-3">
              <div className="relative mx-auto w-fit">
                <Avatar className="h-24 w-24 border-4 border-border">
                  <AvatarImage src={creator.avatar} className="object-cover" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                    {creator.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-primary">
                  <Award className="h-3 w-3" />
                  认证
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
                <div className="text-sm font-medium text-foreground">
                  {isSelf ? '我的创作空间' : '创作者空间'}
                </div>
                {creator.code ? (
                  <button
                    type="button"
                    onClick={() => void handleCopyCreatorCode()}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-accent px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    <Copy className="h-3 w-3" />@{creator.code}
                  </button>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground">公开创作者主页</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-card px-2.5 py-2 text-center">
                  <div className="text-sm font-medium text-foreground">作品</div>
                  <div className="text-sm font-semibold text-foreground">
                    {creator.resourceCount}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card px-2.5 py-2 text-center">
                  <div className="text-sm font-medium text-foreground">粉丝</div>
                  <div className="text-sm font-semibold text-foreground">{followerCount}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!isSelf ? (
                  <Button
                    onClick={handleFollow}
                    disabled={followLoading}
                    variant={isFollowing ? 'outline' : 'default'}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="mr-1.5 h-4 w-4" />
                        已关注
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        关注创作者
                      </>
                    )}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => void handleShareProfile()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  分享主页
                </Button>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-foreground md:text-3xl">{creator.name}</h1>
                  <Badge variant="secondary">活跃创作者</Badge>
                </div>
                <p className="text-sm leading-7 text-foreground">
                  {creator.description || '这个创作者暂未填写个人介绍。'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    作品
                  </div>
                  <div className="text-xl font-semibold text-foreground md:text-2xl">
                    {creator.resourceCount}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Download className="h-3.5 w-3.5 text-primary" />
                    下载
                  </div>
                  <div className="text-xl font-semibold text-foreground md:text-2xl">
                    {creator.downloadCount}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3.5">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    粉丝
                  </div>
                  <div className="text-xl font-semibold text-foreground md:text-2xl">
                    {followerCount}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
                <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground">
                  创作者编号 · {creator.code || '未设置'}
                </span>
                <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground">
                  当前展示 · {worksTotal} 个资源
                </span>
                <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs text-foreground">
                  可见专辑 · {albums.length} 个
                </span>
              </div>
            </section>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs
          value={activeTab}
          onValueChange={(nextTab) => setValue('tab', nextTab as 'works' | 'albums')}
          className="flex-col gap-4"
        >
          <div className="rounded-2xl border border-border bg-card p-4">
            <TabsList className="flex h-auto flex-wrap gap-3 bg-transparent p-0">
              <TabsTrigger
                value="works"
                className="flex min-w-[140px] flex-1 items-center justify-center rounded-xl px-4 py-2.5 font-semibold sm:flex-none sm:px-5"
              >
                <ImageIcon className="mr-2 h-5 w-5" />
                作品集
                <Badge className="ml-2">{worksTotal}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="albums"
                className="flex min-w-[140px] flex-1 items-center justify-center rounded-xl px-4 py-2.5 font-semibold sm:flex-none sm:px-5"
              >
                <FolderOpen className="mr-2 h-5 w-5" />
                专辑
                <Badge className="ml-2">{albums.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-1 flex-col">
            <TabsContent value="works" className="mt-0">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-foreground">分类筛选</h3>
                      {activeAlbumId ? (
                        <button
                          type="button"
                          onClick={() => void handleClearAlbumFilter()}
                          className="rounded-full border border-border bg-card px-3 py-1 text-xs text-primary hover:bg-accent"
                        >
                          当前专辑：
                          {albums.find((album) => album.id === activeAlbumId)?.name || '已选专辑'}
                        </button>
                      ) : null}
                    </div>
                    <TypeFilterBar
                      options={categories}
                      value={activeCategory}
                      onChange={handleCategoryChange}
                      className="border-none! bg-transparent! p-0! shadow-none!"
                    />
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <div className="mb-3 flex items-center gap-2">
                      <Search className="h-4 w-4 text-primary" />
                      <h3 className="text-base font-semibold text-foreground">搜索作品</h3>
                    </div>
                    <div className="relative flex flex-col gap-2 sm:block">
                      <Input
                        type="text"
                        placeholder="输入关键词搜索作品..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                        className="h-12 rounded-xl border-2 bg-card pr-4 text-base focus-visible:border-primary focus-visible:ring-primary/20 sm:pr-24"
                      />
                      <Button
                        onClick={() => void handleSearch()}
                        className="h-10 rounded-lg px-5 text-sm sm:absolute sm:right-1.5 sm:top-1/2 sm:h-9 sm:-translate-y-1/2"
                      >
                        搜索
                      </Button>
                    </div>
                  </div>
                </div>

                {worksLoading ? (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <ResourceCardSkeleton key={i} contentPadding="p-4" />
                    ))}
                  </div>
                ) : works.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
                    <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent">
                      <ImageIcon className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">暂无作品</h3>
                    <p className="text-muted-foreground">该创作者还没有上传任何作品。</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
                    {works.map((work) => (
                      <ResourceCard
                        key={work.id}
                        resource={work}
                        isFavorited={favoritedMap[work.id]}
                        onFavorite={handleFavorite}
                        contentPadding="p-4"
                        showTags
                      />
                    ))}
                  </div>
                )}

                {worksTotalPages > 1 ? (
                  <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <Button
                      variant="outline"
                      onClick={() => void handleWorksPageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || worksLoading}
                      className="rounded-xl border-border bg-card px-6 text-foreground hover:bg-accent sm:w-auto"
                    >
                      上一页
                    </Button>
                    <div className="rounded-xl border border-border bg-card px-5 py-2 text-center text-sm text-foreground">
                      第 {currentPage} / {worksTotalPages} 页，共 {worksTotal} 个作品
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void handleWorksPageChange(currentPage + 1)}
                      disabled={currentPage >= worksTotalPages || worksLoading}
                      className="rounded-xl border-border bg-card px-6 text-foreground hover:bg-accent sm:w-auto"
                    >
                      下一页
                    </Button>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="albums" className="mt-0">
              <div className="rounded-2xl border border-border bg-card p-4">
                {albums.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
                    <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent">
                      <FolderOpen className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">还没有公开专辑</h3>
                    <p className="text-muted-foreground">
                      这个创作者暂时还没有整理出可浏览的资源专辑。
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {albums.map((album) => (
                      <div
                        key={album.id}
                        className="overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <div className="h-44 overflow-hidden bg-muted">
                          {album.coverUrl ? (
                            <img
                              src={album.coverUrl}
                              alt={album.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <FolderOpen className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-semibold text-foreground">
                                {album.name}
                              </h3>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                                {album.description || '这个专辑暂时还没有补充更多说明。'}
                              </p>
                            </div>
                            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-primary">
                              {album.resourceCount} 项
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleAlbumOpen(album.id)}
                            className="mt-4 w-full rounded-xl border-accent text-primary hover:bg-accent"
                          >
                            查看专辑作品
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
