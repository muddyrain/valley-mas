import { List } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/types/blog';

interface TableOfContentsProps {
  toc: TocItem[];
  className?: string;
  activeId?: string;
  onActiveIdChange?: (id: string) => void;
  onItemSelect?: (id: string) => void;
}

function getStickyTopOffset() {
  const stickySelectors = ['[data-global-header]', '[data-blog-post-nav]'];

  const stickyHeight = stickySelectors.reduce((total, selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return total;

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const isStickyElement = styles.position === 'sticky' || styles.position === 'fixed';
    const isPinnedToTop = rect.top <= 1 && rect.bottom > 0;

    return isStickyElement && isPinnedToTop ? total + rect.height : total;
  }, 0);

  return Math.round(stickyHeight + 16);
}

export function TableOfContents({
  toc,
  className,
  activeId: activeIdProp,
  onActiveIdChange,
  onItemSelect,
}: TableOfContentsProps) {
  const [internalActiveId, setInternalActiveId] = useState<string>('');
  const [scrollOffset, setScrollOffset] = useState<number>(120);
  const headingElementsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const activeId = activeIdProp ?? internalActiveId;

  const updateActiveId = useCallback(
    (id: string) => {
      if (!id) return;
      if (activeIdProp === undefined) {
        setInternalActiveId(id);
      }
      onActiveIdChange?.(id);
    },
    [activeIdProp, onActiveIdChange],
  );

  useEffect(() => {
    const updateOffset = () => {
      setScrollOffset(getStickyTopOffset());
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);

    return () => {
      window.removeEventListener('resize', updateOffset);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--blog-scroll-offset', `${scrollOffset}px`);

    return () => {
      document.documentElement.style.removeProperty('--blog-scroll-offset');
    };
  }, [scrollOffset]);

  useEffect(() => {
    const highlightCurrentHeading = () => {
      const allHeadings = toc
        .map((item) => document.getElementById(item.id))
        .filter((heading): heading is HTMLElement => Boolean(heading));

      let currentActive = '';

      for (const heading of allHeadings) {
        const rect = heading.getBoundingClientRect();
        if (rect.top <= scrollOffset + 8) {
          currentActive = heading.id;
        }
      }

      if (currentActive) {
        updateActiveId(currentActive);
      } else if (allHeadings[0]) {
        updateActiveId(allHeadings[0].id);
      }
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          headingElementsRef.current.set(entry.target.id, entry);
        } else {
          headingElementsRef.current.delete(entry.target.id);
        }
      });

      const visibleHeadings = Array.from(headingElementsRef.current.values()).sort(
        (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
      );

      if (visibleHeadings.length > 0) {
        updateActiveId(visibleHeadings[0].target.id);
      } else {
        highlightCurrentHeading();
      }
    };

    const observer = new IntersectionObserver(callback, {
      rootMargin: `-${scrollOffset}px 0px -60% 0px`,
      threshold: 0,
    });

    toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    highlightCurrentHeading();

    const handleScroll = () => {
      highlightCurrentHeading();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [toc, scrollOffset, updateActiveId]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - scrollOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      updateActiveId(id);
      onItemSelect?.(id);
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
