import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function AgentAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  const fallback = Array.from(name.trim())[0]?.toUpperCase();
  return (
    <Avatar className={cn('shrink-0', className)}>
      {src ? <AvatarImage src={src} alt={`${name || '智能体'}头像`} /> : null}
      <AvatarFallback>{fallback || <Bot className="size-4" />}</AvatarFallback>
    </Avatar>
  );
}
