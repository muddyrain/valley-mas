import { BookOpen, Clock, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ClassicsBook, getClassicsList } from '@/api/classics';
import EmptyState from '@/components/EmptyState';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecentBooks, type RecentBook } from '@/hooks/useClassicsShelf';
import {
  enumParam,
  numberParam,
  stringParam,
  useUrlQueryState,
} from '@/hooks/useUrlPaginationQuery';

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '古典文学', value: '古典文学' },
  { label: '外国文学', value: '外国文学' },
  { label: '诗词歌赋', value: '诗词歌赋' },
  { label: '现代文学', value: '现代文学' },
  { label: '历史传记', value: '历史传记' },
];

const DYNASTY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '先秦', value: '先秦' },
  { label: '汉', value: '汉' },
  { label: '魏晋南北朝', value: '魏晋南北朝' },
  { label: '唐', value: '唐' },
  { label: '宋', value: '宋' },
  { label: '元', value: '元' },
  { label: '明', value: '明' },
  { label: '清', value: '清' },
  { label: '近现代', value: '近现代' },
  { label: '外国', value: '外国' },
];

const CLASSICS_QUERY_SCHEMA = {
  page: numberParam(1, { min: 1 }),
  keyword: stringParam('', { resetPageOnChange: true }),
  category: enumParam(
    ['', '古典文学', '外国文学', '诗词歌赋', '现代文学', '历史传记'] as const,
    '',
    { resetPageOnChange: true },
  ),
  dynasty: enumParam(
    ['', '先秦', '汉', '魏晋南北朝', '唐', '宋', '元', '明', '清', '近现代', '外国'] as const,
    '',
    { resetPageOnChange: true },
  ),
};

// 最近阅读横条
function RecentBooksBar({
  recentBooks,
  onNavigate,
}: {
  recentBooks: RecentBook[];
  onNavigate: (id: string, editionId: string, chapterIndex: number) => void;
}) {
  if (recentBooks.length === 0) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-600">
        <Clock className="h-4 w-4 text-theme-primary" />
        最近阅读
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {recentBooks.map((book) => (
          <button
            key={book.id}
            type="button"
            onClick={() => onNavigate(book.id, book.editionId, book.chapterIndex)}
            className="group flex shrink-0 items-center gap-3 rounded-xl border border-theme-soft-strong bg-white/80 px-4 py-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md text-left"
          >
            {/* 迷你封面 */}
            <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-md bg-theme-soft">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <BookOpen className="h-4 w-4 text-theme-primary opacity-60" />
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="line-clamp-1 max-w-30 text-sm font-medium text-slate-800">
                {book.title}
              </p>
              <p className="line-clamp-1 max-w-30 text-xs text-slate-500">
                {book.chapterTitle ?? `第 ${book.chapterIndex + 1} 章`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 书籍卡片骨架屏
function ClassicsCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-theme-soft-strong bg-white/80 shadow-sm">
      <Skeleton className="aspect-2/3 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-4 w-1/3 rounded" />
      </div>
    </div>
  );
}

// 书籍卡片
function ClassicsCard({ book, onClick }: { book: ClassicsBook; onClick: () => void }) {
  const authorNames = book.authors.map((a) => a.name).join('、');
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-theme-soft-strong bg-white/80 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md text-left w-full"
    >
      {/* 封面 */}
      <div className="relative aspect-2/3 w-full overflow-hidden bg-theme-soft">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-theme-soft p-4">
            <BookOpen className="h-8 w-8 text-theme-primary opacity-60" />
            <span className="text-center text-sm font-medium text-theme-primary leading-tight opacity-70">
              {book.title}
            </span>
          </div>
        )}
        {book.category && (
          <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm">
            {book.category}
          </span>
        )}
      </div>
      {/* 书目信息 */}
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold text-slate-800">{book.title}</p>
        {authorNames && <p className="line-clamp-1 text-xs text-slate-500">{authorNames}</p>}
        {book.dynasty && <p className="text-xs text-slate-400">{book.dynasty}</p>}
        {book.wordCount != null && (
          <p className="text-xs text-slate-400">约 {(book.wordCount / 10000).toFixed(1)} 万字</p>
        )}
      </div>
    </button>
  );
}

