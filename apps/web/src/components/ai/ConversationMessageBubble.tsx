import { Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConversationMessageRole = 'user' | 'assistant';

interface ConversationMessageBubbleProps {
  role: ConversationMessageRole;
  content: string;
  createdAt?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

function formatMessageTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function ConversationMessageBubble({
  role,
  content,
  createdAt,
  children,
  footer,
  className,
}: ConversationMessageBubbleProps) {
  const isUser = role === 'user';
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('消息已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <div className={cn('group min-w-0 max-w-[min(88%,42rem)]', isUser && 'ml-auto', className)}>
      <div
        className={cn(
          'min-w-0 rounded-xl px-4 py-3 text-sm leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere]',
          isUser ? 'bg-foreground text-background' : 'bg-muted/75 text-foreground',
        )}
      >
        {content}
        {children}
        {footer ? <div className="mt-3 border-t border-border/60 pt-2">{footer}</div> : null}
      </div>
      {createdAt || !isUser ? (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
            isUser && 'justify-end',
          )}
        >
          {createdAt ? <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time> : null}
          <Button
            size="icon-xs"
            variant="ghost"
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="复制消息"
            title="复制消息"
            onClick={() => void copyMessage()}
          >
            <Copy />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
