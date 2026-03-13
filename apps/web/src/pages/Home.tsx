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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  // 收藏状态：key = resourceId, value = boolean
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [creatorsData, resourcesData] = await Promise.all([
          getHotCreators(1, 8),
          getHotResources(1, 12),
        ]);

        setCreators(creatorsData.list);
        setResources(resourcesData.list);

        // 直接从列表响应中读取 isFavorited 字段（服务端对登录用户返回收藏状态）
        const map: Record<string, boolean> = {};
        resourcesData.list.forEach((r) => {
          map[r.id] = r.isFavorited ?? false;
        });
        setFavoritedMap(map);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
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
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
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
              : creators.map((creator) => (
                  <CreatorCard key={creator.id} creator={creator} variant="compact" />
                ))}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden group">
                    <Skeleton className="aspect-3/4 w-full" />
                    <CardContent className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </CardContent>
                  </Card>
                ))
              : resources.map((resource, index) => (
                  <Card
                    key={resource.id}
                    className="group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border-gray-100 bg-white/80 backdrop-blur-sm"
                    onClick={() => navigate(`/resource/${resource.id}`)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative aspect-3/4 overflow-hidden bg-linear-to-br from-gray-100 to-gray-200">
                      <img
                        src={resource.thumbnailUrl || resource.url}
                        alt={resource.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* 资源类型标签 */}
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-white text-xs font-medium shadow-lg">
                          {resource.type === 'wallpaper' ? '🖼️ 壁纸' : '👤 头像'}
                        </span>
                      </div>
                      {/* Hover 遮罩和信息 */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2 py-1 rounded-lg">
                              <Download className="w-3.5 h-3.5" />
                              {resource.downloadCount}
                            </span>
                            <Button
                              size="xs"
                              className={`backdrop-blur-sm border-0 h-7 transition-colors ${
                                favoritedMap[resource.id]
                                  ? 'bg-pink-500/80 hover:bg-pink-600/80 text-white'
                                  : 'bg-white/20 hover:bg-white/30'
                              }`}
                              onClick={(e) => handleFavorite(e, resource)}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${favoritedMap[resource.id] ? 'fill-white' : ''}`}
                              />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm text-gray-900 truncate mb-2 group-hover:text-purple-600 transition-colors">
                        {resource.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Avatar className="h-5 w-5 border border-gray-200">
                          <AvatarImage src={resource.creatorAvatar} />
                          <AvatarFallback className="text-[10px] bg-purple-100 text-purple-600">
                            {resource.creatorName?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{resource.creatorName || '未知创作者'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>
      </div>
    </div>
  );
}
