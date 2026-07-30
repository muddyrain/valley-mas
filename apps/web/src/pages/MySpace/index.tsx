import {
  ArrowUpRight,
  BookOpen,
  Bot,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyStats, type UserStats } from '@/api/auth';
import { type Post as BlogPost, getAdminPosts } from '@/api/blog';
import { getMyResources, type MyResource } from '@/api/resource';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const quickActions = [
  {
    icon: BookOpen,
    title: '博客管理',
    description: '管理和发布博客文章',
    href: '/my-space/posts',
  },
  {
    icon: ImageIcon,
    title: '资源管理',
    description: '上传和管理图像资源',
    href: '/my-space/resources',
  },
  {
    icon: MessageSquare,
    title: '评论管理',
    description: '查看和回复评论',
    href: '/my-space/posts',
  },
];

const creationTools = [
  {
    icon: Bot,
    title: 'AI 工作流',
    description: '编排内容生成流程',
    href: '/workbench',
  },
  {
    icon: ImageIcon,
    title: 'AI 图片',
    description: '生成和编辑图像',
    href: '/workbench/images',
  },
  {
    icon: FolderOpen,
    title: 'AI 资源',
    description: '整理生成素材',
    href: '/workbench/resources',
  },
];

export default function MySpace() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const [recentResources, setRecentResources] = useState<MyResource[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  useEffect(() => {
    getMyStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      getAdminPosts({ page: 1, pageSize: 2, postType: 'blog' }),
      getMyResources({ page: 1, pageSize: 2 }),
    ])
      .then(([postData, resourceData]) => {
        if (!active) return;
        setRecentPosts(postData.list);
        setRecentResources(resourceData.list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRecentLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const overviewCards = [
    {
      icon: BookOpen,
      label: '博客',
      value: stats?.blogCount ?? 0,
      href: '/my-space/posts',
    },
    {
      icon: ImageIcon,
      label: '资源',
      value: stats?.resourceCount ?? 0,
      href: '/my-space/resources',
    },
    {
      icon: Users,
      label: '关注者',
      value: stats?.followerCount ?? 0,
      href: '/follows',
    },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="border-border/50 w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">需要登录</h2>
            <p className="text-muted-foreground mb-6">请先登录以访问我的空间</p>
            <Button onClick={() => navigate('/login')}>前往登录</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 sm:px-6 md:px-8 lg:px-10">
        <Card className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <LayoutDashboard className="h-3.5 w-3.5" />
                MY SPACE
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
                <Settings className="mr-1.5 h-4 w-4" />
                设置
              </Button>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-border shadow-sm">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <User className="h-7 w-7" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      {user.nickname || user.username}
                    </h1>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {profile?.email || '未绑定邮箱'}
                    </p>
                  </div>
                </div>
                <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
                  这里是你的个人管理中心，可以管理博客、资源、评论和个人设置。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {overviewCards.map((card) => (
                  <Link
                    key={card.label}
                    to={card.href}
                    className="group min-w-24 rounded-xl border border-border bg-muted/40 p-3 text-center transition-colors duration-200 hover:border-foreground/25 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <card.icon className="mx-auto h-4 w-4 text-muted-foreground transition-colors duration-200 group-hover:text-foreground" />
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                      {card.value}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{card.label}</div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">快捷操作</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="group relative flex min-h-38 flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-colors duration-200 group-hover:bg-foreground group-hover:text-background">
                    <action.icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <div className="mt-auto pt-6">
                  <h3 className="text-base font-semibold text-foreground">{action.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">继续创作</h2>
                  <p className="mt-1 text-sm text-muted-foreground">选择一个工具开始新的内容</p>
                </div>
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="mt-5 space-y-2">
                {creationTools.map((tool) => (
                  <Link
                    key={tool.title}
                    to={tool.href}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-muted/35 p-3 transition-colors duration-200 hover:border-foreground/25 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border">
                      <tool.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{tool.title}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {tool.description}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">最近产出</h2>
                  <p className="mt-1 text-sm text-muted-foreground">最近更新的内容与素材</p>
                </div>
                <Link
                  to="/my-space/posts"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  查看全部
                </Link>
              </div>

              {recentLoading ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Skeleton className="h-28 rounded-xl" />
                  <Skeleton className="h-28 rounded-xl" />
                </div>
              ) : recentPosts.length > 0 || recentResources.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {recentPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.id}`}
                      state={{
                        returnTo: '/my-space',
                        returnLabel: '返回我的空间',
                        source: 'my-space',
                      }}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative h-28 overflow-hidden bg-muted">
                        {post.cover ? (
                          <img
                            src={post.cover}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <BookOpen className="h-5 w-5" />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                          博客
                        </span>
                      </div>
                      <div className="min-w-0 p-3">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {post.title}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {recentResources.map((resource) => (
                    <Link
                      key={resource.id}
                      to={`/resource/${resource.id}`}
                      state={{
                        returnTo: '/my-space',
                        returnLabel: '返回我的空间',
                        source: 'my-space',
                      }}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="relative h-28 overflow-hidden bg-muted">
                        <img
                          src={resource.thumbnailUrl || resource.url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <span className="absolute left-2 top-2 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
                          资源
                        </span>
                      </div>
                      <div className="min-w-0 p-3">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {resource.title}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 text-sm text-muted-foreground">
                  暂无近期创作
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