export default function ClassicsList() {
  const navigate = useNavigate();
  const {
    values: {
      page: currentPage,
      keyword: currentKeyword,
      category: currentCategory,
      dynasty: currentDynasty,
    },
    setValue,
  } = useUrlQueryState(CLASSICS_QUERY_SCHEMA, { pageKey: 'page' });

  const [books, setBooks] = useState<ClassicsBook[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState(currentKeyword);
  const [recentBooks, setRecentBooks] = useState<RecentBook[]>([]);

  // 初始化时读取最近阅读
  useEffect(() => {
    setRecentBooks(getRecentBooks());
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setInputValue(currentKeyword);
  }, [currentKeyword]);

  useEffect(() => {
    setLoading(true);
    getClassicsList({
      page: currentPage,
      pageSize: PAGE_SIZE,
      keyword: currentKeyword || undefined,
      category: currentCategory || undefined,
      dynasty: currentDynasty || undefined,
    })
      .then((res) => {
        setBooks(res.list);
        setTotal(res.total);
      })
      .catch(() => {
        setBooks([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [currentPage, currentKeyword, currentCategory, currentDynasty]);

  const handleSearch = () => {
    setValue('keyword', inputValue.trim());
  };

  const handleClearSearch = () => {
    setInputValue('');
    setValue('keyword', '');
  };

  return (
    <div className="min-h-screen">
      {/* Hero 区域 */}
      <div className="relative overflow-hidden bg-theme-soft py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(var(--theme-primary-rgb),0.15),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(var(--theme-primary-rgb),0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme-soft-strong bg-white/70 px-4 py-1.5 text-sm font-medium text-theme-primary shadow-[0_8px_24px_rgba(var(--theme-primary-rgb),0.12)]">
            <BookOpen className="h-4 w-4" />
            名著馆
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl">
            经典文学，随时阅读
          </h1>
          <p className="mt-4 text-lg text-slate-500">收录中外名著，多版本章节阅读，感受文字之美</p>
          {total > 0 && !loading && (
            <p className="mt-2 text-sm text-slate-400">共收录 {total} 部名著</p>
          )}
        </div>
      </div>

      {/* 最近阅读横条 */}
      <RecentBooksBar
        recentBooks={recentBooks}
        onNavigate={(id, editionId, chapterIndex) =>
          navigate(`/classic/${id}?edition=${editionId}&chapter=${chapterIndex}`)
        }
      />

      {/* 筛选 & 搜索 */}
      <div className="sticky top-0 z-10 border-b border-theme-soft-strong bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-2 py-3">
            {/* 第一行：分类 + 搜索 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TypeFilterBar
                options={CATEGORY_OPTIONS}
                value={currentCategory}
                onChange={(v) => setValue('category', v as typeof currentCategory)}
              />
              {/* 搜索框 */}
              <div className="relative flex w-full shrink-0 items-center gap-2 sm:w-64">
                <Search className="absolute left-3 h-4 w-4 text-slate-400" />
                <Input
                  className="rounded-full pl-9 pr-9 text-sm"
                  placeholder="搜索书名、作者…"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                {inputValue && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {/* 第二行：朝代筛选 */}
            <TypeFilterBar
              options={DYNASTY_OPTIONS}
              value={currentDynasty}
              onChange={(v) => setValue('dynasty', v as typeof currentDynasty)}
            />
          </div>
        </div>
      </div>

      {/* 书目网格 */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <ClassicsCardSkeleton key={i} />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="暂无相关名著"
            description={
              currentKeyword ? `未找到与「${currentKeyword}」相关的书目` : '敬请期待更多收录'
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <ClassicsCard
                key={book.id}
                book={book}
                onClick={() => navigate(`/classic/${book.id}`)}
              />
            ))}
          </div>
        )}

        {/* 分页 */}
        {!loading && totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setValue('page', currentPage - 1)}
            >
              上一页
            </Button>
            <span className="text-sm text-slate-500">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setValue('page', currentPage + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
