import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface PersonalPageHeaderProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}

export default function PersonalPageHeader({
  icon: Icon,
  iconClassName,
  title,
  description,
  actions,
}: PersonalPageHeaderProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
      <Card className="rounded-2xl border border-border bg-card shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className={`h-5 w-5 text-foreground ${iconClassName ?? ''}`} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
