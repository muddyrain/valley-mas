import type { EventListeners, PartialOptions } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { HTMLAttributes, ReactNode } from 'react';
import './PlushScrollbar.css';

type PlushScrollbarElement = 'div' | 'aside' | 'main' | 'section';

type PlushScrollbarProps = {
  as?: PlushScrollbarElement;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  options?: PartialOptions;
  viewportRef?: (node: HTMLElement | null) => void;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'onScroll'> & {
    onScroll?: (event: Event) => void;
  };

const PLUSH_SCROLLBAR_OPTIONS: PartialOptions = {
  overflow: {
    x: 'hidden',
    y: 'scroll',
  },
  scrollbars: {
    theme: 'os-theme-plush',
    autoHide: 'scroll',
    autoHideDelay: 540,
    autoHideSuspend: false,
  },
};

export default function PlushScrollbar({
  as = 'div',
  children,
  className = '',
  contentClassName = '',
  options,
  onScroll,
  viewportRef,
  ...props
}: PlushScrollbarProps) {
  const events: EventListeners = {
    initialized: (instance) => viewportRef?.(instance.elements().viewport),
    destroyed: () => viewportRef?.(null),
    scroll: (_instance, event) => onScroll?.(event),
  };

  return (
    <div className="plush-scrollbar-frame">
      <OverlayScrollbarsComponent
        {...props}
        element={as}
        className={`plush-scrollbar ${className}`.trim()}
        options={mergeOptions(PLUSH_SCROLLBAR_OPTIONS, options)}
        events={events}
        defer
      >
        <div className={`plush-scrollbar__content ${contentClassName}`.trim()}>{children}</div>
      </OverlayScrollbarsComponent>
    </div>
  );
}

function mergeOptions(base: PartialOptions, override?: PartialOptions): PartialOptions {
  if (!override) return base;
  return {
    ...base,
    ...override,
    overflow: {
      ...base.overflow,
      ...override.overflow,
    },
    scrollbars: {
      ...base.scrollbars,
      ...override.scrollbars,
    },
  };
}
