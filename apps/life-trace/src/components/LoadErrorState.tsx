import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type LoadErrorStateProps = {
  title?: string;
  description?: string;
  error: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
};

export function LoadErrorState({
  title = '加载失败',
  description = '这次从云端取数据没有成功，你可以直接再试一次。',
  error,
  onRetry,
  retrying = false,
  className,
}: LoadErrorStateProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-life-alert/20 bg-life-alert/10 p-4 text-sm shadow-sm',
        className,
      )}
    >
      <div className="absolute inset-x-5 top-0 h-px bg-life-alert" />
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-life-alert/20 bg-life-alert/10 text-life-alert shadow-[0_14px_34px_rgba(249,115,22,0.14)]">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="mt-3 rounded-2xl border border-life-alert/15 bg-background/35 px-3 py-2 text-sm leading-6 text-life-alert">
            {error}
          </p>
          <div className="mt-4">
            <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
              <RotateCcw
                className={cn('size-4', retrying && 'animate-spin motion-reduce:animate-none')}
              />
              {retrying ? '重试中...' : '重新加载'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
