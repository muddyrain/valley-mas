import { ArrowRight, BookOpen, Download, Images, Sparkles, UserRound } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';
import HomeAuthorProfileCard, { type GithubProfile } from './components/HomeAuthorProfileCard';
import HomeLabSection from './components/HomeLabSection';
import {
  EmptyPanel,
  HeroRibbon,
  HeroStat,
  ResourceFavoriteButton,
  ResourcePreviewLink,
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

  const handleFavoriteResource = async (resource: Resource) => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-10">
        {/* Hero */}
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <Badge variant="outline" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Valley Project
            </Badge>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                首页已整理好常用浏览路径
              </h1>
              <p className="mt-3 max-w-xl text-muted-foreground">
                从这里开始浏览，内容更新与精选入口都已为你准备好。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" onClick={() => navigate('/blog')}>
                立即浏览内容
                <ArrowRight className="ml-2 h-4 w-4" />
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

            <div className="grid gap-3 md:grid-cols-3">
              <HeroStat label="内容入口持续更新" value={loadingPosts ? '...' : `${postTotal}+`} />
              <HeroStat
                label="可浏览资源数量"
                value={loadingResources ? '...' : `${resourceTotal}+`}
              />
            </div>
          </div>

          <div className="grid gap-4">
            <HomeAuthorProfileCard
              loadingGithubProfile={loadingGithubProfile}
              githubProfile={githubProfile}
            />
          </div>
        </section>

        {/* Resources */}
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
          <Card>
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
                      <article className="group relative w-full overflow-hidden rounded-xl border border-border bg-card text-left transition hover:shadow">
                        <ResourcePreviewLink
                          resourceId={featuredWallpaper.id}
                          title={featuredWallpaper.title}
                        />
                        <div className="pointer-events-none relative z-10 h-[260px] overflow-hidden bg-muted sm:h-[336px]">
                          <img
                            src={featuredWallpaper.thumbnailUrl ?? featuredWallpaper.url}
                            alt={featuredWallpaper.title}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                          <div className="absolute left-5 top-5 inline-flex items-center rounded-full bg-card px-3 py-1 text-xs font-medium text-primary">
                            热门壁纸
                          </div>
                          <div className="pointer-events-auto absolute right-5 top-5 z-20">
                            <ResourceFavoriteButton
                              active={favoritedMap[featuredWallpaper.id] ?? false}
                              onClick={() => void handleFavoriteResource(featuredWallpaper)}
                              size="md"
                            />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-5 text-foreground">
                            <div className="text-2xl font-semibold leading-tight sm:text-[30px]">
                              {featuredWallpaper.title}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                              <span>{featuredWallpaper.userName}</span>
                              <span className="inline-flex items-center gap-1">
                                <Download className="h-3.5 w-3.5" />
                                {featuredWallpaper.downloadCount} 次下载
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    )}
                    {wallpaperRail.length > 0 && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {wallpaperRail.slice(0, 2).map((resource) => (
                          <article
                            key={resource.id}
                            className="group relative overflow-hidden rounded-xl border border-border bg-card text-left transition hover:shadow"
                          >
                            <ResourcePreviewLink resourceId={resource.id} title={resource.title} />
                            <div className="pointer-events-none relative z-10 h-44 overflow-hidden bg-muted">
                              <img
                                src={resource.thumbnailUrl ?? resource.url}
                                alt={resource.title}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                              />
                              <div className="pointer-events-auto absolute right-3 top-3 z-20">
                                <ResourceFavoriteButton
                                  active={favoritedMap[resource.id] ?? false}
                                  onClick={() => void handleFavoriteResource(resource)}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <div className="pointer-events-none relative z-10 space-y-2 p-4">
                              <div className="line-clamp-1 text-base font-medium text-foreground">
                                {resource.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {resource.userName}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                  <Card>
                    <CardContent className="p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-foreground">头像资源</h3>
                          <p className="mt-1 text-sm text-muted-foreground">最近整理的头像内容。</p>
                        </div>
                        <Badge variant="secondary">{avatarShelf.length} 项</Badge>
                      </div>
                      {avatarShelf.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {avatarShelf.map((resource) => (
                            <article
                              key={resource.id}
                              className="group relative overflow-hidden rounded-xl border border-border bg-muted text-left transition hover:shadow"
                            >
                              <ResourcePreviewLink
                                resourceId={resource.id}
                                title={resource.title}
                              />
                              <div className="pointer-events-none relative z-10 px-4 pb-3 pt-4">
                                <div className="pointer-events-auto absolute right-3 top-3 z-20">
                                  <ResourceFavoriteButton
                                    active={favoritedMap[resource.id] ?? false}
                                    onClick={() => void handleFavoriteResource(resource)}
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
                              <div className="pointer-events-none relative z-10 space-y-1 px-4 pb-4 text-center">
                                <div className="line-clamp-1 text-sm font-medium text-foreground">
                                  {resource.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {resource.downloadCount} 次下载
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
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

        {/* Lab */}
        <HomeLabSection />

        {/* Blog Updates */}
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
          <Card>
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
                    <div key={post.id} className="rounded-xl bg-card p-2">
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

        {/* Quick Navigation */}
        <section className="mt-10">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="space-y-4">
                  <Badge variant="outline" className="gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    下一步
                  </Badge>
                  <h3 className="text-2xl font-semibold text-foreground sm:text-3xl">
                    内容、资源入口，从这里继续展开。
                  </h3>
                  <p className="max-w-xl text-muted-foreground">
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
                  {[
                    {
                      icon: BookOpen,
                      title: '内容页',
                      desc: '继续浏览博客和图文。',
                      href: '/blog',
                    },
                    {
                      icon: Images,
                      title: '资源页',
                      desc: '去看完整的资源列表。',
                      href: '/resources',
                    },
                    {
                      icon: UserRound,
                      title: '个人中心',
                      desc: '管理你的账号和偏好。',
                      href: '/profile',
                    },
                  ].map((item) => (
                    <Card
                      key={item.href}
                      className="cursor-pointer transition hover:bg-accent"
                      onClick={() => navigate(item.href)}
                    >
                      <CardContent className="p-5">
                        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-primary">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.desc}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
