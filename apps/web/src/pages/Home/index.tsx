import { ArrowRight, BookOpen, Download, Images, Search, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getPosts, type Post } from '@/api/blog';
import {
  favoriteResource,
  getAllResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import { BlogFeedCard } from '@/components/blog/BlogFeedCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
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
  const { isAuthenticated } = useAuthStore();
  const [wallpaperResources, setWallpaperResources] = useState<Resource[]>([]);
  const [avatarResources, setAvatarResources] = useState<Resource[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [postTotal, setPostTotal] = useState(0);
  const [creatorCode, setCreatorCode] = useState('');
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [githubProfile, setGithubProfile] = useState<GithubProfile | null>(null);
  const [loadingGithubProfile, setLoadingGithubProfile] = useState(true);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

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

    fetch(`https://api.github.com/users/your-github-username`, {
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
    <div className="relative min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-10">
        <Card className="overflow-hidden border-border/50">
          <CardContent className="relative p-6 sm:p-8 md:p-10">
            <div className="pointer-events-none absolute -right-20 top-8 h-72 w-72 rounded-full bg-gradient-to-br from-accent/30 to-secondary/20 opacity-75 blur-xl animate-[spin_26s_linear_infinite]" />
            <div className="pointer-events-none absolute -bottom-14 -left-12 h-64 w-64 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 opacity-75 blur-xl animate-[spin_20s_linear_infinite_reverse]" />

            <div className="relative grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-start">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-4 py-1.5 text-[11px] tracking-[0.18em] text-primary uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  Valley Project
                </div>
                <HomeEnergyCore />

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button size="lg" onClick={() => navigate('/blog')}>
                    立即浏览内容
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('/resources')}>
                    查看资源精选
                  </Button>
                  {isAuthenticated && (
                    <Button size="lg" variant="outline" onClick={() => navigate('/my-space')}>
                      进入创作空间
                    </Button>
                  )}
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
                </div>

                <Card className="border-border/50">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={creatorCode}
                        onChange={(event) => setCreatorCode(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') handleSearchCreator();
                        }}
                        placeholder="输入创作者口令"
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={handleSearchCreator}>查看创作者</Button>
                  </CardContent>
                </Card>

                <div className="grid gap-3 md:grid-cols-3">
                  <HeroStat
                    label="内容入口持续更新"
                    value={loadingPosts ? '...' : `${postTotal}+`}
                    accent="bg-accent/72"
                  />
                  <HeroStat
                    label="可浏览资源数量"
                    value={loadingResources ? '...' : `${resourceTotal}+`}
                    accent="bg-secondary/72"
                  />
                  <HeroStat
                    label="活跃创作者"
                    value={loadingPosts ? '...' : '持续增长'}
                    accent="bg-primary"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                  <Card className="border-border/50">
                    <CardContent className="p-5">
                      <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        信号总览
                      </div>
                      <div className="grid gap-3 mt-4 sm:grid-cols-[1.12fr_0.88fr]">
                        <Card className="border-border/50">
                          <CardContent className="p-4">
                            <div className="text-xs tracking-[0.18em] text-primary uppercase">
                              Pulse
                            </div>
                            <div className="mt-2 text-sm font-medium text-foreground">
                              内容、资源入口同步刷新，浏览路径更短，焦点更直接。
                            </div>
                          </CardContent>
                        </Card>
                        <div className="grid gap-3">
                          <Card className="border-border/50">
                            <CardContent className="p-4">
                              <div className="text-xs tracking-[0.12em] text-primary">最新标题</div>
                              <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                                {featuredPost ? featuredPost.title : '下一篇内容正在路上'}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-border/50">
                            <CardContent className="p-4">
                              <div className="text-xs tracking-[0.12em] text-primary">当前资源</div>
                              <div className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
                                {featuredWallpaper ? featuredWallpaper.title : '资源正在持续补充'}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-3">
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="text-xs tracking-[0.18em] text-primary uppercase">
                          Live Flow
                        </div>
                        <div className="mt-2 text-sm font-medium text-foreground">
                          更新、收藏、归档正在持续流动。
                        </div>
                      </CardContent>
                    </Card>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="border-border/50">
                        <CardContent className="p-4">
                          <div className="text-xs tracking-[0.12em] text-primary">浏览入口</div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            博客、图文、资源
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4">
                          <div className="text-xs tracking-[0.12em] text-primary">创作节奏</div>
                          <div className="mt-1 text-sm font-medium text-foreground">
                            保持连续更新
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <HomeAuthorProfileCard
                  loadingGithubProfile={loadingGithubProfile}
                  githubProfile={githubProfile}
                />
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-xs text-primary">
                        <Images className="h-3.5 w-3.5" />
                        快速通道
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <QuickEntryCard
                        icon={<Images className="h-4 w-4 text-primary" />}
                        title="资源整理"
                        description="资源浏览与收藏入口。"
                        onClick={() => navigate('/resources')}
                        tone="secondary"
                      />
                      <QuickEntryCard
                        icon={<BookOpen className="h-4 w-4 text-primary" />}
                        title="博客与图文"
                        description="最近更新的内容都在这里。"
                        onClick={() => navigate('/blog')}
                        tone="primary"
                      />
                      {isAuthenticated && (
                        <QuickEntryCard
                          icon={<UserRound className="h-4 w-4 text-primary" />}
                          title="创作空间"
                          description="继续整理和管理自己的内容。"
                          onClick={() => navigate('/my-space')}
                          tone="tertiary"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="mt-10">
          <SectionHeading
            eyebrow="RESOURCES"
            title="资源精选"
            description="最近整理出的壁纸和头像会在这里集中展示，并支持直接收藏。"
            action={
              <Button variant="outline" onClick={() => navigate('/resources')}>
                进入资源页
              </Button>
            }
          />
          <Card className="border-border/50">
            <CardContent className="p-4 sm:p-6">
              {loadingResources ? (
                <div className="grid gap-4 lg:grid-cols-[1.5fr_0.74fr]">
                  <div className="space-y-4">
                    <Skeleton className="h-[280px] rounded-xl" />
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <Skeleton key={index} className="h-[148px] rounded-xl" />
                      ))}
                    </div>
                  </div>
                  <Skeleton className="h-[360px] rounded-xl" />
                </div>
              ) : resources.length > 0 ? (
                <div className="grid gap-5 lg:grid-cols-[1.54fr_0.72fr]">
                  <div className="space-y-5">
                    {featuredWallpaper && (
                      <button
                        type="button"
                        onClick={() => navigate(`/resource/${featuredWallpaper.id}`)}
                        className="group block w-full overflow-hidden rounded-xl border border-border bg-card text-left transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="relative h-[260px] overflow-hidden bg-muted sm:h-[336px]">
                          <img
                            src={featuredWallpaper.thumbnailUrl ?? featuredWallpaper.url}
                            alt={featuredWallpaper.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--color-background)/0.72)] via-[hsl(var(--color-background)/0.2)] to-transparent" />
                          <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
                            热门壁纸
                          </div>
                          <div className="absolute right-5 top-5">
                            <ResourceFavoriteButton
                              active={favoritedMap[featuredWallpaper.id] ?? false}
                              onClick={(event) => handleFavoriteResource(event, featuredWallpaper)}
                              size="md"
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 text-foreground">
                            <div className="text-2xl font-semibold leading-tight sm:text-[30px]">
                              {featuredWallpaper.title}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                              <span>{featuredWallpaper.creatorName}</span>
                              <span className="inline-flex items-center gap-1">
                                <Download className="h-3.5 w-3.5" />
                                {featuredWallpaper.downloadCount} 次下载
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )}
                    {wallpaperRail.length > 0 && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {wallpaperRail.slice(0, 2).map((resource) => (
                          <button
                            key={resource.id}
                            type="button"
                            onClick={() => navigate(`/resource/${resource.id}`)}
                            className="group overflow-hidden rounded-xl border border-border bg-card text-left transition hover:-translate-y-1 hover:shadow-lg"
                          >
                            <div className="relative h-44 overflow-hidden bg-muted">
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
                              <div className="line-clamp-1 text-base font-medium text-foreground">
                                {resource.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {resource.creatorName}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Card className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">头像资源</h3>
                          <p className="text-sm text-muted-foreground mt-1">最近整理的头像内容。</p>
                        </div>
                        <span className="rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
                          {avatarShelf.length} 项
                        </span>
                      </div>
                      {avatarShelf.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {avatarShelf.map((resource) => (
                            <button
                              key={resource.id}
                              type="button"
                              onClick={() => navigate(`/resource/${resource.id}`)}
                              className="group overflow-hidden rounded-xl border border-border bg-accent/30 text-left transition hover:-translate-y-0.5"
                            >
                              <div className="relative px-4 pb-3 pt-4">
                                <div className="absolute right-3 top-3">
                                  <ResourceFavoriteButton
                                    active={favoritedMap[resource.id] ?? false}
                                    onClick={(event) => handleFavoriteResource(event, resource)}
                                    size="sm"
                                  />
                                </div>
                                <div className="mx-auto h-24 w-24 overflow-hidden rounded-xl border border-border bg-card">
                                  <img
                                    src={resource.thumbnailUrl ?? resource.url}
                                    alt={resource.title}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1 px-4 pb-4 text-center">
                                <div className="line-clamp-1 text-sm font-medium text-foreground">
                                  {resource.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {resource.downloadCount} 次下载
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-accent/50 px-4 py-8 text-center text-sm text-muted-foreground">
                          当前资源里还没有头像内容。
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <EmptyPanel
                  title="还没有可展示的资源"
                  description={
                    isAuthenticated
                      ? '你可以先上传壁纸或头像资源，完成整理后会优先展示在首页资源区。'
                      : '当前首页资源位暂时为空，你可以先去资源页浏览全部内容。'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate('/resources')}>
                        去看资源页
                      </Button>
                      {isAuthenticated && (
                        <Button variant="outline" onClick={() => navigate('/my-space/resources')}>
                          去上传我的资源
                        </Button>
                      )}
                    </div>
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>

        <HomeLabSection />

        <section className="mt-10">
          <SectionHeading
            eyebrow="UPDATES"
            title="内容更新"
            description="最新发布的博客和图文会优先在这里显示，保持浏览节奏不断档。"
            action={
              <Button variant="outline" onClick={() => navigate('/blog')}>
                去看内容页
              </Button>
            }
          />
          <Card className="border-border/50">
            <CardContent className="p-4 sm:p-6">
              {loadingPosts ? (
                <div className="grid gap-5 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-[420px] rounded-xl" />
                  ))}
                </div>
              ) : posts.length > 0 ? (
                <div className="grid gap-5 xl:grid-cols-3">
                  {posts.slice(0, 3).map((post) => (
                    <div key={post.id} className="rounded-xl bg-card/68 p-2">
                      <BlogFeedCard post={post} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="还没有可展示的内容更新"
                  description={
                    isAuthenticated
                      ? '发布博客或图文后，这里会优先展示你的最新更新，方便用户持续回访。'
                      : '当前没有新的首页推荐内容，你可以先去内容页浏览历史更新。'
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button variant="outline" onClick={() => navigate('/blog')}>
                        去看内容页
                      </Button>
                      {isAuthenticated && (
                        <Button variant="outline" onClick={() => navigate('/my-space/blog-create')}>
                          去发布新内容
                        </Button>
                      )}
                    </div>
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-10">
          <Card className="border-border/50">
            <CardContent className="p-6 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
                    <UserRound className="h-3.5 w-3.5" />
                    下一步
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
                    内容、资源入口
                    <br />
                    从这里继续展开。
                  </h3>
                  <p className="max-w-xl text-sm leading-8 text-muted-foreground md:text-base">
                    你可以继续看内容更新、深入资源库，或进入创作空间查看完整作品脉络。
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
                    className="rounded-xl border border-border bg-card px-5 py-6 text-left transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/50 text-primary mb-4">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-medium text-foreground">内容页</div>
                    <div className="mt-2 text-sm text-muted-foreground">继续浏览博客和图文。</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/resources')}
                    className="rounded-xl border border-border bg-card px-5 py-6 text-left transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/50 text-primary mb-4">
                      <Images className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-medium text-foreground">资源页</div>
                    <div className="mt-2 text-sm text-muted-foreground">去看完整的资源列表。</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/creators')}
                    className="rounded-xl border border-border bg-card px-5 py-6 text-left transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent/50 text-primary mb-4">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="text-lg font-medium text-foreground">创作者页</div>
                    <div className="mt-2 text-sm text-muted-foreground">看看最近活跃的创作者。</div>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
