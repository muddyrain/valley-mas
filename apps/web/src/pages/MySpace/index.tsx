import {
  BookOpen,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/useAuthStore';

const quickActions = [
  {
    icon: BookOpen,
    title: '博客管理',
    description: '管理和发布博客文章',
    href: '/my-space/posts',
    color: 'primary',
  },
  {
    icon: ImageIcon,
    title: '资源管理',
    description: '上传和管理图像资源',
    href: '/my-space/resources',
    color: 'secondary',
  },
  {
    icon: MessageSquare,
    title: '评论管理',
    description: '查看和回复评论',
    href: '/my-space/posts',
    color: 'accent',
  },
];

export default function MySpace() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuthStore();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  useEffect(() => {
    getMyStats()
      .then(setStats)
      .catch(() => {});
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
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-10">
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-6 sm:p-8 md:p-10">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div className="space-y-6">
                <CardHeader>
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-xs text-primary mb-2">
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    MY SPACE
                  </div>
                  <CardTitle className="text-3xl md:text-4xl">我的空间</CardTitle>
                </CardHeader>
                <p className="text-sm text-muted-foreground">
                  这里是你的个人管理中心，可以管理博客、资源、评论和个人设置。
                </p>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-accent text-primary">
                        <User className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">
                        {user.nickname || user.username}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {profile?.email || '未绑定邮箱'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/profile')}
                    className="ml-auto"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    设置
                  </Button>
                </div>
              </div>

              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary mb-4">
                    <Sparkles className="h-3.5 w-3.5" />
                    快捷操作
                  </div>

                  <div className="space-y-3">
                    {quickActions.map((action) => (
                      <Link
                        key={action.title}
                        to={action.href}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm text-foreground hover:border-accent hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center">
                          <action.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{action.title}</div>
                          <div className="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 mt-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
                <FolderOpen className="h-3.5 w-3.5" />
                数据概览
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {overviewCards.map((card) => (
                <Link
                  key={card.label}
                  to={card.href}
                  className="group rounded-lg border border-border bg-card p-4 text-center hover:border-accent hover:bg-accent/50 transition-colors"
                >
                  <card.icon className="h-6 w-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-2xl font-bold text-foreground">{card.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
