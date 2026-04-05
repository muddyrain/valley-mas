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
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-[#e8d4bd] bg-white/80 px-4 py-1 text-xs tracking-[0.28em] text-[#b67638] uppercase backdrop-blur">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h2 className="text-4xl font-semibold tracking-tight text-slate-950 md:text-[42px]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-base leading-8 text-slate-600">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-[26px] border border-white/70 bg-white/78 p-4 shadow-[0_18px_48px_rgba(148,163,184,0.12)] backdrop-blur">
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accent}`} />
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
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

  const isCreator = user?.role === 'creator' || user?.role === 'admin';

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
  const avatarShelf = avatarResources.slice(0, 6);
  const featuredPost = posts[0];
  const featuredPostExcerpt = featuredPost
    ? createPlainTextExcerpt(featuredPost.excerpt || featuredPost.title, 84)
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
    <div className="bg-[linear-gradient(180deg,#fffaf5_0%,#fffefc_22%,#f7fbff_54%,#fffaf6_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[40px] border border-[#eedcc8] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),rgba(255,248,240,0.9)_40%,rgba(243,248,255,0.95)_100%)] px-6 py-7 shadow-[0_24px_80px_rgba(225,188,145,0.2)] md:px-10 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_85%_20%,rgba(96,165,250,0.2),transparent_24%),radial-gradient(circle_at_72%_80%,rgba(251,191,36,0.12),transparent_26%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-start">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-1.5 text-xs tracking-[0.22em] text-[#b6793f] uppercase shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Valley Project
              </div>
              <div className="max-w-3xl space-y-5">
                <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-slate-950 md:text-[72px] md:leading-[1.02]">
                  <span className="block">记录正在发生的，</span>
                  <span className="block text-[#b87731]">也收藏值得留下的。</span>
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
                  Valley
                  是一个持续更新的内容项目，整理博客、图文、资源，也收纳一些还在慢慢打磨的实验功能。
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
                  className="rounded-full border-[#ddc4aa] bg-white/76 px-6 text-slate-700 shadow-sm hover:bg-white"
                  onClick={() => navigate('/resources')}
                >
                  去看资源页
                </Button>
                {isCreator ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-[#cfd9eb] bg-[#f7fbff] px-6 text-slate-700 shadow-sm hover:bg-white"
                    onClick={() => navigate('/my-space')}
                  >
                    进入创作空间
                  </Button>
                ) : null}
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
                      className="h-12 rounded-full border-[#e6d6c5] bg-[#fffdf9] pl-10 text-sm shadow-none"
                    />
                  </div>
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-[#b87731] px-6 text-white hover:bg-[#a56827]"
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

              <div className="overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(247,251,255,0.78))] p-5 shadow-[0_18px_44px_rgba(148,163,184,0.1)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-[#b87731]" />
                    此刻内容
                  </div>
                  <div className="text-xs text-slate-400">轻量展示</div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[24px] border border-white/80 bg-white/86 p-5">
                    <div className="text-xs tracking-[0.18em] text-[#b87731] uppercase">
                      Valley Notes
                    </div>
                    <p className="mt-3 text-lg font-medium leading-8 text-slate-900">
                      内容、资源和灵感会继续慢慢整理，也会不断长出新的入口。
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[22px] border border-white/80 bg-white/84 px-4 py-4">
                      <div className="text-xs text-slate-400">最新内容</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        {featuredPost ? featuredPost.title : '等待下一次更新'}
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/80 bg-white/84 px-4 py-4">
                      <div className="text-xs text-slate-400">当前资源</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        {featuredWallpaper ? featuredWallpaper.title : '等待新的资源整理'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[34px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_60px_rgba(148,163,184,0.14)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#fff5e9] px-3 py-1 text-xs text-[#b87731]">
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
                    <div className="relative h-56 overflow-hidden rounded-[28px] border border-[#ecd7c1] bg-[#f8f2e8]">
                      {featuredPost.cover ? (
                        <img
                          src={featuredPost.cover}
                          alt={featuredPost.title}
                          className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92),rgba(250,240,228,0.9))]">
                          <SquareChartGantt className="h-12 w-12 text-[#caa67a]" />
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
                    <div className="rounded-[24px] bg-[#fcfaf6] p-4">
                      <p className="text-sm leading-7 text-slate-600">
                        {featuredPostExcerpt || '这次更新已经放到内容区里了，点进去就能继续看。'}
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-[24px] bg-[#fcfaf6] p-6 text-sm text-slate-500">
                    暂时还没有新的内容更新。
                  </div>
                )}
              </div>
              <div className="rounded-[34px] border border-[#dfe9f5] bg-[linear-gradient(180deg,rgba(247,251,255,0.95),rgba(255,255,255,0.86))] p-5 shadow-[0_20px_56px_rgba(96,165,250,0.12)]">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-600">
                  <Images className="h-3.5 w-3.5 text-sky-500" />
                  近期常用入口
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/resources')}
                    className="rounded-[24px] border border-white/80 bg-white/84 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-sm font-medium text-slate-900">资源整理</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">
                      先看图片，再进入详情。
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/blog')}
                    className="rounded-[24px] border border-white/80 bg-white/84 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-sm font-medium text-slate-900">博客与图文</div>
                    <div className="mt-1 text-xs leading-6 text-slate-500">
                      最近整理下来的内容都会放在这里。
                    </div>
                  </button>
                  {isCreator ? (
                    <button
                      type="button"
                      onClick={() => navigate('/my-space')}
                      className="rounded-[24px] border border-white/80 bg-white/84 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="text-sm font-medium text-slate-900">创作空间</div>
                      <div className="mt-1 text-xs leading-6 text-slate-500">
                        继续编辑、发布或管理自己的内容。
                      </div>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="CREATORS"
            title="创作者空间"
            description="最近活跃的创作者会先出现在这里。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-[#d8c4aa] bg-white/80 px-5 text-slate-700 hover:bg-white"
                onClick={() => navigate('/creators')}
              >
                去看创作者页
              </Button>
            }
          />
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
                  className="rounded-full border-[#d8c4aa] bg-white/80 px-5"
                  onClick={() => navigate('/blog')}
                >
                  先去看内容
                </Button>
              }
            />
          )}
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="RESOURCES"
            title="资源精选"
            description="首页先看更适合展示的资源图，想继续筛选、收藏或查看完整参数，再进入资源页。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-[#bfd5ee] bg-white/85 px-5 text-[#3f6f9e] hover:bg-white"
                onClick={() => navigate('/resources')}
              >
                进入资源页
              </Button>
            }
          />
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_26px_70px_rgba(148,163,184,0.12)] md:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-[28px] border border-white/85 bg-white/72 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">热门资源浏览</div>
                <div className="mt-1 text-sm text-slate-500">
                  壁纸和头像分开排布，浏览时会更舒服一点。
                </div>
              </div>
              <div className="rounded-full bg-[#edf5ff] px-4 py-2 text-sm text-[#5b87b3]">
                {resources.length} 项内容
              </div>
            </div>
            {loadingResources ? (
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.82fr]">
                <div className="space-y-4">
                  <Skeleton className="h-[280px] rounded-[30px]" />
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-[148px] rounded-[24px]" />
                    ))}
                  </div>
                </div>
                <Skeleton className="h-[448px] rounded-[30px]" />
              </div>
            ) : resources.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-[1.35fr_0.82fr]">
                <div className="space-y-5">
                  {featuredWallpaper ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/resource/${featuredWallpaper.id}`)}
                      className="group block w-full overflow-hidden rounded-[32px] border border-[#d5e6f5] bg-white text-left shadow-[0_20px_56px_rgba(96,165,250,0.12)] transition hover:-translate-y-1 hover:shadow-[0_26px_64px_rgba(96,165,250,0.18)]"
                    >
                      <div className="relative h-[360px] overflow-hidden bg-slate-100">
                        <img
                          src={featuredWallpaper.url}
                          alt={featuredWallpaper.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/72 via-black/20 to-transparent" />
                        <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-[#4a78a7] backdrop-blur">
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
                    <div className="grid gap-4 md:grid-cols-3">
                      {wallpaperRail.map((resource) => (
                        <button
                          key={resource.id}
                          type="button"
                          onClick={() => navigate(`/resource/${resource.id}`)}
                          className="group overflow-hidden rounded-[26px] border border-[#d8e6f3] bg-white text-left shadow-[0_16px_40px_rgba(148,163,184,0.1)] transition hover:-translate-y-1 hover:shadow-[0_20px_52px_rgba(96,165,250,0.14)]"
                        >
                          <div className="relative h-40 overflow-hidden bg-slate-100">
                            <img
                              src={resource.url}
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
                <div className="rounded-[32px] border border-[#d8e6f2] bg-white/84 p-5 shadow-[0_18px_50px_rgba(148,163,184,0.1)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">头像收藏夹</div>
                      <div className="mt-1 text-sm text-slate-500">头像适合更小、更紧凑地看。</div>
                    </div>
                    <div className="rounded-full bg-[#f4f8fc] px-3 py-1 text-xs text-slate-500">
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
                          className="group overflow-hidden rounded-[24px] border border-[#e4eef6] bg-[#fbfdff] text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(148,163,184,0.12)]"
                        >
                          <div className="relative px-4 pb-3 pt-4">
                            <div className="absolute right-3 top-3">
                              <ResourceFavoriteButton
                                active={favoritedMap[resource.id] ?? false}
                                onClick={(event) => handleFavoriteResource(event, resource)}
                              />
                            </div>
                            <div className="mx-auto h-28 w-28 overflow-hidden rounded-[24px] border border-[#e6edf5] bg-white shadow-[0_8px_24px_rgba(148,163,184,0.1)]">
                              <img
                                src={resource.url}
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
                    <div className="rounded-[24px] bg-[#f8fbfe] px-4 py-10 text-center text-sm text-slate-500">
                      当前资源里还没有头像内容。
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyPanel
                title="还没有可展示的资源"
                description="之后这里会先放当前资源列表里更适合展示的图片内容。"
                action={
                  <Button
                    variant="outline"
                    className="rounded-full border-[#bfd5ee] bg-white/85 px-5"
                    onClick={() => navigate('/resources')}
                  >
                    去看资源页
                  </Button>
                }
              />
            )}
          </div>
        </section>

        <section className="mt-20">
          <SectionHeading
            eyebrow="UPDATES"
            title="内容更新"
            description="最近更新的博客和图文会先放在这里。"
            action={
              <Button
                variant="outline"
                className="rounded-full border-[#e0ccba] bg-white/80 px-5 text-slate-700 hover:bg-white"
                onClick={() => navigate('/blog')}
              >
                去看内容页
              </Button>
            }
          />
          <div className="rounded-[36px] border border-[#ecdcc8] bg-[linear-gradient(180deg,rgba(255,250,244,0.92),rgba(255,255,255,0.88))] p-5 shadow-[0_26px_70px_rgba(225,188,145,0.14)] md:p-6">
            <div className="mb-5 flex items-center justify-between rounded-[28px] border border-white/85 bg-white/72 px-4 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">最近更新的内容</div>
                <div className="mt-1 text-sm text-slate-500">博客和图文会一起出现在这里。</div>
              </div>
              <div className="rounded-full bg-[#fff4e6] px-4 py-2 text-sm text-[#b87731]">
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
                  <BlogFeedCard key={post.id} post={post} />
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
                      className="rounded-full border-[#e0ccba] bg-white/80 px-5"
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

        <section className="mt-20">
          <div className="overflow-hidden rounded-[36px] border border-[#e8d8c6] bg-[linear-gradient(135deg,rgba(255,251,247,0.98),rgba(247,251,255,0.92))] p-8 shadow-[0_24px_70px_rgba(148,163,184,0.1)] md:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                  <UserRound className="h-3.5 w-3.5 text-[#b87731]" />
                  继续逛逛
                </div>
                <h3 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-[38px]">
                  内容、资源和创作者入口
                  <br />
                  都已经准备好了。
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => navigate('/blog')}
                  className="rounded-[26px] border border-white/80 bg-white/82 px-5 py-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <BookOpen className="mb-4 h-5 w-5 text-[#b87731]" />
                  <div className="text-lg font-medium text-slate-900">内容页</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">继续浏览博客和图文。</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/resources')}
                  className="rounded-[26px] border border-white/80 bg-white/82 px-5 py-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <Images className="mb-4 h-5 w-5 text-sky-500" />
                  <div className="text-lg font-medium text-slate-900">资源页</div>
                  <div className="mt-2 text-sm leading-7 text-slate-500">去看完整的资源列表。</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/creators')}
                  className="rounded-[26px] border border-white/80 bg-white/82 px-5 py-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <SquareChartGantt className="mb-4 h-5 w-5 text-emerald-500" />
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
