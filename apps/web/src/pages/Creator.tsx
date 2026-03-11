import { ChevronRight, Download, Image, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Creator, getHotCreators } from '@/api/creator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatorPage() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        setLoading(true);
        const data = await getHotCreators(1, 20);
        setCreators(data.list);
      } catch (error) {
        console.error('加载创作者失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCreators();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">创作者广场</h1>
              <p className="text-gray-500">发现优秀的壁纸创作者</p>
            </div>
          </div>
        </div>

        {/* Creator Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-3 pt-1">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : creators.map((creator) => (
                <Card
                  key={creator.id}
                  className="group cursor-pointer transition-all hover:shadow-lg hover:border-purple-200"
                  onClick={() => navigate(`/creator/${creator.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border-2 border-purple-100">
                        <AvatarImage src={creator.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-xl font-bold">
                          {creator.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-gray-900 truncate">
                            {creator.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 truncate mb-3">
                          {creator.description || '暂无简介'}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Image className="h-4 w-4 text-purple-500" />
                            {creator.resourceCount}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Download className="h-4 w-4 text-blue-500" />
                            {creator.downloadCount}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-pink-500" />
                            {creator.followerCount}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </div>
  );
}
