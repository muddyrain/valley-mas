import { Download, Search, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type Creator as CreatorType, searchPublicCreators } from '@/api/creator';
import CreatorCard from '@/components/CreatorCard';
import EmptyState from '@/components/EmptyState';
import HeroSectionTitle from '@/components/page/HeroSectionTitle';
import HeroStatChip from '@/components/page/HeroStatChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 12;

export default function Creator() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creators, setCreators] = useState<CreatorType[]>([]);
  const [total, setTotal] = useState(0);
  const [inputKeyword, setInputKeyword] = useState(searchParams.get('keyword')?.trim() || '');
  const [retryTick, setRetryTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentKeyword = searchParams.get('keyword')?.trim() || '';
  const parsedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  useEffect(() => {
    setInputKeyword(currentKeyword);
  }, [currentKeyword]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    searchPublicCreators({
      page: currentPage,
      pageSize: PAGE_SIZE,
      keyword: currentKeyword || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setCreators(data.list ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        toast.error('加载创作者失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentKeyword, currentPage, retryTick]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = () => {
    const nextKeyword = inputKeyword.trim();
    const nextParams = new URLSearchParams(searchParams);
    if (nextKeyword) {
      nextParams.set('keyword', nextKeyword);
    } else {
      nextParams.delete('keyword');
    }
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const clearSearch = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('keyword');
    nextParams.set('page', '1');
    setSearchParams(nextParams);
  };

  const totalResources = useMemo(
    () => creators.reduce((sum, creator) => sum + (creator.resourceCount || 0), 0),
    [creators],
  );

  const totalDownloads = useMemo(
    () => creators.reduce((sum, creator) => sum + (creator.downloadCount || 0), 0),
    [creators],
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="theme-hero-glow absolute inset-0" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <HeroSectionTitle
                eyebrow="CREATORS"
                title="创作者广场"
                description="这里展示最近活跃的创作者，以及他们正在持续整理的资源和内容，方便继续浏览、进入空间或找到喜欢的风格。"
              />

              <div className="flex flex-wrap gap-3">
                <HeroStatChip icon={<Users className="text-theme-primary h-4 w-4" />}>
                  {loading ? '...' : creators.length} 位创作者
                </HeroStatChip>
                <HeroStatChip icon={<Sparkles className="h-4 w-4 text-sky-500" />}>
                  {loading ? '...' : totalResources} 项内容
                </HeroStatChip>
                <HeroStatChip icon={<Download className="h-4 w-4 text-emerald-500" />}>
                  {loading ? '...' : totalDownloads} 次下载
                </HeroStatChip>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/80 bg-white/82 p-5 shadow-[0_20px_48px_rgba(148,163,184,0.08)] backdrop-blur">
              <div className="bg-theme-soft text-theme-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                <Users className="h-3.5 w-3.5" />
                创作者入口
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] border border-white/80 bg-[#fcfaf6] p-4">
                  <div className="text-base font-semibold text-slate-900">发现喜欢的创作者</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    从这里进入创作者空间，继续看 TA 的资源、分组和最近更新。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => navigate('/resources')}
                    className="rounded-[22px] border border-white/80 bg-[#f8fbff] px-4 py-4 text-left shadow-[0_12px_28px_rgba(148,163,184,0.06)] transition hover:bg-white"
                  >
                    <div className="text-sm font-medium text-slate-900">去看资源页</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">
                      继续浏览最新整理的资源内容。
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/apply-creator')}
                    className="bg-theme-soft text-theme-primary rounded-[22px] border border-white/80 px-4 py-4 text-left shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.08)] transition hover:bg-white"
                  >
                    <div className="text-sm font-medium text-slate-900">申请成为创作者</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">
                      整理自己的资源与内容，展示新的创作空间。
                    </div>
                  </button>
                </div>

                <div className="rounded-[22px] border border-white/80 bg-white/80 p-4">
                  <div className="mb-3 text-xs text-slate-500">创作者检索</div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative min-w-[220px] grow">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={inputKeyword}
                        onChange={(event) => setInputKeyword(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleSearch();
                        }}
                        placeholder="搜索创作者昵称、口令或简介"
                        className="h-10 rounded-xl border-white/90 bg-white pl-9"
                      />
                    </div>
                    <Button
                      onClick={handleSearch}
                      className="rounded-full bg-theme-primary px-4 text-white hover:bg-theme-primary-hover"
                    >
                      搜索
                    </Button>
                    {currentKeyword ? (
                      <Button
                        variant="ghost"
                        onClick={clearSearch}
                        className="rounded-full px-4 text-slate-500 hover:bg-white hover:text-slate-900"
                      >
                        <X className="mr-1 h-4 w-4" />
                        清除
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <div className="theme-panel-shell rounded-[36px] border p-5 md:p-6">
            {loading ? (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="h-8 w-40 rounded-full bg-white/75" />
                  <div className="h-10 w-28 rounded-full bg-white/75" />
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-[198px] rounded-[30px]" />
                  ))}
                </div>
              </>
            ) : error ? (
              <div className="rounded-[32px] bg-white/66 p-4">
                <EmptyState
                  icon={Users}
                  title="创作者暂时没有加载出来"
                  description="稍后再试一次，或者先去其他内容页继续浏览。"
                  actionLabel="重新加载"
                  onAction={() => setRetryTick((prev) => prev + 1)}
                />
              </div>
            ) : creators.length === 0 ? (
              <div className="rounded-[32px] bg-white/66 p-4">
                <EmptyState
                  icon={Users}
                  title="还没有展示中的创作者"
                  description={
                    currentKeyword
                      ? `没有找到包含“${currentKeyword}”的创作者，换个关键词试试。`
                      : '新的创作者加入后，会先出现在这里。'
                  }
                  actionLabel="去申请创作者"
                  onAction={() => navigate('/apply-creator')}
                />
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-500">
                    {currentKeyword
                      ? `当前按关键词“${currentKeyword}”筛选创作者。`
                      : '当前展示最近活跃的创作者内容入口。'}
                  </div>
                  <div className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                    本页 {creators.length} / 共 {total} 位
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {creators.map((creator) => (
                    <div
                      key={creator.id}
                      className="rounded-[30px] bg-white/68 p-2 shadow-[0_14px_40px_rgba(148,163,184,0.08)]"
                    >
                      <CreatorCard creator={creator} />
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex justify-center">
                  {total > PAGE_SIZE ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        className="border-theme-soft-strong rounded-full border bg-white/82 px-5"
                        disabled={currentPage <= 1}
                        onClick={() => {
                          const nextParams = new URLSearchParams(searchParams);
                          nextParams.set('page', String(Math.max(1, currentPage - 1)));
                          setSearchParams(nextParams);
                        }}
                      >
                        上一页
                      </Button>
                      <span className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                        第 {currentPage} / {totalPages} 页
                      </span>
                      <Button
                        variant="outline"
                        className="border-theme-soft-strong rounded-full border bg-white/82 px-5"
                        disabled={currentPage >= totalPages}
                        onClick={() => {
                          const nextParams = new URLSearchParams(searchParams);
                          nextParams.set('page', String(Math.min(totalPages, currentPage + 1)));
                          setSearchParams(nextParams);
                        }}
                      >
                        下一页
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => navigate('/apply-creator')}
                      className="border-theme-soft-strong rounded-full border bg-white/82 px-8 text-slate-700"
                    >
                      成为下一位创作者
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
