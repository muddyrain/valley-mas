import { List } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/types/blog';

interface TableOfContentsProps {
  toc: TocItem[];
  className?: string;
}

export function TableOfContents({ toc, className }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());

  useEffect(() => {
    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          headingElementsRef.current.set(entry.target.id, entry);
        } else {
          headingElementsRef.current.delete(entry.target.id);
        }
      });

      // 获取当前可见的 headings，按 DOM 顺序排序
      const visibleHeadings = Array.from(headingElementsRef.current.values()).sort((a, b) => {
        // 按在页面上的位置排序
        return a.boundingClientRect.top - b.boundingClientRect.top;
      });

      // 高亮第一个可见的 heading
      if (visibleHeadings.length > 0) {
        setActiveId(visibleHeadings[0].target.id);
      } else {
        // 如果没有可见的 heading，找到当前滚动位置之前的最后一个 heading
        const allHeadings = toc.map((item) => document.getElementById(item.id)).filter(Boolean);
        let currentActive = '';

        for (const heading of allHeadings) {
          if (heading) {
            const rect = heading.getBoundingClientRect();
            if (rect.top <= 150) {
              currentActive = heading.id;
            }
          }
        }

        if (currentActive) {
          setActiveId(currentActive);
        }
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0,
    });

    toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [toc]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // 点击时立即设置高亮
      setActiveId(id);
    }
  };

  if (toc.length === 0) return null;

  return (
    <nav className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2 pb-3 border-b border-border/50">
        <List className="w-4 h-4 text-primary" />
        目录
      </h3>
      <ul className="space-y-1">
        {toc.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
            <a
              href={`#${item.id}`}
              onClick={(e) => handleClick(e, item.id)}
              className={cn(
                'block py-1.5 text-sm transition-all duration-200 rounded-md px-2 -mx-2',
                'hover:bg-primary/5 hover:text-primary',
                activeId === item.id
                  ? 'text-primary font-medium bg-primary/10'
                  : 'text-muted-foreground',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
