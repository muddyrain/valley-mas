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
import { type Creator, getHotCreators } from '@/api/creator';
import {
  favoriteResource,
  getHotResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import CreatorCard from '@/components/CreatorCard';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [creatorsError, setCreatorsError] = useState(false);
  const [resourcesError, setResourcesError] = useState(false);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});
  const creatorsSectionRef = useRef<HTMLElement | null>(null);
  const resourcesSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setLoadingCreators(true);
    setCreatorsError(false);
    getHotCreators(1, 8)
      .then((data) => {
        setCreators(data.list ?? []);
      })
      .catch((error) => {
        console.error('加载创作者失败:', error);
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
        console.error('加载资源失败:', error);
        setResourcesError(true);
      })
      .finally(() => setLoadingResources(false));
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
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="relative mb-16 overflow-hidden rounded-[2rem] border border-violet-200/80 bg-white shadow-[0_20px_70px_rgba(95,55,156,0.18)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(125,211,252,0.32),transparent_42%),radial-gradient(circle_at_90%_58%,rgba(251,191,183,0.34),transparent_38%),linear-gradient(120deg,#f4efff_0%,#f8fbff_46%,#ffffff_100%)]" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(132,92,187,.26)_1px,transparent_1px),linear-gradient(90deg,rgba(132,92,187,.26)_1px,transparent_1px)] [background-size:28px_28px]" />

          <div className="relative z-10 grid items-center gap-10 px-6 py-10 md:px-10 md:py-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-violet-700 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                全新创作者体验
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">
                智能创作协作平台
                <br />
                让复杂流程
                <span className="ml-3 bg-gradient-to-r from-violet-600 to-sky-500 bg-clip-text font-serif italic text-transparent">
                  更简单更优雅
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                输入创作者口令，快速进入个人空间。发现优质素材、收藏灵感、下载即用，一步到位。
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
                  查看热门创作者
                </Button>
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
                  { label: '精品资源', value: '10K+', icon: Heart },
                  { label: '活跃创作者', value: '500+', icon: Users },
                  { label: '用户下载', value: '100K+', icon: Download },
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

            <div className="relative hidden min-h-[420px] lg:block">
              <div className="absolute right-8 top-10 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,#fdba74_0%,rgba(253,186,116,0.16)_42%,transparent_72%)] blur-2xl" />
              <div className="absolute right-16 top-16 h-[360px] w-[260px] rounded-[140px] border border-violet-200/70 bg-gradient-to-b from-white/70 to-white/20 backdrop-blur-sm" />
              <div className="absolute right-28 top-20 h-[330px] w-[220px] rounded-[120px] bg-gradient-to-b from-violet-50/95 via-violet-200/40 to-transparent" />
              <div className="absolute right-12 top-24 h-[310px] w-[230px] [clip-path:polygon(20%_0%,82%_8%,98%_30%,88%_75%,62%_100%,20%_95%,6%_70%,8%_28%)] bg-gradient-to-b from-violet-900/85 via-violet-700/75 to-transparent opacity-95" />

              <div className="absolute left-4 top-8 rounded-xl border border-violet-200 bg-white/75 px-4 py-3 backdrop-blur">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  创作者信赖平台
                </div>
                <p className="mt-1 text-xs text-slate-600">上传安全稳定，内容分发高性能低延迟。</p>
              </div>

              <div className="absolute bottom-8 right-0 rounded-xl border border-violet-200 bg-white/75 px-4 py-3 backdrop-blur">
                <p className="text-xs text-slate-600">实时运营数据</p>
                <p className="text-lg font-semibold text-slate-900">互动提升 +278%</p>
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
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <Users className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">暂无创作者数据</p>
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
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <TrendingUp className="mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">暂无资源数据</p>
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
      </div>
    </div>
  );
}
