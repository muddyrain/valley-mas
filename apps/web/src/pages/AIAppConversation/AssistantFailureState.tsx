import { CircleAlert } from 'lucide-react';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';

export function AssistantFailureState({
  agentName,
  avatarUrl,
  cancelled,
  message,
}: {
  agentName: string;
  avatarUrl?: string;
  cancelled: boolean;
  message: string;
}) {
  return (
    <div className="flex items-start gap-3" role="status">
      <AgentAvatar name={agentName} src={avatarUrl} />
      <div className="max-w-[min(85%,42rem)] rounded-lg border border-border bg-muted/35 px-3 py-2 text-sm text-foreground">
        <div className="flex items-center gap-2 font-medium">
          <CircleAlert className="size-4 text-muted-foreground" aria-hidden="true" />
          <span>{cancelled ? '已停止' : '暂时未完成'}</span>
        </div>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
