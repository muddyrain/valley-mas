import { FileText, ImageIcon, Loader2, type LucideIcon, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import {
  buildSearchResultUrl,
  filterSearchCommands,
  normalizeSearchQuery,
  SEARCH_COMMAND_CATEGORY_LABELS,
  type SearchCommandCategory,
  searchCommandCatalog,
} from '@/features/search/searchCatalog';
import { useAuthStore } from '@/stores/useAuthStore';

const REMOTE_SEARCH_DELAY_MS = 280;
const REMOTE_PREVIEW_SIZE = 5;

interface RemoteSearchState {
  posts: Post[];
  resources: Resource[];
  contentError: boolean;
  resourcesError: boolean;
  loading: boolean;
}

const EMPTY_REMOTE_STATE: RemoteSearchState = {
  posts: [],
  resources: [],
  contentError: false,
  resourcesError: false,
  loading: false,
};

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function groupCommands(
  commands: ReturnType<typeof filterSearchCommands>,
  category: SearchCommandCategory,
) {
  return commands.filter((command) => command.category === category);
}

function CommandIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-xs transition-colors group-data-[selected=true]/command-item:text-foreground">
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
}

function ResultType({ children }: { children: string }) {
  return (
    <CommandShortcut className="rounded-md bg-muted px-2 py-1 font-medium tracking-normal group-data-[selected=true]/command-item:bg-background/80">
      {children}
    </CommandShortcut>
  );
}

