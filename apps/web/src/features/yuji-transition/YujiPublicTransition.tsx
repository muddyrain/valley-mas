import {
  createContext,
  type MouseEvent,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  Link,
  type LinkProps,
  NavLink,
  type NavLinkProps,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import {
  createIdleTransition,
  type PublicTransitionState,
  reducePublicTransition,
  resolveTransitionDuration,
} from './transitionMachine';

const STORAGE_KEY = 'yuji:article-transition';

interface StoredTransition {
  coverId: string;
  scrollY: number;
  sourceUrl: string;
}

interface TransitionContextValue {
  begin: (input: { coverId: string; href: string }) => void;
  state: PublicTransitionState;
}

const YujiTransitionContext = createContext<TransitionContextValue | null>(null);

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function readStoredTransition(): StoredTransition | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTransition) : null;
  } catch {
    return null;
  }
}

export function YujiPublicTransitionProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducePublicTransition, undefined, createIdleTransition);
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const previousPathRef = useRef<string | null>(null);
  const reducedMotion = prefersReducedMotion();

  const begin = useCallback(
    ({ coverId, href }: { coverId: string; href: string }) => {
      if (state.phase !== 'idle') return;
      const sourceUrl = `${location.pathname}${location.search}`;
      const scrollY = window.scrollY;
      const stored: StoredTransition = { coverId, scrollY, sourceUrl };
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {}

      if (reducedMotion) {
        navigate(href, { state: { fromYujiIndex: true } });
        return;
      }
      dispatch({ coverId, href, scrollY, sourceUrl, type: 'START' });
    },
    [location.pathname, location.search, navigate, reducedMotion, state.phase],
  );

  useEffect(() => {
    if (state.phase !== 'closing') return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'CLOSED' }),
      resolveTransitionDuration(false, 'route'),
    );
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'navigating' || !state.href) return;
    navigate(state.href, { state: { fromYujiIndex: true } });
    dispatch({ type: 'NAVIGATED' });
  }, [navigate, state.href, state.phase]);

  useEffect(() => {
    if (state.phase !== 'opening') return;
    const timer = window.setTimeout(
      () => dispatch({ type: 'OPENED' }),
      resolveTransitionDuration(false, 'intro'),
    );
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    const currentUrl = `${location.pathname}${location.search}`;
    const previousPath = previousPathRef.current;
    const stored = readStoredTransition();
    const returnedToSource =
      navigationType === 'POP' &&
      previousPath?.startsWith('/articles/') &&
      stored?.sourceUrl === currentUrl;

    if (returnedToSource && stored) {
      if (!reducedMotion) dispatch({ type: 'REVEAL' });
      window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('yuji:restore-scroll', { detail: { scrollY: stored.scrollY } }),
        );
        window.scrollTo(0, stored.scrollY);
      });
    }
    previousPathRef.current = location.pathname;
  }, [location.pathname, location.search, navigationType, reducedMotion]);

  const value = useMemo(() => ({ begin, state }), [begin, state]);

  return (
    <YujiTransitionContext.Provider value={value}>
      {children}
      {state.phase !== 'idle' ? (
        <div className="yuji-route-transition" data-phase={state.phase} aria-hidden="true">
          <span className="yuji-route-transition-grid" />
          <span className="yuji-route-transition-signal">YUJI / SIGNAL SHIFT</span>
        </div>
      ) : null}
    </YujiTransitionContext.Provider>
  );
}

function shouldUseNativeNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.currentTarget.target === '_blank'
  );
}

interface YujiTransitionLinkProps extends LinkProps {
  coverId: string;
}

interface YujiTransitionNavLinkProps extends NavLinkProps {
  transitionId?: string;
}

export function YujiTransitionNavLink({
  onClick,
  to,
  transitionId = 'public-route',
  ...props
}: YujiTransitionNavLinkProps) {
  const context = useContext(YujiTransitionContext);

  return (
    <NavLink
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || shouldUseNativeNavigation(event) || !context) return;
        const href = typeof to === 'string' ? to : to.pathname;
        if (!href) return;
        event.preventDefault();
        context.begin({ coverId: transitionId, href });
      }}
    />
  );
}

export function YujiTransitionLink({ coverId, onClick, to, ...props }: YujiTransitionLinkProps) {
  const context = useContext(YujiTransitionContext);

  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || shouldUseNativeNavigation(event) || !context) return;
        const href = typeof to === 'string' ? to : to.pathname;
        if (!href) return;
        event.preventDefault();
        context.begin({ coverId, href });
      }}
    />
  );
}
