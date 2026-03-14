import { Download, Heart, Search, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  // 收藏状态：key = resourceId, value = boolean
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 独立加载创作者，互不影响
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

    // 独立加载资源
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section - 炫酷渐变背景 */}
        <div className="relative overflow-hidden rounded-3xl mb-16 animate-gradient bg-linear-to-br from-purple-600 via-purple-700 to-indigo-800 p-12 md:p-16 shadow-2xl">
          {/* 背景装饰元素 */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-20" />
          <div className="absolute -right-20 -top-20 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float" />
          <div
            className="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl"
            style={{ animationDelay: '1s' }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm animate-float">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
                ✨ 全新体验
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              发现精美资源
              <br />
              <span className="text-purple-200">连接优秀创作者</span>
            </h1>
            <p className="text-purple-100 mb-10 text-lg md:text-xl max-w-2xl leading-relaxed">
              输入创作者口令，快速访问作品空间，探索海量优质资源
            </p>

            <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="输入创作者口令，如: ABCD1234"
                  className="pl-12 h-14 bg-white/95 backdrop-blur-sm border-0 text-gray-900 placeholder:text-gray-500 shadow-xl rounded-2xl text-base focus:ring-2 focus:ring-white/50 transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchCode()}
                />
              </div>
              <Button
                onClick={handleSearchCode}
                size="lg"
                className="h-14 px-8 bg-white text-purple-600 hover:bg-gray-50 font-semibold rounded-2xl shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
              >
                <Zap className="w-5 h-5 mr-2" />
                立即探索
              </Button>
            </div>

            {/* 统计数据 */}
            <div className="flex flex-wrap gap-8 md:gap-12 mt-12 pt-8 border-t border-white/20">
              {[
                { label: '精美资源', value: '10K+', icon: Heart },
                { label: '活跃创作者', value: '500+', icon: Users },
                { label: '用户下载', value: '100K+', icon: Download },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <div className="text-purple-200 text-sm">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hot Creators */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-linear-to-br from-purple-100 to-purple-200 shadow-md">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">热门创作者</h2>
                <p className="text-sm text-gray-500 mt-0.5">最受欢迎的内容创作者</p>
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingCreators ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-14 w-14 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : creatorsError ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">创作者数据加载失败，请稍后刷新重试</p>
              </div>
            ) : creators.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <Users className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">暂无创作者数据</p>
              </div>
            ) : (
              creators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} variant="compact" />
              ))
            )}
          </div>
        </section>

        {/* Hot Resources */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-linear-to-br from-indigo-100 to-purple-200 shadow-md">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">热门资源</h2>
                <p className="text-sm text-gray-500 mt-0.5">最新最热的精选内容</p>
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

          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loadingResources ? (
              Array.from({ length: 12 }).map((_, i) => <ResourceCardSkeleton key={i} />)
            ) : resourcesError ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">资源数据加载失败，请稍后刷新重试</p>
              </div>
            ) : resources.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <TrendingUp className="w-12 h-12 mb-3 opacity-30" />
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
