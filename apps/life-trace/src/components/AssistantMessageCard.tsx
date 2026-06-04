import { Bot, UserRound } from 'lucide-react';

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[86%] items-start gap-3 max-[420px]:max-w-[94%] ${
          isUser ? 'flex-row-reverse' : ''
        }`}
      >
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            isUser ? 'bg-life-plan/10 text-life-plan' : 'bg-life-ai/15 text-life-ai'
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div
          className={`min-w-0 rounded-[1.25rem] border px-4 py-3 ${
            isUser
              ? 'rounded-tr-md border-life-plan/20 bg-life-plan/10'
              : 'rounded-tl-md border-life-ai/20 bg-life-ai/5'
          }`}
        >
          <div
            className={`flex items-center gap-3 ${
              isUser ? 'justify-end text-right' : 'justify-between'
            }`}
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {isUser ? '你' : 'Life Trace 生活助理'}
            </p>
            {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {message.content || (streaming ? '正在思考下一步安排...' : '暂无回复')}
            {!isUser && streaming ? (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-life-ai align-[-2px]" />
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
