import { CircleAlert } from 'lucide-react';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import { Button } from '@/components/ui/button';

export function AssistantFailureState({
  agentName,
  avatarUrl,
  cancelled,
  message,
  showAvatar = true,
  onRetry,
  retrying = false,
}: {
  agentName: string;
  avatarUrl?: string;
  cancelled: boolean;
  message: string;
  showAvatar?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3" role="status">
      {showAvatar ? <AgentAvatar name={agentName} src={avatarUrl} /> : null}
      <div className="w-full max-w-[50rem] rounded-xl bg-destructive/5 px-4 py-3 text-sm text-foreground ring-1 ring-destructive/15">
        <div className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
          <span>{cancelled ? '已停止' : '暂时未完成'}</span>
        </div>
        <p className="mt-1.5 leading-6 text-muted-foreground text-pretty">{message}</p>
        {!cancelled && onRetry ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? '重试中…' : '重试'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
