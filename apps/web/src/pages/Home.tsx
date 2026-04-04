import {
  ArrowRight,
  Download,
  Heart,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type Post as BlogPost, getPosts } from '@/api/blog';
import { type Creator, getHotCreators } from '@/api/creator';
import {
  favoriteResource,
  getHotResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import { BlogFeedCard } from '@/components/blog';
import CreatorCard from '@/components/CreatorCard';

import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [code, setCode] = useState('');
  const canCreateContent = user?.role === 'creator' || user?.role === 'admin';

  const [creators, setCreators] = useState<Creator[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [creatorsError, setCreatorsError] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);
  const [blogsError, setBlogsError] = useState(false);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});
  const creatorsSectionRef = useRef<HTMLElement | null>(null);
  const resourcesSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setLoadingCreators(true);
    setCreatorsError(false);
    getHotCreators(1, 8)
      .then((data) => setCreators(data.list ?? []))
      .catch((error) => {
        console.error('load creators failed:', error);
        setCreatorsError(true);
      })
      .finally(() => setLoadingCreators(false));

    setLoadingResources(true);
    setResourcesError(false);
    getHotResources(1, 12)
      .then((data) => {
        setResources(data.list ?? []);
        const map: Record<string, boolean> = {};
        (data.list ?? []).forEach((r) => {
          map[r.id] = r.isFavorited ?? false;
        });
        setFavoritedMap(map);
      })
      .catch((error) => {
        console.error('load resources failed:', error);
        setResourcesError(true);
      })
      .finally(() => setLoadingResources(false));

    setLoadingBlogs(true);
    setBlogsError(false);
    getPosts({ page: 1, pageSize: 6 })
      .then((data) => setBlogs(data.list ?? []))
      .catch((error) => {
        console.error('load blogs failed:', error);
        setBlogsError(true);
      })
      .finally(() => setLoadingBlogs(false));
  }, []);

  const handleSearchCode = () => {
    if (!code.trim()) return;
    navigate(`/creator/${code}`);
  };

  const handlePrimaryHeroAction = () => {
    if (code.trim()) {
      handleSearchCode();
      return;
    }
    resourcesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSecondaryHeroAction = () => {
    creatorsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFavorite = async (e: React.MouseEvent, resource: Resource) => {
    e.stopPropagation();
    const isFav = favoritedMap[resource.id] ?? false;
    try {
      if (isFav) {
        await unfavoriteResource(resource.id);
        setFavoritedMap((prev) => ({ ...prev, [resource.id]: false }));
        toast.success('已取消收藏');
      } else {
        await favoriteResource(resource.id);
        setFavoritedMap((prev) => ({ ...prev, [resource.id]: true }));
        toast.success('收藏成功');
      }
    } catch {
      toast.error('请先登录后再收藏');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="relative mb-16 overflow-hidden rounded-4xl border border-violet-200/80 bg-white shadow-[0_20px_70px_rgba(95,55,156,0.18)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(125,211,252,0.32),transparent_42%),radial-gradient(circle_at_90%_58%,rgba(251,191,183,0.34),transparent_38%),linear-gradient(120deg,#f4efff_0%,#f8fbff_46%,#ffffff_100%)]" />
          <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(132,92,187,.26)_1px,transparent_1px),linear-gradient(90deg,rgba(132,92,187,.26)_1px,transparent_1px)] bg-size-[28px_28px]" />

          <div className="relative z-10 grid items-center gap-10 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-violet-700 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                我的内容、资源与日常记录
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
                Valley 是我的个人网站
                <br />
                用来整理内容、
                <span className="ml-3 bg-linear-to-r from-violet-600 to-sky-500 bg-clip-text font-serif italic text-transparent">
                  分享作品与记录想法
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                这里集中放了我的博客、图文、资源和一些正在持续完善的小工具。你可以直接浏览内容，也可以通过口令进入对应空间看看更多整理过的资料。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  onClick={handlePrimaryHeroAction}
                  size="lg"
                  className="h-12 rounded-xl bg-violet-600 px-6 font-semibold text-white hover:bg-violet-700"
                >
                  {code.trim() ? '进入空间' : '浏览热门资源'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl border-violet-300 bg-white/70 px-5 text-violet-700 hover:bg-violet-50"
                  onClick={handleSecondaryHeroAction}
                >
                  <Play className="mr-2 h-4 w-4" />
                  看看最近内容
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl border-sky-300 bg-white/70 px-5 text-sky-700 hover:bg-sky-50"
                  onClick={() => navigate('/blog')}
                >
                  浏览博客图文
                </Button>
                {canCreateContent && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 rounded-xl border-amber-300 bg-white/70 px-5 text-amber-700 hover:bg-amber-50"
                    onClick={() => navigate('/my-space')}
                  >
                    进入我的创作空间
                  </Button>
                )}
              </div>

              <div className="mt-8 max-w-2xl">
                <div className="group relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-violet-500" />
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="输入创作者口令，例如 ABCD1234"
                    className="h-14 rounded-xl border-violet-200 bg-white/95 pl-12 text-base text-slate-900 shadow-xl"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchCode()}
                  />
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: '博客与图文', value: '持续更新', icon: Heart },
                  { label: '内容栏目', value: '多主题', icon: Users },
                  { label: '资源与工具', value: '持续整理', icon: Download },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-violet-200 bg-white/70 p-3 backdrop-blur"
                  >
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                      <stat.icon className="h-4 w-4 text-violet-700" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-xs text-slate-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden min-h-105 overflow-hidden lg:block">
              <div className="hero-orb hero-orb-main absolute right-8 top-10 h-75 w-75 rounded-full bg-[radial-gradient(circle,#fdba74_0%,rgba(253,186,116,0.16)_42%,transparent_72%)] blur-2xl" />
              <div className="hero-orb hero-orb-secondary absolute right-12 top-28 h-46 w-46 rounded-full bg-[radial-gradient(circle,rgba(129,140,248,.35)_0%,rgba(129,140,248,0)_70%)] blur-xl" />
              <div className="hero-ring absolute right-16 top-16 h-90 w-65 rounded-[140px] border border-violet-200/70 bg-linear-to-b from-white/70 to-white/20 backdrop-blur-sm" />
              <div className="hero-sheet absolute right-28 top-20 h-82.5 w-55 rounded-[120px] bg-linear-to-b from-violet-50/95 via-violet-200/40 to-transparent" />
              <div className="hero-crystal absolute right-12 top-24 h-77.5 w-57.5 [clip-path:polygon(20%_0%,82%_8%,98%_30%,88%_75%,62%_100%,20%_95%,6%_70%,8%_28%)] bg-linear-to-b from-violet-900/85 via-violet-700/75 to-transparent opacity-95" />

              <div className="hero-particle hero-particle-a absolute right-20 top-24 h-2.5 w-2.5 rounded-full bg-violet-300/80" />
              <div className="hero-particle hero-particle-b absolute right-10 top-46 h-2 w-2 rounded-full bg-sky-300/80" />
              <div className="hero-particle hero-particle-c absolute right-40 top-66 h-3 w-3 rounded-full bg-amber-300/80" />

              <div className="hero-card hero-card-top absolute left-4 top-8 rounded-xl border border-violet-200 bg-white/75 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  个人内容站点
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  记录想法、整理资源，也保留了一些可继续扩展的能力。
                </p>
              </div>

              <div className="hero-card hero-card-bottom absolute bottom-8 right-0 rounded-xl border border-violet-200 bg-white/75 px-4 py-3 backdrop-blur">
                <p className="text-xs text-slate-600">当前站点重点</p>
                <p className="text-lg font-semibold text-slate-900">内容整理与持续更新</p>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-16" ref={creatorsSectionRef}>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-linear-to-br from-purple-100 to-purple-200 p-3 shadow-md">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">热门创作者</h2>
                <p className="mt-0.5 text-sm text-gray-500">最受欢迎的内容创作者</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/creators')}
              className="text-purple-600 hover:text-purple-700"
            >
              查看全部 →
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {loadingCreators ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-14 w-14 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : creatorsError ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <Users className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">创作者数据加载失败，请稍后刷新重试</p>
              </div>
            ) : creators.length === 0 ? (
              <div className="col-span-full">
                <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-linear-to-br from-white via-violet-50/40 to-sky-50/50 p-10 text-center shadow-[0_12px_36px_rgba(103,80,164,0.12)]">
                  <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-200/35 blur-2xl" />
                  <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />

                  <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/85 shadow-lg ring-1 ring-violet-200">
                    <Users className="h-8 w-8 text-violet-600" />
                  </div>
                  <h3 className="relative text-xl font-semibold text-slate-900">
                    创作者正在陆续入驻
                  </h3>
                  <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                    当前还没有可展示的创作者内容，你可以先浏览热门资源和图文动态，稍后再来看看。
                  </p>
                  <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/blog')}
                      className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50"
                    >
                      浏览图文博客
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} variant="compact" />
              ))
            )}
          </div>
        </section>

        <section ref={resourcesSectionRef}>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-linear-to-br from-indigo-100 to-purple-200 p-3 shadow-md">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">热门资源</h2>
                <p className="mt-0.5 text-sm text-gray-500">最新最热的精选内容</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/resources')}
              className="text-purple-600 hover:text-purple-700"
            >
              查看更多 →
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loadingResources ? (
              Array.from({ length: 12 }).map((_, i) => <ResourceCardSkeleton key={i} />)
            ) : resourcesError ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <TrendingUp className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">资源数据加载失败，请稍后刷新重试</p>
              </div>
            ) : resources.length === 0 ? (
              <div className="col-span-full">
                <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 bg-linear-to-br from-white via-indigo-50/40 to-violet-50/45 p-10 text-center shadow-[0_16px_42px_rgba(82,63,138,0.12)]">
                  <div className="pointer-events-none absolute -left-8 top-0 h-28 w-28 rounded-full bg-indigo-200/35 blur-2xl" />
                  <div className="pointer-events-none absolute -right-10 -bottom-8 h-36 w-36 rounded-full bg-violet-200/35 blur-2xl" />
                  <div className="pointer-events-none absolute inset-0 opacity-[0.16] bg-[linear-gradient(rgba(99,102,241,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.22)_1px,transparent_1px)] bg-size-[26px_26px]" />

                  <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 shadow-lg ring-1 ring-indigo-200">
                    <TrendingUp className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="relative text-xl font-semibold text-slate-900">
                    资源内容正在整理上新
                  </h3>
                  <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                    当前还没有可展示的热门资源，先去看看图文博客和创作者动态，稍后回来会有新内容。
                  </p>
                  <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        creatorsSectionRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start',
                        })
                      }
                      className="rounded-xl border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      浏览创作者
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              resources.map((resource, index) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isFavorited={favoritedMap[resource.id]}
                  onFavorite={handleFavorite}
                  showCreator
                  animationDelay={index * 50}
                />
              ))
            )}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-linear-to-br from-sky-100 to-cyan-200 p-3 shadow-md">
                <Sparkles className="h-6 w-6 text-sky-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">最新博客图文</h2>
                <p className="mt-0.5 text-sm text-gray-500">首页不止资源，也展示创作者文章内容</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate('/blog')}
              className="text-sky-600 hover:text-sky-700"
            >
              查看全部 →
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loadingBlogs ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-[22px] border border-slate-200 bg-white p-3">
                  <div className="h-97.5 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              ))
            ) : blogsError ? (
              <div className="col-span-full py-12 text-center text-gray-400">
                博客加载失败，请稍后重试
              </div>
            ) : blogs.length === 0 ? (
              <div className="col-span-full">
                <div className="relative overflow-hidden rounded-3xl border border-sky-200/70 bg-linear-to-br from-white via-sky-50/45 to-cyan-50/55 p-10 text-center shadow-[0_14px_38px_rgba(56,140,176,0.13)]">
                  <div className="pointer-events-none absolute -left-8 -top-8 h-32 w-32 rounded-full bg-sky-200/40 blur-2xl" />
                  <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-cyan-200/35 blur-2xl" />
                  <div className="pointer-events-none absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(56,189,248,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.22)_1px,transparent_1px)] bg-size-[24px_24px]" />

                  <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/90 shadow-lg ring-1 ring-sky-200">
                    <Sparkles className="h-8 w-8 text-sky-600" />
                  </div>
                  <h3 className="relative text-xl font-semibold text-slate-900">
                    图文博客还在准备中
                  </h3>
                  <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                    暂时没有可展示的图文内容，创作者发布后会第一时间出现在这里。
                  </p>
                  <div className="relative mt-6">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/my-space/image-text')}
                      className="rounded-xl border-sky-300 text-sky-700 hover:bg-sky-50"
                    >
                      去创作图文
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              blogs.map((blog) => <BlogFeedCard key={blog.id} post={blog} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
