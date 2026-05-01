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
import HomeLabSection from './components/HomeLabSection';
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
  const [creatorTotal, setCreatorTotal] = useState(0);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [postTotal, setPostTotal] = useState(0);
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
        setCreatorTotal(data.total ?? data.list?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setCreators([]);
          setCreatorTotal(0);
        }
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
      getAllResources({ page: 1, pageSize: 1 }).catch(() => ({
        list: [] as Resource[],
        total: 0,
      })),
    ])
      .then(([wallpaperData, avatarData, allResourceData]) => {
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
        const fallbackResourceTotal =
          (wallpaperData.total ?? 0) + (avatarData.total ?? 0) ||
          mergedWallpaper.length + avatars.length;

        setWallpaperResources(mergedWallpaper);
        setAvatarResources(avatars);
        setResourceTotal(allResourceData.total > 0 ? allResourceData.total : fallbackResourceTotal);

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
          setResourceTotal(0);
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
        setPostTotal(data.total ?? data.list?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setPostTotal(0);
        }
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

      <div className="relative mx-auto w-full max-w-7xl px-0 pb-16 pt-4 sm:px-6 md:px-8 md:pb-20 md:pt-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden border-x-0 px-4 py-6 sm:rounded-[30px] sm:border sm:px-6 md:rounded-[42px] md:px-10 md:py-10">
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
              <div className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white/88 px-4 py-1.5 text-[11px] tracking-[0.18em] text-theme-primary uppercase shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur sm:text-xs sm:tracking-[0.24em]">
                <Sparkles className="h-3.5 w-3.5" />
                Valley Project
              </div>
              <HomeEnergyCore />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  size="lg"
                  className="theme-btn-primary w-full rounded-full px-7 text-white sm:w-auto"
                  onClick={() => navigate('/blog')}
                >
                  立即浏览内容
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-theme-shell-border w-full rounded-full border bg-white/78 px-7 text-slate-700 shadow-[0_12px_30px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/92 hover:shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.18)] sm:w-auto"
                  onClick={() => navigate('/resources')}
                >
                  查看资源精选
                </Button>
                {isCreator ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-theme-shell-border w-full rounded-full border bg-white/78 px-7 text-slate-700 shadow-[0_12px_30px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white hover:bg-white/92 hover:shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.18)] sm:w-auto"
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
                  value={loadingCreators ? '内容持续更新中' : `${creatorTotal}+ 位展示中`}
                />
              </div>
              <div className="group relative overflow-hidden rounded-[28px] border border-white/82 bg-[linear-gradient(140deg,rgba(255,255,255,0.88),rgba(255,255,255,0.76))] p-3 shadow-[0_16px_40px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur-md">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,0.46)_52%,transparent_82%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
                      className="h-12 rounded-full border-white/85 bg-white/66 pl-10 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm"
                    />
                  </div>
                  <Button
                    size="lg"
                    className="h-12 w-full rounded-full bg-theme-primary px-6 text-white shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.28)] transition duration-300 hover:-translate-y-0.5 hover:bg-theme-primary-hover hover:shadow-[0_18px_38px_rgba(var(--theme-primary-rgb),0.34)] sm:w-auto"
                    onClick={handleSearchCreator}
                  >
                    查看创作者
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <HeroStat
                  label="内容入口持续更新"
                  value={loadingPosts ? '...' : `${postTotal}+`}
                  accent="bg-[rgba(var(--theme-tertiary-rgb),0.72)]"
                />
                <HeroStat
                  label="可浏览资源数量"
                  value={loadingResources ? '...' : `${resourceTotal}+`}
                  accent="bg-[rgba(var(--theme-secondary-rgb),0.72)]"
                />
                <HeroStat
                  label="展示中的创作者"
                  value={loadingCreators ? '...' : `${creatorTotal}+`}
                  accent="bg-theme-primary"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="group relative overflow-hidden rounded-[30px] border border-white/80 bg-[linear-gradient(138deg,rgba(255,255,255,0.95),rgba(var(--theme-primary-rgb),0.14),rgba(var(--theme-secondary-rgb),0.12))] p-5 shadow-[0_18px_44px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-md">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.58),transparent_38%),radial-gradient(circle_at_86%_82%,rgba(var(--theme-secondary-rgb),0.14),transparent_42%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent_12%,rgba(255,255,255,0.48)_52%,transparent_88%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                    <Sparkles className="text-theme-primary h-3.5 w-3.5" />
                    信号总览
                  </div>
                  <div className="relative mt-4 grid gap-3 sm:grid-cols-[1.12fr_0.88fr]">
                    <div className="group/summary relative rounded-[26px] border border-theme-shell-border bg-[linear-gradient(145deg,rgba(255,255,255,0.96),color-mix(in_srgb,var(--theme-primary-soft)_66%,white))] p-5 shadow-[0_14px_36px_rgba(var(--theme-primary-rgb),0.14)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(var(--theme-primary-rgb),0.2)]">
                      <div className="pointer-events-none absolute inset-x-8 top-0 h-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)]" />
                      <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                        Pulse
                      </div>
                      <div className="mt-3 text-lg font-medium leading-8 text-slate-900">
                        内容、资源、创作者入口同步刷新，浏览路径更短，焦点更直接。
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="rounded-[22px] border border-white/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.9),rgba(255,255,255,0.78))] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(var(--theme-primary-rgb),0.16)]">
                        <div className="text-theme-primary text-xs tracking-[0.12em]">最新标题</div>
                        <div className="mt-2 line-clamp-2 text-base font-medium leading-7 text-slate-900">
                          {featuredPost ? featuredPost.title : '下一篇内容正在路上'}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-[linear-gradient(140deg,rgba(255,255,255,0.9),rgba(255,255,255,0.78))] p-4 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(var(--theme-primary-rgb),0.16)]">
                        <div className="text-theme-primary text-xs tracking-[0.12em]">当前资源</div>
                        <div className="mt-2 line-clamp-2 text-base font-medium leading-7 text-slate-900">
                          {featuredWallpaper ? featuredWallpaper.title : '资源正在持续补充'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="group/flow relative overflow-hidden rounded-[24px] border border-theme-shell-border bg-[linear-gradient(135deg,rgba(255,255,255,0.92),color-mix(in_srgb,var(--theme-primary-soft)_52%,white))] px-4 py-4 shadow-[0_16px_36px_rgba(var(--theme-primary-rgb),0.1)] backdrop-blur-sm">
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.42)_52%,transparent_84%)] opacity-0 transition-opacity duration-700 group-hover/flow:opacity-100" />
                    <div className="text-theme-primary text-xs tracking-[0.18em] uppercase">
                      Live Flow
                    </div>
                    <div className="mt-2 text-lg font-medium leading-8 text-slate-900">
                      更新、收藏、归档正在持续流动。
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/75 bg-[linear-gradient(140deg,rgba(255,255,255,0.88),rgba(255,255,255,0.74))] px-4 py-4 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(var(--theme-primary-rgb),0.16)]">
                      <div className="text-theme-primary text-xs tracking-[0.12em]">浏览入口</div>
                      <div className="mt-2 text-sm font-medium text-slate-900">
                        博客、图文、资源
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/75 bg-[linear-gradient(140deg,rgba(255,255,255,0.88),rgba(255,255,255,0.74))] px-4 py-4 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(var(--theme-primary-rgb),0.16)]">
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

        <section className="mt-20 px-4 sm:mt-24 sm:px-0">
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
          <div className="theme-section-shell relative overflow-hidden rounded-[30px] border p-4 sm:rounded-[38px] sm:p-5 md:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_2%_6%,rgba(var(--theme-tertiary-rgb),0.14),transparent_32%),radial-gradient(circle_at_96%_20%,rgba(var(--theme-secondary-rgb),0.12),transparent_30%)]" />
            <div className="relative mb-5 flex flex-col gap-3 rounded-[28px] border border-white/88 bg-white/76 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">活跃创作者</div>
                <div className="mt-1 text-sm text-slate-500">
                  优先显示近期有更新的创作者主页入口。
                </div>
              </div>
              <div className="bg-theme-soft text-theme-primary w-fit rounded-full px-4 py-2 text-sm">
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
                description={
                  isCreator
                    ? '你可以先完善创作者主页与内容，系统会在活跃度提升后优先推荐你的入口。'
                    : '当前还没有进入推荐位的创作者，先去创作者页浏览全部创作者，或申请成为创作者。'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/80 px-5"
                      onClick={() => navigate('/creators')}
                    >
                      查看创作者页
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/80 px-5"
                      onClick={() => navigate(isCreator ? '/my-space' : '/apply-creator')}
                    >
                      {isCreator ? '去完善创作空间' : '申请成为创作者'}
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </section>

        <section className="mt-20 px-4 sm:mt-24 sm:px-0">
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
          <div className="theme-section-shell rounded-[30px] border p-4 sm:rounded-[38px] sm:p-5 md:p-6">
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
                      <div className="relative h-[260px] overflow-hidden bg-slate-100 sm:h-[336px]">
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
                          <div className="text-2xl font-semibold leading-tight sm:text-[30px]">
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
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">头像资源</div>
                      <div className="mt-1 text-sm text-slate-500">最近整理的头像内容。</div>
                    </div>
                    <div className="bg-theme-soft text-theme-primary w-fit rounded-full px-3 py-1 text-xs">
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
                description={
                  isCreator
                    ? '你可以先上传壁纸或头像资源，完成整理后会优先展示在首页资源区。'
                    : '当前首页资源位暂时为空，你可以先去资源页浏览全部内容，或关注创作者后继续回看更新。'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/85 px-5"
                      onClick={() => navigate('/resources')}
                    >
                      去看资源页
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/85 px-5"
                      onClick={() => navigate(isCreator ? '/my-space/resources' : '/creators')}
                    >
                      {isCreator ? '去上传我的资源' : '去看创作者页'}
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </section>

        <HomeLabSection />

        <section className="mt-20 px-4 sm:mt-24 sm:px-0">
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
          <div className="theme-section-shell rounded-[30px] border p-4 sm:rounded-[38px] sm:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 rounded-[28px] border border-white/88 bg-white/76 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">动态</div>
                <div className="mt-1 text-sm text-slate-500">博客与图文的最新发布。</div>
              </div>
              <div className="bg-theme-soft text-theme-primary w-fit rounded-full px-4 py-2 text-sm">
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
                description={
                  isCreator
                    ? '发布博客或图文后，这里会优先展示你的最新更新，方便用户持续回访。'
                    : '当前没有新的首页推荐内容，你可以先去内容页浏览历史更新，或关注创作者获取后续动态。'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/80 px-5"
                      onClick={() => navigate('/blog')}
                    >
                      去看内容页
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-theme-shell-border bg-white/80 px-5"
                      onClick={() => navigate(isCreator ? '/my-space/blog-create' : '/creators')}
                    >
                      {isCreator ? '去发布新内容' : '去看创作者更新'}
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </section>

        <section className="mt-20 px-4 sm:mt-24 sm:px-0">
          <div className="theme-panel-shell relative overflow-hidden rounded-[30px] border p-4 sm:rounded-[32px] sm:p-6 md:rounded-[40px] md:p-10">
            <div className="pointer-events-none absolute -right-56 -top-44 hidden h-80 w-80 rounded-full border border-white/30 bg-[conic-gradient(from_0deg,rgba(var(--theme-secondary-rgb),0.18),rgba(var(--theme-tertiary-rgb),0.14),rgba(var(--theme-primary-rgb),0.18),rgba(var(--theme-secondary-rgb),0.18))] opacity-60 blur-[1px] xl:block" />
            <div className="pointer-events-none absolute -left-24 -bottom-24 hidden h-56 w-56 rounded-full border border-white/30 bg-[conic-gradient(from_0deg,rgba(var(--theme-primary-rgb),0.22),rgba(var(--theme-tertiary-rgb),0.16),rgba(var(--theme-primary-rgb),0.22))] opacity-60 blur-[1px] xl:block" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">
                  <UserRound className="text-theme-primary h-3.5 w-3.5" />
                  下一步
                </div>
                <h3 className="text-[28px] font-semibold tracking-tight text-slate-950 sm:text-3xl md:text-[40px]">
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
