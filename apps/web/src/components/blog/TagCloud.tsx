import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TagCloudProps {
  tags: { name: string; count: number }[];
  selectedTag?: string;
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function TagCloud({ tags, selectedTag, onTagClick, className }: TagCloudProps) {
  const maxCount = useMemo(() => {
    return Math.max(...tags.map((t) => t.count), 1);
  }, [tags]);

  const getTagSize = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return 'text-lg font-semibold';
    if (ratio > 0.5) return 'text-base font-medium';
    if (ratio > 0.3) return 'text-sm';
    return 'text-xs';
  };

  if (tags.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <button
          type="button"
          key={tag.name}
          onClick={() => onTagClick?.(tag.name)}
          className={cn(
            'px-3 py-1 rounded-full transition-all duration-200',
            'hover:bg-primary/10 hover:scale-105',
            'border border-border/50',
            getTagSize(tag.count),
            selectedTag === tag.name
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground hover:text-foreground',
          )}
        >
          {tag.name}
          <span className="ml-1 text-xs opacity-60">({tag.count})</span>
        </button>
      ))}
    </div>
  );
}
