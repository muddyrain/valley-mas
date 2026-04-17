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

// 分类映射:中文名 -> 后端类型
const categories = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 30%, white) 44%, var(--theme-page-cool) 100%)',
};

const glassStatClass =
  'group relative overflow-hidden rounded-2xl border border-white/78 bg-white/62 p-3.5 backdrop-blur-2xl shadow-[0_14px_30px_rgba(var(--theme-primary-rgb),0.10)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/82 hover:shadow-[0_20px_40px_rgba(var(--theme-primary-rgb),0.14)]';

const creatorHeroInnerClass =
  'relative overflow-hidden rounded-[30px] border border-white/76 bg-white/62 p-4 shadow-[0_24px_62px_rgba(var(--theme-primary-rgb),0.13)] backdrop-blur-2xl md:p-6';

const creatorHeroActionCardClass =
  'rounded-2xl border border-white/78 bg-white/72 p-3.5 shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-2xl';

const sectionCardClass =
  'rounded-3xl border border-theme-shell-border bg-white/88 p-5 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-xl md:p-6';

const sectionSubCardClass =
  'rounded-2xl border border-theme-shell-border bg-white/84 p-4 shadow-[0_10px_24px_rgba(148,163,184,0.09)] backdrop-blur-sm';

const triggerClassName =
  'rounded-xl px-5 py-2.5 font-semibold transition-all hover:bg-theme-soft data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white data-[state=active]:shadow-[0_14px_26px_rgba(var(--theme-primary-rgb),0.22)]';

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
  // 作品收藏状态：key = resourceId, value = boolean
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

        // 并行加载专辑和关注状态
        const [albumsData] = await Promise.all([
          getCreatorAlbums(creatorData.id),
          // 查询关注状态（接口失败不影响主流程）
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
  }, [creator, currentKeyword, currentPage, activeCategory, activeAlbumId]);

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

  // 切换分类的处理函数
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
      <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
        <PageBanner padding="py-6 md:py-8" maxWidth="max-w-6xl" tone="soft">
          <div className="overflow-hidden rounded-[30px] border border-white/76 bg-white/62 p-4 shadow-[0_24px_58px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-2xl md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-[5.5rem] rounded-xl bg-white/75" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24 rounded-full bg-white/75" />
                <Skeleton className="h-8 w-[5.5rem] rounded-full bg-white/75" />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
              <div className="rounded-2xl border border-white/78 bg-white/72 p-4 shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.10)]">
                <Skeleton className="mx-auto h-24 w-24 rounded-full bg-white/80 md:h-28 md:w-28" />
                <Skeleton className="mx-auto mt-3 h-6 w-[8.5rem] rounded-lg bg-white/80" />
                <Skeleton className="mx-auto mt-2 h-4 w-24 rounded-md bg-white/80" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Skeleton className="h-14 rounded-xl bg-white/80" />
                  <Skeleton className="h-14 rounded-xl bg-white/80" />
                  <Skeleton className="h-14 rounded-xl bg-white/80" />
                  <Skeleton className="h-14 rounded-xl bg-white/80" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/76 bg-white/68 p-4 shadow-[0_12px_30px_rgba(var(--theme-primary-rgb),0.10)]">
                <div className="space-y-3">
                  <Skeleton className="h-9 w-2/3 rounded-xl bg-white/80" />
                  <Skeleton className="h-4 w-full rounded-md bg-white/80" />
                  <Skeleton className="h-4 w-5/6 rounded-md bg-white/80" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-[4.5rem] rounded-2xl bg-white/80" />
                  <Skeleton className="h-[4.5rem] rounded-2xl bg-white/80" />
                  <Skeleton className="h-[4.5rem] rounded-2xl bg-white/80" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-32 rounded-xl bg-white/80" />
                  <Skeleton className="h-9 w-28 rounded-xl bg-white/80" />
                  <Skeleton className="h-9 w-[6.5rem] rounded-xl bg-white/80" />
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
      <div
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"
        style={PAGE_BACKGROUND}
      >
        <div className="rounded-2xl border border-theme-shell-border bg-white/88 px-8 py-10 text-center shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.10)]">
          <div className="mb-2 text-lg font-semibold text-slate-700">创作者不存在</div>
          <p className="mb-5 text-sm text-slate-500">可能已停用，或者链接已经失效。</p>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      {/* 创作者页也跟随当前主题背景，避免继续保留独立紫色专题风格 */}
      <PageBanner padding="py-6 md:py-8" maxWidth="max-w-6xl" tone="soft">
        <div className={creatorHeroInnerClass}>
          <div className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full bg-white/70 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-8 h-36 w-36 rounded-full bg-[rgba(var(--theme-secondary-rgb),0.22)] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full bg-[rgba(var(--theme-tertiary-rgb),0.12)] blur-3xl" />
          <div className="pointer-events-none absolute -right-8 bottom-1 text-[58px] leading-none font-black tracking-[0.14em] text-white/24">
            CREATOR
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="h-10 gap-2 rounded-xl border border-white/84 bg-white/72 px-4 text-slate-700 backdrop-blur-xl shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.10)] hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <div className="flex items-center gap-2">
              <Badge className="h-8 border border-white/84 bg-white/72 px-3 text-theme-primary shadow-[0_10px_20px_rgba(var(--theme-primary-rgb),0.10)]">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                创作者主页
              </Badge>
              <Badge className="h-8 border border-white/84 bg-white/72 px-3 text-theme-primary shadow-[0_10px_20px_rgba(var(--theme-primary-rgb),0.10)]">
                <Award className="mr-1 h-3.5 w-3.5" />
                品牌创作者
              </Badge>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[280px,1fr]">
            <aside className={`${creatorHeroActionCardClass} space-y-3`}>
              <div className="relative mx-auto w-fit">
                <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(var(--theme-primary-rgb),0.2)_0%,transparent_72%)] blur-2xl" />
                <Avatar className="relative h-24 w-24 border-4 border-white/90 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.16)]">
                  <AvatarImage src={creator.avatar} className="object-cover" />
                  <AvatarFallback className="theme-avatar-fallback text-3xl font-bold text-white">
                    {creator.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 rounded-full border border-white/90 bg-white/92 px-2.5 py-1 text-[11px] font-medium text-theme-primary shadow-md">
                  <Award className="h-3 w-3" />
                  认证
                </div>
              </div>

              <div className="rounded-xl border border-white/85 bg-white/78 px-3 py-2 text-center">
                <div className="text-sm font-medium text-slate-700">
                  {isSelf ? '我的创作空间' : '创作者空间'}
                </div>
                {creator.code ? (
                  <button
                    type="button"
                    onClick={() => void handleCopyCreatorCode()}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-theme-primary/24 bg-theme-soft px-2.5 py-1 text-xs font-medium text-theme-primary transition-colors hover:bg-theme-primary hover:text-white"
                  >
                    <Copy className="h-3 w-3" />@{creator.code}
                  </button>
                ) : (
                  <div className="mt-1 text-xs text-slate-500">公开创作者主页</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/85 bg-white/80 px-2.5 py-2 text-center">
                  <div className="text-sm font-medium text-slate-600">作品</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {creator.resourceCount}
                  </div>
                </div>
                <div className="rounded-xl border border-white/85 bg-white/80 px-2.5 py-2 text-center">
                  <div className="text-sm font-medium text-slate-600">粉丝</div>
                  <div className="text-sm font-semibold text-slate-800">{followerCount}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {!isSelf ? (
                  <Button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={
                      isFollowing
                        ? 'h-9 border border-white/82 bg-white/72 text-slate-700 shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.10)] hover:bg-white'
                        : 'h-9 bg-gradient-to-r from-theme-primary to-theme-primary-deep text-white shadow-[0_14px_30px_rgba(var(--theme-primary-rgb),0.24)] hover:from-theme-primary-hover hover:to-theme-primary-deep'
                    }
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
                  className="h-9 border-theme-primary/50 duration-300 bg-theme-primary/15 text-theme-primary hover:bg-theme-primary/50 hover:text-white"
                >
                  <Share2 className="mr-1.5 h-4 w-4" />
                  分享主页
                </Button>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="rounded-2xl border border-white/78 bg-white/72 p-4 shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.10)]">
                <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{creator.name}</h1>
                  <Badge className="border border-white/84 bg-white/82 text-theme-primary">
                    活跃创作者
                  </Badge>
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  {creator.description || '这个创作者暂未填写个人介绍。'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className={glassStatClass}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <ImageIcon className="h-3.5 w-3.5 text-theme-primary" />
                    作品
                  </div>
                  <div className="text-xl font-semibold text-slate-900 md:text-2xl">
                    {creator.resourceCount}
                  </div>
                </div>
                <div className={glassStatClass}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Download className="h-3.5 w-3.5 text-theme-primary" />
                    下载
                  </div>
                  <div className="text-xl font-semibold text-slate-900 md:text-2xl">
                    {creator.downloadCount}
                  </div>
                </div>
                <div className={glassStatClass}>
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5 text-theme-primary" />
                    粉丝
                  </div>
                  <div className="text-xl font-semibold text-slate-900 md:text-2xl">
                    {followerCount}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/76 bg-white/68 p-3 shadow-[0_12px_26px_rgba(var(--theme-primary-rgb),0.09)]">
                <span className="rounded-full border border-white/90 bg-white/82 px-3 py-1 text-xs text-slate-600">
                  创作者编号 · {creator.code || '未设置'}
                </span>
                <span className="rounded-full border border-white/90 bg-white/82 px-3 py-1 text-xs text-slate-600">
                  当前展示 · {worksTotal} 个资源
                </span>
                <span className="rounded-full border border-white/90 bg-white/82 px-3 py-1 text-xs text-slate-600">
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
          <div className={sectionCardClass}>
            <TabsList className="h-auto gap-3 bg-transparent p-0">
              <TabsTrigger value="works" className={triggerClassName}>
                <ImageIcon className="mr-2 h-5 w-5" />
                作品集
                <Badge className="ml-2 border-0 bg-theme-soft text-theme-primary data-[state=active]:bg-white/18 data-[state=active]:text-white">
                  {worksTotal}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="albums" className={triggerClassName}>
                <FolderOpen className="mr-2 h-5 w-5" />
                专辑
                <Badge className="ml-2 border-0 bg-theme-soft text-theme-primary data-[state=active]:bg-white/18 data-[state=active]:text-white">
                  {albums.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-1 flex-col">
            <TabsContent value="works" className="mt-0">
              <div className={`${sectionCardClass} space-y-5`}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className={sectionSubCardClass}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">分类筛选</h3>
                      {activeAlbumId ? (
                        <button
                          type="button"
                          onClick={() => void handleClearAlbumFilter()}
                          className="rounded-full border border-theme-shell-border bg-white px-3 py-1 text-xs text-theme-primary hover:bg-theme-soft"
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

                  <div className={sectionSubCardClass}>
                    <div className="mb-3 flex items-center gap-2">
                      <Search className="h-4 w-4 text-theme-primary" />
                      <h3 className="text-base font-semibold text-slate-900">搜索作品</h3>
                    </div>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="输入关键词搜索作品..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                        className="theme-input-border h-12 rounded-xl border-2 bg-white pr-24 text-base focus-visible:border-theme-primary focus-visible:ring-theme-primary/20"
                      />
                      <Button
                        onClick={() => void handleSearch()}
                        className="theme-btn-primary absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg px-5 text-sm"
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
                  <div className="rounded-2xl border border-theme-shell-border bg-white/82 px-6 py-16 text-center shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.08)]">
                    <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-theme-soft">
                      <ImageIcon className="h-10 w-10 text-theme-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-900">暂无作品</h3>
                    <p className="text-slate-500">该创作者还没有上传任何作品。</p>
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
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => void handleWorksPageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || worksLoading}
                      className="rounded-xl border-theme-shell-border bg-white/84 px-6 text-slate-700 hover:bg-theme-soft"
                    >
                      上一页
                    </Button>
                    <div className="rounded-xl border border-theme-shell-border bg-white/84 px-5 py-2 text-sm text-slate-600">
                      第 {currentPage} / {worksTotalPages} 页，共 {worksTotal} 个作品
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => void handleWorksPageChange(currentPage + 1)}
                      disabled={currentPage >= worksTotalPages || worksLoading}
                      className="rounded-xl border-theme-shell-border bg-white/84 px-6 text-slate-700 hover:bg-theme-soft"
                    >
                      下一页
                    </Button>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="albums" className="mt-0">
              <div className={sectionCardClass}>
                {albums.length === 0 ? (
                  <div className="rounded-2xl border border-theme-shell-border bg-white/82 px-6 py-16 text-center shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.08)]">
                    <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-theme-soft">
                      <FolderOpen className="h-10 w-10 text-theme-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-slate-900">还没有公开专辑</h3>
                    <p className="text-slate-500">这个创作者暂时还没有整理出可浏览的资源专辑。</p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {albums.map((album) => (
                      <div
                        key={album.id}
                        className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/84 shadow-[0_16px_36px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(var(--theme-primary-rgb),0.16)]"
                      >
                        <div className="h-44 overflow-hidden bg-theme-soft">
                          {album.coverUrl ? (
                            <img
                              src={album.coverUrl}
                              alt={album.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <FolderOpen className="h-12 w-12 text-theme-primary/50" />
                            </div>
                          )}
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-lg font-semibold text-slate-900">
                                {album.name}
                              </h3>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                                {album.description || '这个专辑暂时还没有补充更多说明。'}
                              </p>
                            </div>
                            <span className="rounded-full bg-theme-soft px-3 py-1 text-xs font-medium text-theme-primary">
                              {album.resourceCount} 项
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleAlbumOpen(album.id)}
                            className="mt-4 w-full rounded-xl border-theme-soft-strong bg-white/80 text-theme-primary hover:bg-theme-soft"
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
