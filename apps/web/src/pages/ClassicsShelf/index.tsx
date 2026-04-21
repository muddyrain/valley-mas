import { BookMarked, BookOpen, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ClassicsBook, getClassicsDetail } from '@/api/classics';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getProgressMapWithSync,
  getShelfIdsWithSync,
  type ReadProgress,
  removeFromShelfWithSync,
} from '@/hooks/useClassicsShelf';

function ShelfCardSkeleton() {
  return (
    <div className="rounded-2xl border border-theme-soft-strong bg-white/80 p-4 shadow-sm">
      <div className="flex gap-4">
        <Skeleton className="h-32 w-24 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2.5">
          <Skeleton className="h-6 w-2/3 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-4 w-2/5 rounded" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClassicsShelf() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<ClassicsBook[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ReadProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;

    const loadShelf = async () => {
      const ids = await getShelfIdsWithSync();
      if (ids.length === 0) {
        if (!disposed) {
          setBooks([]);
          setProgressMap({});
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const result = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getClassicsDetail(id);
          } catch {
            return null;
          }
        }),
      );
      const nextProgressMap = await getProgressMapWithSync(ids);

      if (disposed) return;
      setBooks(result.filter((item): item is ClassicsBook => item != null));
      setProgressMap(nextProgressMap);
      setLoading(false);
    };

    void loadShelf();
    return () => {
      disposed = true;
    };
  }, []);

  const handleRead = (book: ClassicsBook) => {
    const progress = progressMap[book.id];
    const defaultEditionId =
      book.editions.find((item) => item.isDefault)?.id ?? book.editions[0]?.id;

    if (progress?.editionId) {
      navigate(
        `/classic/${book.id}?edition=${progress.editionId}&chapter=${progress.chapterIndex}`,
      );
      return;
    }

    if (defaultEditionId) {
      navigate(`/classic/${book.id}?edition=${defaultEditionId}`);
      return;
    }

    navigate(`/classic/${book.id}`);
  };

  const handleRemove = async (id: string) => {
    await removeFromShelfWithSync(id);
    setBooks((prev) => prev.filter((book) => book.id !== id));
    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      <div className="relative overflow-hidden bg-theme-soft py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(var(--theme-primary-rgb),0.15),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(var(--theme-primary-rgb),0.10),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme-soft-strong bg-white/70 px-4 py-1.5 text-sm font-medium text-theme-primary shadow-[0_8px_24px_rgba(var(--theme-primary-rgb),0.12)]">
            <BookMarked className="h-4 w-4" />
            我的书架
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-800 sm:text-5xl">
            收藏的阅读都在这里
          </h1>
          <p className="mt-4 text-lg text-slate-500">继续上次阅读进度，或随时移除书架中的书目</p>
          {!loading && <p className="mt-2 text-sm text-slate-400">当前共 {books.length} 本</p>}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <ShelfCardSkeleton key={index} />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="书架还是空的"
            description="在阅读库里遇到想读的作品，点一下「加入书架」就会出现在这里。"
            actionLabel="去阅读库挑书"
            onAction={() => navigate('/classics')}
          />
        ) : (
          <div className="space-y-4">
            {books.map((book) => {
              const progress = progressMap[book.id];
              const authorNames = book.authors.map((item) => item.name).join('、');
              const chapterText = progress
                ? (progress.chapterTitle ?? `第 ${progress.chapterIndex + 1} 章`)
                : '从目录开始';

              return (
                <div
                  key={book.id}
                  className="rounded-2xl border border-theme-soft-strong bg-white/80 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/classic/${book.id}`)}
                      className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-theme-soft-strong bg-theme-soft"
                    >
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen className="h-6 w-6 text-theme-primary opacity-60" />
                        </div>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/classic/${book.id}`)}
                        className="text-left"
                      >
                        <h2 className="line-clamp-1 text-xl font-semibold text-slate-800">
                          {book.title}
                        </h2>
                      </button>
                      {authorNames && (
                        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{authorNames}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        {book.category && (
                          <span className="rounded-full bg-theme-soft px-2.5 py-0.5 text-theme-primary">
                            {book.category}
                          </span>
                        )}
                        {book.dynasty && <span>{book.dynasty}</span>}
                        {book.wordCount != null && (
                          <span>约 {(book.wordCount / 10000).toFixed(1)} 万字</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-slate-500">
                        阅读进度：<span className="text-slate-700">{chapterText}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="theme-btn-primary"
                          onClick={() => handleRead(book)}
                        >
                          {progress ? '继续阅读' : '开始阅读'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => void handleRemove(book.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          移出书架
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
