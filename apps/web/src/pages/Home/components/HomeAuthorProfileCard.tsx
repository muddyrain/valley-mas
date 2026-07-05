import { ArrowRight, Github } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
}

interface HomeAuthorProfileCardProps {
  loadingGithubProfile: boolean;
  githubProfile: GithubProfile | null;
}

export default function HomeAuthorProfileCard({
  loadingGithubProfile,
  githubProfile,
}: HomeAuthorProfileCardProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
            <Github className="h-3.5 w-3.5" />
            作者介绍
          </div>
          <span className="text-xs text-muted-foreground">GitHub</span>
        </div>

        {loadingGithubProfile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-36 rounded-full" />
                <Skeleton className="h-4 w-48 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : githubProfile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-border bg-card">
                <img
                  src={githubProfile.avatar_url}
                  alt={githubProfile.login}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-xl font-semibold text-foreground">
                  {githubProfile.name || githubProfile.login}
                </div>
                <a
                  href={githubProfile.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  @{githubProfile.login}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-sm leading-7 text-muted-foreground">
                  {githubProfile.bio || '你好，我是一名前端开发者，热衷于探索新技术和解决问题。'}
                </p>
              </CardContent>
            </Card>

            <a
              href={githubProfile.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/86 px-4 py-2 text-sm text-primary transition hover:bg-card"
            >
              访问 GitHub 主页
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-sm leading-7 text-muted-foreground">
                  这里会展示网站作者的 GitHub 公开资料。
                </p>
              </CardContent>
            </Card>
            <a
              href="https://github.com/muddyrain"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card/86 px-4 py-2 text-sm text-primary transition hover:bg-card"
            >
              打开 @muddyrain
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
