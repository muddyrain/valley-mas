import {
  ArrowRight,
  BookOpen,
  Download,
  Images,
  Search,
  Sparkles,
  SquareChartGantt,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
import {
  buildContributionOverview,
  GITHUB_AUTHOR_LOGIN,
  type GithubContributionPayload,
  type GithubContributionPoint,
} from './components/githubContribution';
import HomeAuthorProfileCard, { type GithubProfile } from './components/HomeAuthorProfileCard';
import HomeEnergyCore from './components/HomeEnergyCore';
import {
  EmptyPanel,
  HeroRibbon,
  HeroStat,
  QuickEntryCard,
  ResourceFavoriteButton,
  SectionHeading,
} from './components/HomeSectionBlocks';

export default function Home() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [wallpaperResources, setWallpaperResources] = useState<Resource[]>([]);
  const [avatarResources, setAvatarResources] = useState<Resource[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [creatorCode, setCreatorCode] = useState('');
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null);
  const [loadingGithubProfile, setLoadingGithubProfile] = useState(true);
  const [githubContributions, setGithubContributions] = useState<GithubContributionPoint[]>([]);
  const [loadingGithubContributions, setLoadingGithubContributions] = useState(true);
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
    Promise.all([
      getAllResources({ page: 1, pageSize: 3, type: 'wallpaper' }).catch(() => ({
        list: [] as Resource[],
        total: 0,
      })),
      getAllResources({ page: 1, pageSize: 6, type: 'avatar' }).catch(() => ({
        list: [] as Resource[],
        total: 0,
      })),
    ])
      .then(([wallpaperData, avatarData]) => {
        if (cancelled) return;
        const wallpaperPool = [...(wallpaperData.list ?? [])];
        const seenWallpaperIds = new Set<string>();
        const mergedWallpaper = wallpaperPool
          .filter((item) => {
            if (seenWallpaperIds.has(item.id)) return false;
            seenWallpaperIds.add(item.id);
            return true;
          })
          .slice(0, 3);
        const avatars = (avatarData.list ?? []).slice(0, 6);

        setWallpaperResources(mergedWallpaper);
        setAvatarResources(avatars);

        const nextFavoritedMap: Record<string, boolean> = {};
        [...mergedWallpaper, ...avatars].forEach((item) => {
          nextFavoritedMap[item.id] = item.isFavorited ?? false;
        });
        setFavoritedMap(nextFavoritedMap);
      })
      .catch(() => {
        if (!cancelled) {
          setWallpaperResources([]);
          setAvatarResources([]);
        }
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

  useEffect(() => {
    let cancelled = false;
    setLoadingGithubProfile(true);

    fetch(`https://api.github.com/users/${GITHUB_AUTHOR_LOGIN}`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('failed');
        const data = (await response.json()) as GithubProfile;
        if (cancelled) return;
        setGithubProfile(data);
      })
      .catch(() => {
        if (!cancelled) setGithubProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingGithubProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingGithubContributions(true);

    fetch(`https://github-contributions-api.jogruber.de/v4/${GITHUB_AUTHOR_LOGIN}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('failed');
        const data = (await response.json()) as GithubContributionPayload;
        if (cancelled) return;
        setGithubContributions(Array.isArray(data.contributions) ? data.contributions : []);
      })
      .catch(() => {
        if (!cancelled) setGithubContributions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingGithubContributions(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const contributionOverview = useMemo(
    () => buildContributionOverview(githubContributions),
    [githubContributions],
  );

  const resources = useMemo(
    () => [...wallpaperResources, ...avatarResources],
    [wallpaperResources, avatarResources],
  );
  const featuredWallpaper = wallpaperResources[0] || resources[0];
  const wallpaperRail = featuredWallpaper
    ? wallpaperResources.filter((item) => item.id !== featuredWallpaper.id).slice(0, 3)
    : wallpaperResources.slice(0, 3);
  const avatarShelf = avatarResources.slice(0, 6);
  const featuredPost = posts[0];

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
    <div className="relative bg-transparent text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_16%_10%,rgba(var(--theme-tertiary-rgb),0.2),transparent_36%),radial-gradient(circle_at_84%_12%,rgba(var(--theme-secondary-rgb),0.2),transparent_34%),radial-gradient(circle_at_50%_42%,rgba(var(--theme-primary-rgb),0.1),transparent_44%)]" />
      <div className="pointer-events-none absolute -left-20 top-44 h-72 w-72 rounded-full border border-white/45 bg-white/20 blur-2xl animate-[pulse_10s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -right-24 top-72 h-80 w-80 rounded-full border border-white/45 bg-white/16 blur-2xl animate-[pulse_12s_ease-in-out_infinite]" />

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[42px] border px-6 py-8 md:px-10 md:py-10">
          <div className="pointer-events-none absolute -right-20 top-8 h-72 w-72 rounded-full border border-white/45 bg-[conic-gradient(from_140deg,rgba(var(--theme-tertiary-rgb),0.28),rgba(var(--theme-secondary-rgb),0.18),rgba(var(--theme-primary-rgb),0.24),rgba(var(--theme-tertiary-rgb),0.28))] opacity-75 blur-[1px] animate-[spin_26s_linear_infinite]" />
          <div className="pointer-events-none absolute -bottom-14 -left-12 h-64 w-64 rounded-full border border-white/45 bg-[conic-gradient(from_20deg,rgba(var(--theme-primary-rgb),0.24),rgba(var(--theme-secondary-rgb),0.16),rgba(var(--theme-primary-rgb),0.24))] opacity-75 blur-[1px] animate-[spin_20s_linear_infinite_reverse]" />
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
          <div className="relative grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-start">
            <div className="space-y-8">
              <div className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white/88 px-4 py-1.5 text-xs tracking-[0.24em] text-theme-primary uppercase shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Valley Project
              </div>
              <HomeEnergyCore />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  size="lg"
                  className="theme-btn-primary rounded-full px-7 text-white"
                  onClick={() => navigate('/blog')}
                >
                  立即浏览内容
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-theme-shell-border rounded-full border bg-white/82 px-7 text-slate-700 shadow-sm hover:bg-white"
                  onClick={() => navigate('/resources')}
                >
                  查看资源精选
                </Button>
                {isCreator ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-theme-shell-border rounded-full border bg-white/82 px-7 text-slate-700 shadow-sm hover:bg-white"
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
              <div className="rounded-[28px] border border-white/82 bg-white/82 p-3 shadow-[0_16px_40px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur">
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
                  label="内容入口持续更新"
                  value={loadingPosts ? '...' : `${posts.length}+`}
                  accent="bg-[rgba(var(--theme-tertiary-rgb),0.72)]"
                />
                <HeroStat
                  label="可浏览资源数量"
                  value={loadingResources ? '...' : `${resources.length}+`}
                  accent="bg-[rgba(var(--theme-secondary-rgb),0.72)]"
                />
                <HeroStat
                  label="展示中的创作者"
                  value={loadingCreators ? '...' : `${creators.length}+`}
                  accent="bg-theme-primary"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(138deg,rgba(255,255,255,0.95),rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-secondary-rgb),0.08))] p-5 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                    <Sparkles className="text-theme-primary h-3.5 w-3.5" />
                    信号总览
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1.12fr_0.88fr]">
                    <div className="rounded-[26px] border border-theme-shell-border bg-[linear-gradient(145deg,rgba(255,255,255,0.98),color-mix(in_srgb,var(--theme-primary-soft)_62%,white))] p-5 shadow-[0_14px_36px_rgba(var(--theme-primary-rgb),0.14)]">
                      <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                        Pulse
                      </div>
                      <div className="mt-3 text-lg font-medium leading-8 text-slate-900">
                        内容、资源、创作者入口同步刷新，浏览路径更短，焦点更直接。
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
                          {featuredWallpaper ? featuredWallpaper.title : '资源正在持续补充'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-theme-shell-border bg-[linear-gradient(135deg,rgba(255,255,255,0.92),color-mix(in_srgb,var(--theme-primary-soft)_52%,white))] px-4 py-4 shadow-[0_16px_36px_rgba(var(--theme-primary-rgb),0.1)]">
                    <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                      Live Flow
                    </div>
                    <div className="mt-2 text-lg font-medium leading-8 text-slate-900">
                      更新、收藏、归档正在持续流动。
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
                      <div className="mt-2 text-sm font-medium text-slate-900">保持连续更新</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <HomeAuthorProfileCard
                loadingGithubProfile={loadingGithubProfile}
                githubProfile={githubProfile}
                loadingGithubContributions={loadingGithubContributions}
                contributionOverview={contributionOverview}
              />
              <div className="relative overflow-hidden rounded-[34px] border border-theme-shell-border bg-[linear-gradient(155deg,rgba(255,255,255,0.96),rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-secondary-rgb),0.08),rgba(255,255,255,0.92))] p-5 shadow-[0_24px_64px_rgba(var(--theme-primary-rgb),0.16)]">
                <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[rgba(var(--theme-secondary-rgb),0.20)] blur-3xl" />
                <div className="pointer-events-none absolute -left-12 -bottom-14 h-40 w-40 rounded-full bg-[rgba(var(--theme-tertiary-rgb),0.16)] blur-3xl" />
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-xs text-slate-600 shadow-[0_8px_20px_rgba(var(--theme-primary-rgb),0.1)]">
                    <Images className="h-3.5 w-3.5 text-theme-primary" />
                    快速通道
                  </div>
                  <div className="rounded-full border border-white/75 bg-white/80 px-3 py-1 text-xs text-slate-500">
                    极速导航
                  </div>
                </div>
                <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <QuickEntryCard
                    icon={<Images className="h-4 w-4 text-theme-primary" />}
                    title="资源整理"
                    description="资源浏览与收藏入口。"
                    onClick={() => navigate('/resources')}
                    tone="secondary"
                  />
                  <QuickEntryCard
                    icon={<BookOpen className="h-4 w-4 text-theme-primary" />}
                    title="博客与图文"
                    description="最近更新的内容都在这里。"
                    onClick={() => navigate('/blog')}
                    tone="primary"
                  />
                  {isCreator ? (
                    <QuickEntryCard
                      icon={<SquareChartGantt className="h-4 w-4 text-emerald-500" />}
                      title="创作空间"
                      description="继续整理和管理自己的内容。"
                      onClick={() => navigate('/my-space')}
                      tone="tertiary"
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
            title="创作者雷达"
            description="最近活跃的创作者会优先在这里出现，方便快速进入主页继续浏览。"
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
          <div className="theme-section-shell relative overflow-hidden rounded-[38px] border p-5 md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2%_6%,rgba(var(--theme-tertiary-rgb),0.14),transparent_32%),radial-gradient(circle_at_96%_20%,rgba(var(--theme-secondary-rgb),0.12),transparent_30%)]" />
            <div className="relative mb-5 flex items-center justify-between rounded-[28px] border border-white/88 bg-white/76 px-4 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">活跃创作者</div>
                <div className="mt-1 text-sm text-slate-500">
                  优先显示近期有更新的创作者主页入口。
                </div>
              </div>
              <div className="bg-theme-soft text-theme-primary rounded-full px-4 py-2 text-sm">
                {creators.length} 位创作者
              </div>
            </div>
            {loadingCreators ? (
              <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 rounded-[28px]" />
                ))}
              </div>
            ) : creators.length > 0 ? (
              <div className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {creators.slice(0, 4).map((creator) => (
                  <div
                    key={creator.id}
                    className="rounded-[30px] bg-white/72 p-2 shadow-[0_14px_38px_rgba(var(--theme-primary-rgb),0.08)]"
                  >
                    <CreatorCard creator={creator} variant="compact" />
                  </div>
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
            title="资源风暴墙"
            description="最近整理出的壁纸和头像会在这里集中展示，并支持直接收藏。"
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
          <div className="theme-section-shell rounded-[38px] border p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-[28px] border border-white/88 bg-white/76 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">本期资源焦点</div>
                <div className="mt-1 text-sm text-slate-500">壁纸与头像的最新可浏览内容。</div>
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
                      className="group block w-full overflow-hidden rounded-[32px] border border-theme-shell-border bg-white text-left shadow-[0_22px_58px_rgba(var(--theme-primary-rgb),0.14)] transition hover:-translate-y-1 hover:shadow-[0_28px_68px_rgba(var(--theme-primary-rgb),0.22)]"
                    >
                      <div className="relative h-[336px] overflow-hidden bg-slate-100">
                        <img
                          src={featuredWallpaper.thumbnailUrl ?? featuredWallpaper.url}
                          alt={featuredWallpaper.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/72 via-black/20 to-transparent" />
                        <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-theme-primary backdrop-blur">
                          热门壁纸
                        </div>
                        <div className="absolute right-5 top-5">
                          <ResourceFavoriteButton
                            active={favoritedMap[featuredWallpaper.id] ?? false}
                            onClick={(event) => handleFavoriteResource(event, featuredWallpaper)}
                            size="md"
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
                          className="group overflow-hidden rounded-[26px] border border-theme-shell-border bg-white text-left shadow-[0_16px_40px_rgba(var(--theme-primary-rgb),0.1)] transition hover:-translate-y-1 hover:shadow-[0_22px_56px_rgba(var(--theme-primary-rgb),0.18)]"
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
                                size="sm"
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
                <div className="rounded-[32px] border border-theme-shell-border bg-white/84 p-5 shadow-[0_20px_54px_rgba(var(--theme-primary-rgb),0.12)]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">头像资源</div>
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
                                size="sm"
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
            title="内容更新信号站"
            description="最新发布的博客和图文会优先在这里显示，保持浏览节奏不断档。"
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
          <div className="theme-section-shell rounded-[38px] border p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between rounded-[28px] border border-white/88 bg-white/76 px-4 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">动态</div>
                <div className="mt-1 text-sm text-slate-500">博客与图文的最新发布。</div>
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
          <div className="theme-panel-shell relative overflow-hidden rounded-[40px] border p-8 md:p-10">
            <div className="pointer-events-none absolute -right-56 -top-44 hidden h-80 w-80 rounded-full border border-white/30 bg-[conic-gradient(from_0deg,rgba(var(--theme-secondary-rgb),0.18),rgba(var(--theme-tertiary-rgb),0.14),rgba(var(--theme-primary-rgb),0.18),rgba(var(--theme-secondary-rgb),0.18))] opacity-60 blur-[1px] xl:block" />
            <div className="pointer-events-none absolute -left-24 -bottom-24 hidden h-56 w-56 rounded-full border border-white/30 bg-[conic-gradient(from_0deg,rgba(var(--theme-primary-rgb),0.22),rgba(var(--theme-tertiary-rgb),0.16),rgba(var(--theme-primary-rgb),0.22))] opacity-60 blur-[1px] xl:block" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                  <UserRound className="text-theme-primary h-3.5 w-3.5" />
                  下一步
                </div>
                <h3 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-[40px]">
                  内容、资源与创作者入口
                  <br />
                  从这里继续展开。
                </h3>
                <p className="max-w-xl text-sm leading-8 text-slate-500 md:text-base">
                  你可以继续看内容更新、深入资源库，或进入创作者主页查看完整作品脉络。
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
