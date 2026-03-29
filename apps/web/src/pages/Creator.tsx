import { Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Creator, getHotCreators } from '@/api/creator';
import CreatorCard from '@/components/CreatorCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function CreatorPage() {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const loadCreators = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const data = await getHotCreators(1, 20);
        setCreators(data.list || []);
      } catch (error) {
        console.error('加载创作者失败', error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadCreators();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-linear-to-br from-purple-500 to-indigo-600 p-2">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">创作者广场</h1>
              <p className="text-gray-500">发现优质创作者与他们的最新内容</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
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
          ) : loadError ? (
            <div className="col-span-full">
              <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-linear-to-br from-white via-violet-50/45 to-sky-50/50 p-10 text-center shadow-[0_14px_38px_rgba(103,80,164,0.12)]">
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-200/35 blur-2xl" />
                <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />
                <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/85 shadow-lg ring-1 ring-violet-200">
                  <Users className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="relative text-xl font-semibold text-slate-900">
                  创作者列表加载失败
                </h3>
                <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                  网络或服务暂时不可用，请稍后刷新重试。
                </p>
              </div>
            </div>
          ) : creators.length === 0 ? (
            <div className="col-span-full">
              <div className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-linear-to-br from-white via-violet-50/45 to-sky-50/50 p-10 text-center shadow-[0_14px_38px_rgba(103,80,164,0.12)]">
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-200/35 blur-2xl" />
                <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-sky-200/40 blur-2xl" />
                <div className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[linear-gradient(rgba(139,92,246,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.2)_1px,transparent_1px)] bg-size-[24px_24px]" />

                <div className="relative mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/85 shadow-lg ring-1 ring-violet-200">
                  <Users className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="relative text-xl font-semibold text-slate-900">
                  暂时还没有创作者入驻
                </h3>
                <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                  你可以先浏览图文与资源内容，或直接申请成为创作者。
                </p>
                <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => navigate('/apply-creator')}
                    className="rounded-xl bg-violet-600 px-5 text-white hover:bg-violet-700"
                  >
                    申请成为创作者
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/blog')}
                    className="rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50"
                  >
                    去看图文博客
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            creators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} variant="detail" />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
