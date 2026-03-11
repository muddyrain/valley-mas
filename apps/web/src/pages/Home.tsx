import { Search, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Creator, getHotCreators } from '@/api/creator';
import { getHotResources, type Resource } from '@/api/resource';
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // 并行加载热门创作者和热门资源
        const [creatorsData, resourcesData] = await Promise.all([
          getHotCreators(1, 8),
          getHotResources(1, 12),
        ]);

        setCreators(creatorsData.list);
        setResources(resourcesData.list);
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-600 via-purple-700 to-indigo-800 p-8 md:p-12 mb-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">发现精美壁纸</h1>
            <p className="text-purple-100 mb-8 text-lg">输入创作者口令，快速找到你喜欢的壁纸</p>

            <div className="flex gap-3 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="输入创作者口令"
                  className="pl-10 h-12 bg-white border-0 text-gray-900 placeholder:text-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchCode()}
                />
              </div>
              <Button
                onClick={handleSearchCode}
                size="lg"
                className="h-12 px-6 bg-white text-purple-600 hover:bg-gray-100 font-semibold"
              >
                进入
              </Button>
            </div>
          </div>
        </div>

        {/* Hot Creators */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">热门创作者</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              : creators.map((creator) => (
                  <Card
                    key={creator.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-purple-200"
                    onClick={() => navigate(`/creator/${creator.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 shrink-0 rounded-full overflow-hidden">
                          <AvatarImage src={creator.avatar} />
                          <AvatarFallback className="bg-purple-100 text-purple-600 font-semibold">
                            {creator.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{creator.name}</h3>
                          <p className="text-sm text-gray-500">{creator.resourceCount} 作品</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>

        {/* Hot Wallpapers */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">热门资源</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate('/resources')}>
              查看更多 →
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="aspect-3/4 w-full" />
                    <CardContent className="p-3 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </CardContent>
                  </Card>
                ))
              : resources.map((resource) => (
                  <Card
                    key={resource.id}
                    className="group overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 border-gray-100"
                    onClick={() => navigate(`/resource/${resource.id}`)}
                  >
                    <div className="relative aspect-3/4 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                      <img
                        src={resource.thumbnailUrl || resource.url}
                        alt={resource.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      {/* 资源类型标签 */}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                        {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                      </div>
                      {/* Hover 遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path
                                  fillRule="evenodd"
                                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {resource.downloadCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm text-gray-900 truncate mb-1">
                        {resource.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={resource.creatorAvatar} />
                          <AvatarFallback className="text-[8px]">
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
