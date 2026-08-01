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
  header?: ReactNode;
  showActions?: boolean;
  presentation?: 'bubble' | 'workspace';
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

function renderAssistantContent(content: string) {
  return content.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function ConversationMessageBubble({
  role,
  content,
  createdAt,
  children,
  footer,
  header,
  showActions = false,
  presentation = 'bubble',
  className,
}: ConversationMessageBubbleProps) {
  const isUser = role === 'user';
  const isWorkspace = presentation === 'workspace';
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
      {header ? <div className="mb-1.5">{header}</div> : null}
      <div
        className={cn(
          'min-w-0 rounded-xl px-4 py-3 text-sm leading-6 break-words whitespace-pre-wrap [overflow-wrap:anywhere]',
          isWorkspace && !isUser && 'rounded-none bg-transparent px-0 py-0 text-foreground',
          isWorkspace && isUser && 'rounded-2xl bg-muted/75 text-foreground',
          !isWorkspace &&
            (isUser ? 'bg-foreground text-background' : 'bg-muted/75 text-foreground'),
        )}
      >
        {isUser ? content : renderAssistantContent(content)}
        {children}
        {footer ? (
          <div className={cn('mt-3 border-t border-border/60 pt-2', isWorkspace && 'mt-2')}>
            {footer}
          </div>
        ) : null}
      </div>
      {createdAt || !isUser ? (
        <div
          className={cn(
            'mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
            showActions && 'opacity-100',
            isUser && 'justify-end',
          )}
        >
          {createdAt ? <time dateTime={createdAt}>{formatMessageTime(createdAt)}</time> : null}
          <Button
            size="icon-xs"
            variant="ghost"
            className={cn(
              'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
              showActions && 'opacity-100',
            )}
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
