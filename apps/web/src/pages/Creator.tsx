import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Creator, getHotCreators } from '@/api/creator';
import CreatorCard from '@/components/CreatorCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatorPage() {
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
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500 to-indigo-600">
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
                <CreatorCard key={creator.id} creator={creator} variant="detail" />
              ))}
        </div>
      </div>
    </div>
  );
}
