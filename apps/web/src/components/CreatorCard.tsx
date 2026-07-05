import { Check, ChevronRight, Copy, Download, Image, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Creator } from '@/api/creator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

export interface CreatorCardProps {
  creator: Creator;
  variant?: 'compact' | 'detail';
}

export default function CreatorCard({ creator, variant = 'detail' }: CreatorCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleClick = () => navigate(`/creator/${creator.code}`);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(creator.code).then(() => {
      setCopied(true);
      toast.success('口令已复制');
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (variant === 'compact') {
    return (
      <Card
        className="group cursor-pointer overflow-hidden border-border bg-card/80 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-lg"
        onClick={handleClick}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14 border-2 border-accent shadow-md transition-transform group-hover:scale-110">
                <AvatarImage src={creator.avatar} />
                <AvatarFallback className="bg-linear-to-br from-primary to-primary text-lg font-bold text-primary-foreground">
                  {creator.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card bg-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                {creator.name}
              </h3>
              <p className="mb-1.5 mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {creator.resourceCount} 作品
              </p>
              <div className="inline-flex items-center gap-1 rounded-md border border-accent bg-accent px-2 py-0.5">
                <span className="text-[10px] font-medium text-primary">口令</span>
                <span className="text-xs font-bold tracking-wider text-primary">
                  {creator.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ml-0.5 text-primary transition-colors hover:text-primary-deep"
                  title="复制口令"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="group cursor-pointer transition-all hover:border-accent hover:shadow-lg"
      onClick={handleClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0 border-2 border-accent">
            <AvatarImage src={creator.avatar} />
            <AvatarFallback className="bg-linear-to-br from-primary to-primary text-xl font-bold text-primary-foreground">
              {creator.name[0]}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <h3 className="truncate text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                {creator.name}
              </h3>
            </div>
            <div className="mb-2 inline-flex items-center gap-1 rounded-md border border-accent bg-accent px-2 py-0.5">
              <span className="text-[10px] font-medium text-primary">口令</span>
              <span className="text-xs font-bold tracking-wider text-primary">{creator.code}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="ml-0.5 text-primary transition-colors hover:text-primary-deep"
                title="复制口令"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
            <p className="mb-3 truncate text-sm text-muted-foreground">
              {creator.description || '暂无简介'}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Image className="h-4 w-4 text-primary" />
                {creator.resourceCount}
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4 text-primary" />
                {creator.downloadCount}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-pink-500" />
                {creator.followerCount}
              </span>
            </div>
          </div>

          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
