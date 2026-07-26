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

const FALLBACK_AUTHOR_PROFILE: GithubProfile = {
  login: 'muddyrain',
  name: 'muddyrain',
  bio: null,
  avatar_url: 'https://github.com/muddyrain.png?size=160',
  html_url: 'https://github.com/muddyrain',
};

interface HomeAuthorProfileCardProps {
  loadingGithubProfile: boolean;
  githubProfile: GithubProfile | null;
}

export default function HomeAuthorProfileCard({
  loadingGithubProfile,
  githubProfile,
}: HomeAuthorProfileCardProps) {
  const authorProfile = githubProfile || FALLBACK_AUTHOR_PROFILE;

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-primary">
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
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-border bg-card">
                <img
                  src={authorProfile.avatar_url}
                  alt={authorProfile.login}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-xl font-semibold text-foreground">
                  {authorProfile.name || authorProfile.login}
                </div>
                <a
                  href={authorProfile.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  @{authorProfile.login}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm leading-7 text-muted-foreground">
                  {authorProfile.bio || 'GitHub: @muddyrain'}
                </p>
              </CardContent>
            </Card>

            <a
              href={authorProfile.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-4 py-2 text-sm text-primary transition hover:bg-accent"
            >
              访问 GitHub 主页
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
