import { Bot, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';

export type AssistantMessageCardMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AssistantMessageCardProps = {
  message: AssistantMessageCardMessage;
  meta?: string;
  streaming?: boolean;
};

export function AssistantMessageCard({
  message,
  meta,
  streaming = false,
}: AssistantMessageCardProps) {
  const isUser = message.role === 'user';
  const Icon = isUser ? UserRound : Bot;

  return (
    <Card
      className={`p-4 ${isUser ? 'border-border bg-card/80' : 'border-life-ai/20 bg-life-ai/5'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            isUser ? 'bg-secondary text-foreground' : 'bg-life-ai/15 text-life-ai'
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted-foreground">
              {isUser ? '你' : 'Life Trace 生活助理'}
            </p>
            {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {message.content || (streaming ? '正在结合今日状态整理安排...' : '暂无回复')}
            {!isUser && streaming ? (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-life-ai align-[-2px]" />
            ) : null}
          </p>
        </div>
      </div>
    </Card>
  );
}