export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<RemoteSearchState>(EMPTY_REMOTE_STATE);
  const timerRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const openerRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);
  const normalizedQuery = normalizeSearchQuery(query);

  const localCommands = useMemo(
    () => filterSearchCommands(searchCommandCatalog, normalizedQuery, isAuthenticated),
    [isAuthenticated, normalizedQuery],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (!open && document.activeElement instanceof HTMLElement) {
          openerRef.current = document.activeElement;
        }
        onOpenChange(!open);
        return;
      }
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open && !previousOpenRef.current && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    if (!open && previousOpenRef.current) {
      requestSequenceRef.current += 1;
      setQuery('');
      setRemote(EMPTY_REMOTE_STATE);
      const opener = openerRef.current;
      window.setTimeout(() => opener?.focus(), 0);
    }
    previousOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!open || !normalizedQuery) {
      requestSequenceRef.current += 1;
      setRemote(EMPTY_REMOTE_STATE);
      return;
    }

    const sequence = ++requestSequenceRef.current;
    setRemote({ ...EMPTY_REMOTE_STATE, loading: true });

    timerRef.current = window.setTimeout(async () => {
      const [contentResult, resourcesResult] = await Promise.allSettled([
        getPosts({ keyword: normalizedQuery, page: 1, pageSize: REMOTE_PREVIEW_SIZE }),
        getAllResources({ keyword: normalizedQuery, page: 1, pageSize: REMOTE_PREVIEW_SIZE }),
      ]);

      if (!mountedRef.current || requestSequenceRef.current !== sequence) return;

      setRemote({
        posts: contentResult.status === 'fulfilled' ? (contentResult.value.list ?? []) : [],
        resources: resourcesResult.status === 'fulfilled' ? (resourcesResult.value.list ?? []) : [],
        contentError: contentResult.status === 'rejected',
        resourcesError: resourcesResult.status === 'rejected',
        loading: false,
      });
    }, REMOTE_SEARCH_DELAY_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [normalizedQuery, open]);

  const runNavigation = (path: string) => {
    navigate(path);
    setQuery('');
    onOpenChange(false);
  };

  const hasMatches =
    localCommands.length > 0 || remote.posts.length > 0 || remote.resources.length > 0;
  const emptyQueryCategories: SearchCommandCategory[] = ['pages', 'create', 'personal'];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="搜索 Valley"
      description="搜索文章、图文、资源和页面"
      className="top-2 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none translate-y-0 border-border/70 bg-popover shadow-[0_32px_90px_-28px_oklch(0_0_0/0.42)] sm:top-1/2 sm:h-[min(40rem,calc(100dvh-4rem))] sm:w-[min(44rem,calc(100vw-3rem))] sm:max-w-[44rem] sm:-translate-y-1/2"
    >
      <Command shouldFilter={false} className="p-0">
        <CommandInput
          value={query}
          onValueChange={(value) => setQuery(normalizeSearchQuery(value))}
          placeholder="搜索文章、图文、资源和页面"
          aria-label="搜索 Valley"
          maxLength={100}
          autoFocus
        />
        <CommandSeparator className="mx-0" />
        <CommandList className="max-h-none flex-1 px-2 pb-2 sm:max-h-none">
          {remote.loading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              正在搜索
            </div>
          ) : null}

          {!normalizedQuery
            ? emptyQueryCategories.map((category) => {
                const commands = groupCommands(localCommands, category);
                if (commands.length === 0) return null;
                return (
                  <CommandGroup key={category} heading={SEARCH_COMMAND_CATEGORY_LABELS[category]}>
                    {commands.map((command) => {
                      const Icon = command.icon;
                      return (
                        <CommandItem
                          key={command.id}
                          value={command.id}
                          onSelect={() => runNavigation(command.path)}
                        >
                          <CommandIcon icon={Icon} />
                          <span className="font-medium">{command.title}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })
            : null}

          {normalizedQuery && localCommands.length > 0 ? (
            <CommandGroup heading="页面与功能">
              {localCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    value={command.id}
                    onSelect={() => runNavigation(command.path)}
                  >
                    <CommandIcon icon={Icon} />
                    <span className="font-medium">{command.title}</span>
                    <CommandShortcut className="font-mono text-[11px] tracking-normal">
                      {command.path}
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}

          {normalizedQuery && remote.posts.length > 0 ? (
            <CommandGroup heading="内容">
              {remote.posts.map((post) => (
                <CommandItem
                  key={`post:${post.id}`}
                  value={`post:${post.id}`}
                  onSelect={() => runNavigation(`/blog/${post.id}`)}
                >
                  <CommandIcon icon={FileText} />
                  <span className="truncate font-medium">{post.title}</span>
                  <ResultType>{post.postType === 'image_text' ? '图文' : '文章'}</ResultType>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {normalizedQuery && remote.contentError ? (
            <p className="px-4 py-2 text-sm text-destructive">内容结果暂时无法加载</p>
          ) : null}

          {normalizedQuery && remote.resources.length > 0 ? (
            <CommandGroup heading="资源">
              {remote.resources.map((resource) => (
                <CommandItem
                  key={`resource:${resource.id}`}
                  value={`resource:${resource.id}`}
                  onSelect={() => runNavigation(`/resource/${resource.id}`)}
                >
                  <CommandIcon icon={ImageIcon} />
                  <span className="truncate font-medium">{resource.title}</span>
                  <ResultType>{resource.type}</ResultType>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {normalizedQuery && remote.resourcesError ? (
            <p className="px-4 py-2 text-sm text-destructive">资源结果暂时无法加载</p>
          ) : null}

          {normalizedQuery && !remote.loading && !hasMatches ? (
            <div role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
              没有找到相关内容
            </div>
          ) : null}

          {normalizedQuery ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value={`search-all:${normalizedQuery}`}
                  onSelect={() => runNavigation(buildSearchResultUrl(normalizedQuery))}
                  className="my-1 border border-border/60 bg-muted/30"
                >
                  <CommandIcon icon={Search} />
                  <span className="truncate font-medium">
                    查看全部关于「{normalizedQuery}」的结果
                  </span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
        <div className="hidden min-h-12 items-center gap-4 border-t border-border/70 bg-muted/20 px-5 text-xs text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            选择
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Enter</Kbd>
            打开
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd>Esc</Kbd>
            关闭
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
