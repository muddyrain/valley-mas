import { AlertCircle, ArrowRight, Search as SearchIcon } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { BlogFeedCard } from '@/components/blog';
import EmptyState from '@/components/EmptyState';
import ResourceCard from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  filterSearchCommands,
  normalizeSearchQuery,
  type SearchCommand,
  searchCommandCatalog,
} from '@/features/search/searchCatalog';
import {
  enumParam,
  numberParam,
  stringParam,
  useUrlQueryState,
} from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PREVIEW_SIZE = 6;
const PAGE_SIZE = 12;

type SearchType = 'all' | 'content' | 'resources' | 'pages';

export const SEARCH_QUERY_SCHEMA = {
  q: stringParam('', { resetPageOnChange: true }),
  type: enumParam(['all', 'content', 'resources', 'pages'] as const, 'all', {
    resetPageOnChange: true,
  }),
  page: numberParam(1, { min: 1 }),
};

interface ResultState<T> {
  list: T[];
  total: number;
  loading: boolean;
  error: boolean;
}

const emptyResultState = <T,>(): ResultState<T> => ({
  list: [],
  total: 0,
  loading: false,
  error: false,
});

function InlineError({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      {children}
    </div>
  );
}

function PageCommandList({ commands }: { commands: readonly SearchCommand[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {commands.map((command) => {
        const Icon = command.icon;
        return (
          <Link key={command.id} to={command.path} className="group block">
            <Card className="h-full border-border py-0 transition-colors group-hover:border-primary/50 group-hover:bg-muted/50">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{command.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {command.path}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function ResultPagination({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="搜索结果分页" className="mt-8 flex items-center justify-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        上一页
      </Button>
      <span className="text-sm text-muted-foreground">
        第 {page} / {totalPages} 页
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        下一页
      </Button>
    </nav>
  );
}

export default function SearchPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    values: { q, type, page },
    setValue,
  } = useUrlQueryState(SEARCH_QUERY_SCHEMA, { pageKey: 'page' });
  const normalizedQuery = normalizeSearchQuery(q);
  const [inputValue, setInputValue] = useState(normalizedQuery);
  const [content, setContent] = useState<ResultState<Post>>(emptyResultState);
  const [resources, setResources] = useState<ResultState<Resource>>(emptyResultState);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    setInputValue(normalizedQuery);
  }, [normalizedQuery]);

  const pageCommands = useMemo(
    () => filterSearchCommands(searchCommandCatalog, normalizedQuery, isAuthenticated),
    [isAuthenticated, normalizedQuery],
  );

  useEffect(() => {
    const sequence = ++requestSequenceRef.current;
    if (!normalizedQuery || type === 'pages') {
      setContent(emptyResultState());
      setResources(emptyResultState());
      return;
    }

    const loadContent = type === 'all' || type === 'content';
    const loadResources = type === 'all' || type === 'resources';
    const requestPage = type === 'all' ? 1 : page;
    const requestPageSize = type === 'all' ? PREVIEW_SIZE : PAGE_SIZE;

    setContent(
      loadContent ? { list: [], total: 0, loading: true, error: false } : emptyResultState(),
    );
    setResources(
      loadResources ? { list: [], total: 0, loading: true, error: false } : emptyResultState(),
    );

    const contentRequest = loadContent
      ? getPosts({ keyword: normalizedQuery, page: requestPage, pageSize: requestPageSize })
      : Promise.resolve(null);
    const resourceRequest = loadResources
      ? getAllResources({ keyword: normalizedQuery, page: requestPage, pageSize: requestPageSize })
      : Promise.resolve(null);

    void Promise.allSettled([contentRequest, resourceRequest]).then(
      ([contentResult, resourceResult]) => {
        if (requestSequenceRef.current !== sequence) return;

        if (loadContent) {
          setContent(
            contentResult.status === 'fulfilled' && contentResult.value
              ? {
                  list: contentResult.value.list ?? [],
                  total: contentResult.value.total ?? 0,
                  loading: false,
                  error: false,
                }
              : { list: [], total: 0, loading: false, error: true },
          );
        }
        if (loadResources) {
          setResources(
            resourceResult.status === 'fulfilled' && resourceResult.value
              ? {
                  list: resourceResult.value.list ?? [],
                  total: resourceResult.value.total ?? 0,
                  loading: false,
                  error: false,
                }
              : { list: [], total: 0, loading: false, error: true },
          );
        }
      },
    );
  }, [normalizedQuery, page, type]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValue('q', normalizeSearchQuery(inputValue));
  };

  const handleTypeChange = (value: string) => {
    setValue('type', value as SearchType);
  };

  const showContentEmpty =
    !content.loading && !content.error && normalizedQuery && content.list.length === 0;
  const showResourcesEmpty =
    !resources.loading && !resources.error && normalizedQuery && resources.list.length === 0;

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">全站搜索</h1>
          <p className="text-sm text-muted-foreground">搜索文章、图文、资源和页面</p>
        </header>

        <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={inputValue}
              maxLength={100}
              aria-label="搜索 Valley"
              placeholder="搜索文章、图文、资源和页面"
              onChange={(event) => setInputValue(event.currentTarget.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit">搜索</Button>
        </form>

        <Tabs value={type} onValueChange={handleTypeChange} className="mt-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="content">内容</TabsTrigger>
            <TabsTrigger value="resources">资源</TabsTrigger>
            <TabsTrigger value="pages">页面与功能</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-5 min-h-6 text-sm text-muted-foreground" aria-live="polite">
          {!normalizedQuery
            ? '常用页面与安全快捷入口'
            : type === 'all'
              ? `内容 ${content.total} · 资源 ${resources.total} · 页面 ${pageCommands.length}`
              : type === 'content'
                ? `内容结果 ${content.total} 条`
                : type === 'resources'
                  ? `资源结果 ${resources.total} 条`
                  : `页面与功能 ${pageCommands.length} 项`}
        </div>

        {!normalizedQuery ? (
          <section className="mt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">常用页面</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                输入关键词，查找公开内容、资源和站内页面。
              </p>
            </div>
            <PageCommandList commands={pageCommands} />
          </section>
        ) : null}

        {normalizedQuery && (type === 'all' || type === 'pages') ? (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                页面与功能（{pageCommands.length}）
              </h2>
              {type === 'all' ? (
                <Button type="button" variant="ghost" onClick={() => setValue('type', 'pages')}>
                  查看全部
                  <ArrowRight />
                </Button>
              ) : null}
            </div>
            {pageCommands.length > 0 ? (
              <PageCommandList
                commands={type === 'all' ? pageCommands.slice(0, 6) : pageCommands}
              />
            ) : (
              <EmptyState
                icon={SearchIcon}
                title={`没有找到与“${normalizedQuery}”相关的页面`}
                padding="py-12"
              />
            )}
          </section>
        ) : null}

        {normalizedQuery && (type === 'all' || type === 'content') ? (
          <section className="relative mt-8 min-h-32 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">内容（{content.total}）</h2>
              {type === 'all' ? (
                <Button type="button" variant="ghost" onClick={() => setValue('type', 'content')}>
                  查看全部
                  <ArrowRight />
                </Button>
              ) : null}
            </div>
            <BoxLoadingOverlay
              show={content.loading}
              title="正在加载内容结果"
              compact
              className="bg-background/85"
            />
            {content.error ? <InlineError>内容结果暂时无法加载</InlineError> : null}
            {content.list.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {content.list.map((post) => (
                  <BlogFeedCard key={post.id} post={post} />
                ))}
              </div>
            ) : null}
            {showContentEmpty ? (
              <EmptyState
                icon={SearchIcon}
                title={`没有找到与“${normalizedQuery}”相关的内容`}
                padding="py-12"
              />
            ) : null}
            {type === 'content' ? (
              <ResultPagination
                page={page}
                total={content.total}
                onPageChange={(next) => setValue('page', next)}
              />
            ) : null}
          </section>
        ) : null}

        {normalizedQuery && (type === 'all' || type === 'resources') ? (
          <section className="relative mt-8 min-h-32 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">资源（{resources.total}）</h2>
              {type === 'all' ? (
                <Button type="button" variant="ghost" onClick={() => setValue('type', 'resources')}>
                  查看全部
                  <ArrowRight />
                </Button>
              ) : null}
            </div>
            <BoxLoadingOverlay
              show={resources.loading}
              title="正在加载资源结果"
              compact
              className="bg-background/85"
            />
            {resources.error ? <InlineError>资源结果暂时无法加载</InlineError> : null}
            {resources.list.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {resources.list.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} showUser showDate />
                ))}
              </div>
            ) : null}
            {showResourcesEmpty ? (
              <EmptyState
                icon={SearchIcon}
                title={`没有找到与“${normalizedQuery}”相关的资源`}
                padding="py-12"
              />
            ) : null}
            {type === 'resources' ? (
              <ResultPagination
                page={page}
                total={resources.total}
                onPageChange={(next) => setValue('page', next)}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
