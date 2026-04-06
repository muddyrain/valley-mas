import {
  ArrowLeft,
  Award,
  Download,
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
  type Creator,
  followCreator,
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

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(135deg, rgba(var(--theme-primary-rgb),0.97) 0%, color-mix(in srgb, rgba(var(--theme-secondary-rgb),1) 34%, var(--theme-primary-hover)) 54%, var(--theme-primary-deep) 100%)',
};

const glassStatClass =
  'rounded-2xl border border-white/18 bg-white/12 p-4 backdrop-blur-md shadow-[0_14px_30px_rgba(15,23,42,0.10)] transition-all hover:bg-white/18';

const sectionCardClass =
  'rounded-2xl border border-theme-shell-border bg-white/84 p-6 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm';

const triggerClassName =
  'rounded-xl px-6 py-3 font-semibold transition-all hover:bg-theme-soft data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white data-[state=active]:shadow-[0_16px_30px_rgba(var(--theme-primary-rgb),0.22)]';

export default function CreatorProfile() {
  const { code } = useParams<{ code: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [works, setWorks] = useState<Resource[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [worksLoading, setWorksLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('works');
  // 作品收藏状态：key = resourceId, value = boolean
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});
  const user = useAuthStore((state) => state.user);
  useEffect(() => {
    if (!code) return;

    const loadCreatorData = async () => {
      try {
        setLoading(true);
        const creatorData = await getCreatorByCode(code);
        setCreator(creatorData);
        setFollowerCount(creatorData.followerCount || 0);

        // 并行加载作品和关注状态
        const [worksData] = await Promise.all([
          getCreatorWorks(creatorData.id),
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
        setWorks(worksData.list);

        // 直接从列表响应中读取 isFavorited 字段（服务端对登录用户返回收藏状态）
        const map: Record<string, boolean> = {};
        worksData.list.forEach((w) => {
          map[w.id] = w.isFavorited ?? false;
        });
        setFavoritedMap(map);
      } catch (error) {
        console.error('加载创作者数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreatorData();
  }, [code, user?.id]);

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

  const handleSearch = async () => {
    if (!creator) return;

    try {
      setWorksLoading(true);
      const params: { keyword?: string; type?: string } = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (activeCategory) params.type = activeCategory;

      if (activeTab === 'works') {
        const data = await getCreatorWorks(creator.id, params);
        setWorks(data.list);
        const map: Record<string, boolean> = {};
        data.list.forEach((w) => {
          map[w.id] = w.isFavorited ?? false;
        });
        setFavoritedMap(map);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  // 切换分类的处理函数
  const handleCategoryChange = async (categoryValue: string) => {
    if (!creator) return;
    setActiveCategory(categoryValue);
    try {
      setWorksLoading(true);
      const params: { keyword?: string; type?: string } = {};
      if (searchKeyword) params.keyword = searchKeyword;
      if (categoryValue) params.type = categoryValue;

      const data = await getCreatorWorks(creator.id, params);
      setWorks(data.list);
      const map: Record<string, boolean> = {};
      data.list.forEach((w) => {
        map[w.id] = w.isFavorited ?? false;
      });
      setFavoritedMap(map);
    } catch (error) {
      console.error('筛选失败:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
        <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-12" maxWidth="max-w-7xl">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full bg-white/20" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48 bg-white/20" />
              <Skeleton className="h-4 w-64 bg-white/20" />
              <div className="flex gap-6 pt-2">
                <Skeleton className="h-6 w-20 bg-white/20" />
                <Skeleton className="h-6 w-20 bg-white/20" />
                <Skeleton className="h-6 w-20 bg-white/20" />
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
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-12 md:py-16" maxWidth="max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6 gap-2 text-white/90 backdrop-blur-sm hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>

        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
          <div className="relative shrink-0">
            <div
              className="absolute -inset-2 rounded-full opacity-80 blur-xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--theme-tertiary-rgb),0.52), rgba(var(--theme-secondary-rgb),0.30), rgba(var(--theme-primary-rgb),0.58))',
              }}
            />
            <Avatar className="relative h-32 w-32 border-4 border-white/30 shadow-2xl ring-4 ring-white/15 md:h-40 md:w-40">
              <AvatarImage src={creator.avatar} className="object-cover" />
              <AvatarFallback className="theme-avatar-fallback text-4xl font-bold text-white md:text-5xl">
                {creator.name[0]}
              </AvatarFallback>
            </Avatar>
            <div
              className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg"
              style={{
                background:
                  'linear-gradient(135deg, rgba(var(--theme-tertiary-rgb),0.95), rgba(var(--theme-secondary-rgb),0.92))',
              }}
            >
              <Award className="h-3 w-3" />
              认证创作者
            </div>
          </div>

          <div className="min-w-0 flex-1 text-white">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold drop-shadow-lg md:text-4xl lg:text-5xl">
                {creator.name}
              </h1>
              <Badge className="border-white/24 bg-white/16 px-3 py-1 text-white backdrop-blur-sm hover:bg-white/24">
                <Sparkles className="mr-1 h-3 w-3" />
                活跃
              </Badge>
            </div>

            <p className="mb-6 max-w-2xl text-base leading-relaxed text-white/86 drop-shadow md:text-lg">
              {creator.description || '这是一个优秀的内容创作者，持续分享高质量的设计作品。'}
            </p>

            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className={glassStatClass}>
                <div className="mb-2 flex items-center gap-2 text-white/78">
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">作品</span>
                </div>
                <div className="text-2xl font-bold md:text-3xl">{creator.resourceCount}</div>
              </div>
              <div className={glassStatClass}>
                <div className="mb-2 flex items-center gap-2 text-white/78">
                  <Download className="h-4 w-4" />
                  <span className="text-xs font-medium">下载</span>
                </div>
                <div className="text-2xl font-bold md:text-3xl">{creator.downloadCount}</div>
              </div>
              <div className={glassStatClass}>
                <div className="mb-2 flex items-center gap-2 text-white/78">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium">粉丝</span>
                </div>
                <div className="text-2xl font-bold md:text-3xl">{followerCount}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!isSelf && (
                <Button
                  onClick={handleFollow}
                  disabled={followLoading}
                  size="lg"
                  variant={isFollowing ? 'ghost' : 'default'}
                  className={
                    isFollowing
                      ? 'border-2 border-white/50 bg-white/12 px-8 font-semibold text-white backdrop-blur-sm hover:bg-white/20'
                      : 'bg-white px-8 font-semibold text-[var(--theme-primary)] shadow-xl transition-all hover:scale-[1.01] hover:bg-white/94'
                  }
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="mr-2 h-5 w-5" />
                      已关注
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-5 w-5" />
                      关注创作者
                    </>
                  )}
                </Button>
              )}
              <Button
                size="lg"
                variant="ghost"
                className="border-2 border-white/50 bg-transparent px-6 font-semibold text-white backdrop-blur-sm hover:bg-white/14"
              >
                <Share2 className="mr-2 h-5 w-5" />
                分享
              </Button>
            </div>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <div className="rounded-2xl border border-theme-shell-border bg-white/84 p-2 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <TabsList className="h-auto gap-4 bg-transparent p-0">
              <TabsTrigger value="works" className={triggerClassName}>
                <ImageIcon className="mr-2 h-5 w-5" />
                作品集
                <Badge className="ml-2 border-0 bg-theme-soft text-theme-primary data-[state=active]:bg-white/18 data-[state=active]:text-white">
                  {works.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-1 flex-col">
            <div
              className={`mb-4 flex w-full flex-col gap-6 lg:flex-row lg:items-start ${sectionCardClass}`}
            >
              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-[var(--theme-primary)]" />
                    <h3 className="text-lg font-bold text-slate-900">分类筛选</h3>
                  </div>
                  <span className="text-sm text-slate-500">{works.length} 个作品</span>
                </div>
                <TypeFilterBar
                  options={categories}
                  value={activeCategory}
                  onChange={handleCategoryChange}
                  className="border-none! bg-transparent! p-0! shadow-none!"
                />
              </div>

              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-6 w-1 rounded-full bg-[var(--theme-primary)]" />
                  <h3 className="text-lg font-bold text-slate-900">搜索作品</h3>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2">
                    <Search className="h-5 w-5 text-theme-primary" />
                  </div>
                  <Input
                    type="text"
                    placeholder="输入关键词搜索作品..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="theme-input-border h-14 rounded-xl border-2 bg-white/82 pl-14 pr-28 text-base focus-visible:border-theme-primary focus-visible:ring-theme-primary/20"
                  />
                  <Button
                    onClick={handleSearch}
                    className="theme-btn-primary absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-lg px-6 font-semibold"
                  >
                    搜索
                  </Button>
                </div>
              </div>
            </div>

            <TabsContent value="works" className="mt-0">
              {worksLoading ? (
                <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ResourceCardSkeleton key={i} contentPadding="p-4" />
                  ))}
                </div>
              ) : works.length === 0 ? (
                <div className="rounded-2xl border border-theme-shell-border bg-white/80 px-6 py-20 text-center shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.08)]">
                  <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-theme-soft">
                    <ImageIcon className="h-12 w-12 text-theme-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-900">暂无作品</h3>
                  <p className="text-slate-500">该创作者还没有上传任何作品</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {works.map((work) => (
                    <ResourceCard
                      key={work.id}
                      resource={work}
                      isFavorited={favoritedMap[work.id]}
                      onFavorite={handleFavorite}
                      contentPadding="p-4"
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
