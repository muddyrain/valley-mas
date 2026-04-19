import { Clock3, Megaphone, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWebSystemUpdates, type WebSystemUpdateItem } from '@/api/systemUpdate';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 10;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 24%, white) 45%, var(--theme-page-cool) 100%)',
};

function formatPublishTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function SystemUpdates() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WebSystemUpdateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  const loadPage = async (targetPage: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      const res = await getWebSystemUpdates(targetPage, PAGE_SIZE);
      setTotal(res.total ?? 0);
      if (append) {
        setItems((prev) => [...prev, ...(res.list ?? [])]);
      } else {
        setItems(res.list ?? []);
      }
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadPage(1, false);
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await loadPage(nextPage, true);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner padding="py-10" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
              <Megaphone className="h-7 w-7 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">系统更新日志</h1>
              <p className="mt-1 text-sm text-white/82">
                {loading ? '正在整理最近更新...' : `共 ${total} 条更新，以下仅展示 Web 端变更`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl border-white/28 bg-white/16 px-5 text-white shadow-lg backdrop-blur-md hover:bg-white/22 hover:text-white"
            onClick={() => navigate('/')}
          >
            返回首页
          </Button>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm"
              >
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-11/12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <EmptyState
              icon={Sparkles}
              title="暂时还没有系统更新"
              description="后续 Web 功能升级后，这里会第一时间同步更新内容与时间。"
              actionLabel="去首页看看"
              onAction={() => navigate('/')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(var(--theme-primary-rgb),0.16)]"
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                    <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-theme-soft px-3 py-1 text-xs text-theme-primary">
                      <Clock3 className="h-3.5 w-3.5" />
                      更新时间：{formatPublishTime(item.publishedAt)}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.content}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore ? (
              <div className="pt-3 text-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="rounded-xl border-theme-soft-strong bg-white/80 px-6 text-theme-primary hover:bg-theme-soft"
                >
                  {loadingMore ? '加载中...' : '加载更多更新'}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
