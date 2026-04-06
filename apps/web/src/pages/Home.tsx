import {
  ArrowRight,
  BookOpen,
  Download,
  Heart,
  Images,
  Search,
  Sparkles,
  SquareChartGantt,
  UserRound,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getPosts, type Post } from '@/api/blog';
import { type Creator, getHotCreators } from '@/api/creator';
import {
  favoriteResource,
  getAllResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import { BlogFeedCard } from '@/components/blog/BlogFeedCard';
import CreatorCard from '@/components/CreatorCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import { createPlainTextExcerpt } from '@/utils/blog';

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <div className="theme-eyebrow inline-flex items-center rounded-full border bg-white/82 px-4 py-1.5 text-[11px] tracking-[0.32em] uppercase shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)] backdrop-blur">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h2 className="text-[38px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[44px]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-[0_18px_48px_rgba(148,163,184,0.1)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_22px_54px_rgba(148,163,184,0.14)]">
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accent}`} />
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

function HeroRibbon({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/78 px-4 py-2 shadow-[0_14px_36px_rgba(148,163,184,0.1)] backdrop-blur">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-soft text-theme-primary">
        {icon}
      </div>
      <div className="leading-tight">
        <div className="text-[11px] tracking-[0.16em] text-slate-400 uppercase">{label}</div>
        <div className="text-sm font-medium text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function QuickEntryCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] border border-white/80 bg-white/84 px-4 py-4 text-left shadow-[0_12px_28px_rgba(148,163,184,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(148,163,184,0.12)]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f7fafc] text-slate-600 shadow-sm">
        {icon}
      </div>
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-6 text-slate-500">{description}</div>
    </button>
  );
}

function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[32px] border border-dashed border-[#e6d7c7] bg-white/65 px-8 py-12 text-center shadow-[0_20px_56px_rgba(148,163,184,0.1)] backdrop-blur">
      <div className="mx-auto max-w-xl space-y-3">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-7 text-slate-500">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

function ResourceFavoriteButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 backdrop-blur transition ${
        active
          ? 'bg-rose-500 text-white shadow-[0_12px_28px_rgba(244,63,94,0.35)]'
          : 'bg-black/22 text-white hover:bg-black/34'
      }`}
      aria-label={active ? '取消收藏' : '收藏资源'}
    >
      <Heart className={`h-4.5 w-4.5 ${active ? 'fill-current' : ''}`} />
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [creatorCode, setCreatorCode] = useState('');
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  const isCreator = user?.role === 'creator';

  useEffect(() => {
    let cancelled = false;
    setLoadingCreators(true);
    getHotCreators(1, 8)
      .then((data) => {
        if (cancelled) return;
        setCreators(data.list ?? []);
      })
      .catch(() => {
        if (!cancelled) setCreators([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCreators(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingResources(true);
    getAllResources({ page: 1, pageSize: 12 })
      .then((data) => {
        if (cancelled) return;
        const list = data.list ?? [];
        setResources(list);
        const nextFavoritedMap: Record<string, boolean> = {};
        list.forEach((item) => {
          nextFavoritedMap[item.id] = item.isFavorited ?? false;
        });
        setFavoritedMap(nextFavoritedMap);
      })
      .catch(() => {
        if (!cancelled) setResources([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingResources(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingPosts(true);
    getPosts({ page: 1, pageSize: 6 })
      .then((data) => {
        if (cancelled) return;
        setPosts(data.list ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPosts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const wallpaperResources = useMemo(
    () => resources.filter((item) => item.type === 'wallpaper' || item.type === 'background'),
    [resources],
  );
  const avatarResources = useMemo(
    () => resources.filter((item) => item.type === 'avatar'),
    [resources],
  );
  const featuredWallpaper = wallpaperResources[0] || resources[0];
  const wallpaperRail = featuredWallpaper
    ? wallpaperResources.filter((item) => item.id !== featuredWallpaper.id).slice(0, 3)
    : wallpaperResources.slice(0, 3);
  const avatarShelf = avatarResources.slice(0, 4);
  const featuredPost = posts[0];
  const featuredPostExcerpt = featuredPost
    ? createPlainTextExcerpt(featuredPost.excerpt || featuredPost.title, 96)
    : '';

  const handleFavoriteResource = async (event: React.MouseEvent, resource: Resource) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isAuthenticated) {
      toast.info('登录后再收藏会更方便。');
      navigate('/login');
      return;
    }
    const current = favoritedMap[resource.id] ?? false;
    setFavoritedMap((prev) => ({ ...prev, [resource.id]: !current }));
    try {
      if (current) {
        await unfavoriteResource(resource.id);
        toast.success('已取消收藏');
      } else {
        await favoriteResource(resource.id);
        toast.success('已加入收藏');
      }
    } catch {
      setFavoritedMap((prev) => ({ ...prev, [resource.id]: current }));
    }
  };

  const handleSearchCreator = () => {
    const value = creatorCode.trim();
    if (!value) {
      toast.info('先输入创作者口令。');
      return;
    }
    navigate(`/creator/${value}`);
  };

  return (
    <div className="bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-7 md:px-10 md:py-10">
          <div className="theme-hero-glow absolute inset-0" />
          <div
            className="absolute -left-10 top-24 h-56 w-56 rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--theme-tertiary-rgb),0.24), transparent 72%)',
            }}
          />
          <div
            className="absolute right-10 top-14 h-48 w-48 rounded-full blur-2xl"
            style={{
              background:
                'radial-gradient(circle, rgba(var(--theme-secondary-rgb),0.22), transparent 74%)',
            }}
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.16fr_0.84fr] lg:items-start">
            <div className="space-y-8">
              <div className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white/82 px-4 py-1.5 text-xs tracking-[0.22em] text-theme-primary uppercase shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Valley Project
              </div>
              <div className="max-w-3xl space-y-5">
                <h1 className="max-w-[760px] text-[48px] font-black leading-[0.95] tracking-[-0.06em] text-slate-950 md:text-[78px]">
                  <span className="block">记录正在发生的，</span>
                  <span className="text-gradient mt-2 block pl-1 md:pl-2">也收藏值得留下的。</span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  Valley 持续整理博客、图文、资源和创作过程，也把一些正在成形的内容慢慢收拢进来。
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  size="lg"
                  className="rounded-full bg-slate-950 px-6 text-white shadow-[0_18px_46px_rgba(15,23,42,0.2)] hover:bg-slate-800"
                  onClick={() => navigate('/blog')}
                >
                  浏览内容
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-theme-soft-strong rounded-full border bg-white/76 px-6 text-slate-700 shadow-sm hover:bg-white"
                >
                  去看资源页
                </Button>
                {isCreator ? (
                  <Button
                    size="lg"
                    className="theme-btn-primary rounded-full px-6 text-white shadow-sm"
                    onClick={() => navigate('/my-space')}
                  >
                    进入创作空间
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <HeroRibbon
                  icon={<BookOpen className="h-4 w-4" />}
                  label="内容"
                  value={featuredPost ? featuredPost.title : '最新内容整理中'}
                />
                <HeroRibbon
                  icon={<Images className="h-4 w-4" />}
                  label="资源"
                  value={featuredWallpaper ? featuredWallpaper.title : '资源持续补充中'}
                />
                <HeroRibbon
                  icon={<UserRound className="h-4 w-4" />}
                  label="创作者"
                  value={loadingCreators ? '内容持续更新中' : `${creators.length}+ 位展示中`}
                />
              </div>
              <div className="rounded-[28px] border border-white/80 bg-white/78 p-3 shadow-[0_16px_40px_rgba(148,163,184,0.12)] backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={creatorCode}
                      onChange={(event) => setCreatorCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSearchCreator();
                      }}
                      placeholder="输入创作者口令"
                      className="h-12 rounded-full border-theme-border bg-theme-soft pl-10 text-sm shadow-none"
                    />
                  </div>
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-theme-primary px-6 text-white hover:bg-theme-primary-hover"
                    onClick={handleSearchCreator}
                  >
                    查看创作者
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <HeroStat
                  label="持续更新的内容入口"
                  value={loadingPosts ? '...' : `${posts.length}+`}
                  accent="bg-[#f59e0b]"
                />
                <HeroStat
                  label="当前可浏览的资源"
                  value={loadingResources ? '...' : `${resources.length}+`}
                  accent="bg-[#60a5fa]"
                />
                <HeroStat
                  label="正在展示的创作者"
                  value={loadingCreators ? '...' : `${creators.length}+`}
                  accent="bg-[#34d399]"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(247,251,255,0.82))] p-5 shadow-[0_18px_44px_rgba(148,163,184,0.1)] backdrop-blur">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                    <Sparkles className="text-theme-primary h-3.5 w-3.5" />
                    本站概览
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.12fr_0.88fr]">
                    <div className="rounded-[26px] border border-theme-shell-border bg-[linear-gradient(145deg,rgba(255,255,255,0.98),color-mix(in_srgb,var(--theme-primary-soft)_60%,white))] p-5 shadow-[0_14px_36px_rgba(var(--theme-primary-rgb),0.12)]">
                      <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                        Overview
                      </div>
                      <div className="mt-3 text-lg font-medium leading-8 text-slate-900">
                        这里持续更新内容、资源和创作记录，也保留正在成形的阶段性整理。
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="rounded-[22px] border border-white/80 bg-white/86 p-4">
                        <div className="text-theme-primary text-xs tracking-[0.12em]">最新标题</div>
                        <div className="mt-2 line-clamp-2 text-base font-medium leading-7 text-slate-900">
                          {featuredPost ? featuredPost.title : '下一篇内容正在路上'}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/86 p-4">
                        <div className="text-theme-primary text-xs tracking-[0.12em]">当前资源</div>
                        <div className="mt-2 line-clamp-2 text-base font-medium leading-7 text-slate-900">
                          {featuredWallpaper ? featuredWallpaper.title : '新的资源整理中'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-theme-shell-border bg-[linear-gradient(135deg,rgba(255,255,255,0.92),color-mix(in_srgb,var(--theme-primary-soft)_50%,white))] px-4 py-4 shadow-[0_16px_36px_rgba(148,163,184,0.08)]">
                    <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                      Content Flow
                    </div>
                    <div className="mt-2 text-lg font-medium leading-8 text-slate-900">
                      更新、整理和归档会持续发生。
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/75 bg-white/82 px-4 py-4">
                      <div className="text-theme-primary text-xs tracking-[0.12em]">浏览入口</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        博客、图文、资源
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/75 bg-white/82 px-4 py-4">
                      <div className="text-theme-primary text-xs tracking-[0.12em]">创作节奏</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">内容持续补充中</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[34px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,248,241,0.84))] p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div className="bg-theme-soft text-theme-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                    <BookOpen className="h-3.5 w-3.5" />
                    最新内容入口
                  </div>
                  <span className="text-xs text-slate-400">内容更新</span>
                </div>
                {loadingPosts ? (
                  <div className="space-y-3">
                    <Skeleton className="h-48 rounded-[28px]" />
                    <Skeleton className="h-6 w-2/3 rounded-full" />
                    <Skeleton className="h-20 rounded-[22px]" />
                  </div>
                ) : featuredPost ? (
                  <button
                    type="button"
                    className="w-full space-y-4 text-left"
                    onClick={() => navigate(`/blog/${featuredPost.id}`)}
                  >
                    <div className="relative h-60 overflow-hidden rounded-[28px] border border-theme-shell-border bg-theme-soft">
                      {featuredPost.cover ? (
                        <img
                          src={featuredPost.cover}
                          alt={featuredPost.title}
                          className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92),rgba(250,240,228,0.9))]">
                          <SquareChartGantt className="h-12 w-12 text-theme-primary opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/58 via-black/18 to-transparent p-5 text-white">
                        <div className="inline-flex items-center rounded-full bg-white/18 px-3 py-1 text-xs backdrop-blur">
                          {featuredPost.postType === 'image_text' ? '图文创作' : '博客'}
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-2xl font-semibold">
                          {featuredPost.title}
                        </h3>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-theme-shell-border bg-theme-soft p-4">
                      <p className="text-sm leading-7 text-slate-600">
                        {featuredPostExcerpt || '这次更新已经放到内容区里了，点进去就能继续看。'}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400">
                        <span>{featuredPost.postType === 'image_text' ? '图文创作' : '博客'}</span>
                        <span>·</span>
                        <span>最新内容</span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-[24px] bg-theme-soft p-6 text-sm text-slate-500">
                    暂时还没有新的内容更新。
                  </div>
                )}
              </div>
              <div className="rounded-[34px] border border-theme-shell-border bg-[linear-gradient(180deg,rgba(247,251,255,0.95),rgba(255,255,255,0.86))] p-5 shadow-[0_20px_56px_rgba(var(--theme-primary-rgb),0.10)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600">
                    <Images className="h-3.5 w-3.5 text-theme-primary" />
                    近期常用入口
                  </div>
                  <div className="text-xs text-slate-400">快捷访问</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <QuickEntryCard
                    icon={<Images className="h-4 w-4 text-theme-primary" />}
                    title="资源整理"
                    description="资源浏览与收藏入口。"
                    onClick={() => navigate('/resources')}
                  />
                  <QuickEntryCard
                    icon={<BookOpen className="h-4 w-4 text-theme-primary" />}
                    title="博客与图文"
                    description="最近更新的内容都在这里。"
                    onClick={() => navigate('/blog')}
                  />
                  {isCreator ? (
                    <QuickEntryCard
                      icon={<SquareChartGantt className="h-4 w-4 text-emerald-500" />}
                      title="创作空间"
                      description="继续整理和管理自己的内容。"
                      onClick={() => navigate('/my-space')}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <SectionHeading
            eyebrow="CREATORS"
            title="创作者空间"
            description="最近活跃的创作者会先出现在这里。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-theme-shell-border bg-white/80 px-5 text-slate-700 hover:bg-white"
                onClick={() => navigate('/creators')}
              >
                去看创作者页
              </Button>
            }
          />
          <div className="theme-section-shell rounded-[36px] border p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between rounded-[28px] border border-white/85 bg-white/72 px-4 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">最近活跃</div>
                <div className="mt-1 text-sm text-slate-500">这里会先展示最近有更新的创作者。</div>
              </div>
              <div className="bg-theme-soft text-theme-primary rounded-full px-4 py-2 text-sm">
                {creators.length} 位创作者
              </div>
            </div>
            {loadingCreators ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 rounded-[28px]" />
                ))}
              </div>
            ) : creators.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {creators.slice(0, 4).map((creator) => (
                  <CreatorCard key={creator.id} creator={creator} variant="compact" />
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="还没有展示中的创作者"
                description="之后这里会放最近活跃的创作者入口。"
                action={
                  <Button
                    variant="outline"
                    className="rounded-full border-theme-shell-border bg-white/80 px-5"
                    onClick={() => navigate('/blog')}
                  >
                    先去看内容
                  </Button>
                }
              />
            )}
          </div>
        </section>

        <section className="mt-24">
          <SectionHeading
            eyebrow="RESOURCES"
            title="资源精选"
            description="最近整理出来的资源会先出现在这里。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-theme-shell-border bg-white/85 px-5 text-theme-primary hover:bg-white"
                onClick={() => navigate('/resources')}
              >
                进入资源页
              </Button>
            }
          />
          <div className="theme-section-shell rounded-[36px] border p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-[28px] border border-white/85 bg-white/72 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">本期资源</div>
                <div className="mt-1 text-sm text-slate-500">最近整理出的图像内容。</div>
              </div>
              <div className="bg-theme-soft text-theme-primary rounded-full px-4 py-2 text-sm">
                {resources.length} 项内容
              </div>
            </div>
            {loadingResources ? (
              <div className="grid gap-4 lg:grid-cols-[1.5fr_0.74fr]">
                <div className="space-y-4">
                  <Skeleton className="h-[280px] rounded-[30px]" />
                  <div className="grid gap-4 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton key={index} className="h-[148px] rounded-[24px]" />
                    ))}
                  </div>
                </div>
                <Skeleton className="h-[360px] rounded-[30px]" />
              </div>
            ) : resources.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-[1.54fr_0.72fr]">
                <div className="space-y-5">
                  {featuredWallpaper ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/resource/${featuredWallpaper.id}`)}
                      className="group block w-full overflow-hidden rounded-[32px] border border-theme-shell-border bg-white text-left shadow-[0_20px_56px_rgba(var(--theme-primary-rgb),0.12)] transition hover:-translate-y-1 hover:shadow-[0_26px_64px_rgba(var(--theme-primary-rgb),0.18)]"
                    >
                      <div className="relative h-[336px] overflow-hidden bg-slate-100">
                        <img
                          src={featuredWallpaper.thumbnailUrl ?? featuredWallpaper.url}
                          alt={featuredWallpaper.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/72 via-black/20 to-transparent" />
                        <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-theme-primary backdrop-blur">
                          热门壁纸
                        </div>
                        <div className="absolute right-5 top-5">
                          <ResourceFavoriteButton
                            active={favoritedMap[featuredWallpaper.id] ?? false}
                            onClick={(event) => handleFavoriteResource(event, featuredWallpaper)}
                          />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <div className="text-[30px] font-semibold leading-tight">
                            {featuredWallpaper.title}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/82">
                            <span>{featuredWallpaper.creatorName}</span>
                            <span className="inline-flex items-center gap-1">
                              <Download className="h-3.5 w-3.5" />
                              {featuredWallpaper.downloadCount} 次下载
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ) : null}
                  {wallpaperRail.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {wallpaperRail.slice(0, 2).map((resource) => (
                        <button
                          key={resource.id}
                          type="button"
                          onClick={() => navigate(`/resource/${resource.id}`)}
                          className="group overflow-hidden rounded-[26px] border border-theme-shell-border bg-white text-left shadow-[0_16px_40px_rgba(148,163,184,0.1)] transition hover:-translate-y-1 hover:shadow-[0_20px_52px_rgba(var(--theme-primary-rgb),0.14)]"
                        >
                          <div className="relative h-44 overflow-hidden bg-slate-100">
                            <img
                              src={resource.thumbnailUrl ?? resource.url}
                              alt={resource.title}
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                            />
                            <div className="absolute right-3 top-3">
                              <ResourceFavoriteButton
                                active={favoritedMap[resource.id] ?? false}
                                onClick={(event) => handleFavoriteResource(event, resource)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2 p-4">
                            <div className="line-clamp-1 text-base font-medium text-slate-900">
                              {resource.title}
                            </div>
                            <div className="text-xs text-slate-500">{resource.creatorName}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[32px] border border-theme-shell-border bg-white/84 p-5 shadow-[0_18px_50px_rgba(148,163,184,0.1)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">头像收藏</div>
                      <div className="mt-1 text-sm text-slate-500">最近整理的头像内容。</div>
                    </div>
                    <div className="bg-theme-soft text-theme-primary rounded-full px-3 py-1 text-xs">
                      {avatarShelf.length} 项
                    </div>
                  </div>
                  {avatarShelf.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {avatarShelf.map((resource) => (
                        <button
                          key={resource.id}
                          type="button"
                          onClick={() => navigate(`/resource/${resource.id}`)}
                          className="group overflow-hidden rounded-[24px] border border-theme-shell-border bg-theme-soft/30 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(148,163,184,0.12)]"
                        >
                          <div className="relative px-4 pb-3 pt-4">
                            <div className="absolute right-3 top-3">
                              <ResourceFavoriteButton
                                active={favoritedMap[resource.id] ?? false}
                                onClick={(event) => handleFavoriteResource(event, resource)}
                              />
                            </div>
                            <div className="mx-auto h-24 w-24 overflow-hidden rounded-[22px] border border-theme-shell-border bg-white shadow-[0_8px_24px_rgba(148,163,184,0.1)]">
                              <img
                                src={resource.thumbnailUrl ?? resource.url}
                                alt={resource.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </div>
                          <div className="space-y-1 px-4 pb-4 text-center">
                            <div className="line-clamp-1 text-sm font-medium text-slate-900">
                              {resource.title}
                            </div>
                            <div className="text-xs text-slate-500">
                              {resource.downloadCount} 次下载
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] bg-theme-soft px-4 py-10 text-center text-sm text-slate-500">
                      当前资源里还没有头像内容。
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="还没有可展示的资源"
                description="之后这里会先放当前资源列表里的图片内容。"
                action={
                  <Button
                    variant="outline"
                    className="rounded-full border-theme-shell-border bg-white/85 px-5"
                    onClick={() => navigate('/resources')}
                  >
                    去看资源页
                  </Button>
                }
              />
            )}
          </div>
        </section>

        <section className="mt-24">
          <SectionHeading
            eyebrow="UPDATES"
            title="内容更新"
            description="最新发布的博客和图文会先出现在这里。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-theme-shell-border bg-white/80 px-5 text-slate-700 hover:bg-white"
                onClick={() => navigate('/blog')}
              >
                去看内容页
              </Button>
            }
          />
          <div className="theme-section-shell rounded-[36px] border p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between rounded-[28px] border border-white/85 bg-white/72 px-4 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">最近更新</div>
                <div className="mt-1 text-sm text-slate-500">博客与图文的最新内容。</div>
              </div>
              <div className="bg-theme-soft text-theme-primary rounded-full px-4 py-2 text-sm">
                {posts.length} 条更新
              </div>
            </div>
            {loadingPosts ? (
              <div className="grid gap-5 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-[420px] rounded-[30px]" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid gap-5 xl:grid-cols-3">
                {posts.slice(0, 3).map((post) => (
                  <div
                    key={post.id}
                    className="rounded-[30px] bg-white/68 p-2 shadow-[0_14px_40px_rgba(var(--theme-primary-rgb),0.08)]"
                  >
                    <BlogFeedCard post={post} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="还没有可展示的内容更新"
                description="新的博客或图文发布后，会先出现在这里。"
                action={
                  isCreator ? (
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/80 px-5"
                      onClick={() => navigate('/my-space')}
                    >
                      去创作空间看看
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </section>

        <section className="mt-24">
          <div className="theme-section-shell overflow-hidden rounded-[40px] border p-8 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                  <UserRound className="text-theme-primary h-3.5 w-3.5" />
                  继续逛逛
                </div>
                <h3 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-[40px]">
                  内容、资源与创作者入口
                  <br />
                  都在这里继续展开。
                </h3>
                <p className="max-w-xl text-sm leading-8 text-slate-500 md:text-base">
                  如果你想继续浏览、找资源，或者看看最近活跃的创作者，可以从这里接着往下走。
                </p>
                <div className="flex flex-wrap gap-3">
                  <HeroRibbon
                    icon={<BookOpen className="h-4 w-4" />}
                    label="内容"
                    value="博客与图文"
                  />
                  <HeroRibbon
                    icon={<Images className="h-4 w-4" />}
                    label="资源"
                    value="完整资源列表"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => navigate('/blog')}
                  className="rounded-[28px] border border-white/80 bg-white/84 px-5 py-6 text-left shadow-[0_14px_36px_rgba(148,163,184,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(148,163,184,0.12)]"
                >
                  <div className="bg-theme-soft text-theme-primary mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="text-lg font-medium text-slate-900">内容页</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">继续浏览博客和图文。</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/resources')}
                  className="rounded-[28px] border border-white/80 bg-white/84 px-5 py-6 text-left shadow-[0_14px_36px_rgba(148,163,184,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(148,163,184,0.12)]"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-theme-soft text-theme-primary">
                    <Images className="h-5 w-5" />
                  </div>
                  <div className="text-lg font-medium text-slate-900">资源页</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">去看完整的资源列表。</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/creators')}
                  className="rounded-[28px] border border-white/80 bg-white/84 px-5 py-6 text-left shadow-[0_14px_36px_rgba(148,163,184,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(148,163,184,0.12)]"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-theme-soft text-theme-primary">
                    <SquareChartGantt className="h-5 w-5" />
                  </div>
                  <div className="text-lg font-medium text-slate-900">创作者页</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">
                    看看最近活跃的创作者。
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
