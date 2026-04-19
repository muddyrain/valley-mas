import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  askClassicsChapter,
  type ClassicsAskResponse,
  type ClassicsBook,
  type ClassicsChapter,
  type ClassicsChapterGuide,
  getClassicsChapter,
  getClassicsChapterGuide,
  getClassicsChapters,
  getClassicsDetail,
} from '@/api/classics';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addToShelf,
  getAiExploredChapters,
  isInShelf,
  markChapterAiExplored,
  pushRecentBook,
  removeFromShelf,
} from '@/hooks/useClassicsShelf';

// ---- 阅读进度持久化 ----
const PROGRESS_KEY = (id: string) => `classics_progress_${id}`;

interface ReadProgress {
  editionId: string;
  chapterIndex: number;
  chapterTitle?: string;
  savedAt: number;
}

function saveProgress(id: string, progress: ReadProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY(id), JSON.stringify(progress));
  } catch {}
}

function loadProgress(id: string): ReadProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(id));
    return raw ? (JSON.parse(raw) as ReadProgress) : null;
  } catch {
    return null;
  }
}

export default function ClassicsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainRef = useRef<HTMLElement>(null);

  const [book, setBook] = useState<ClassicsBook | null>(null);
  const [bookLoading, setBookLoading] = useState(true);

  const [chapters, setChapters] = useState<ClassicsChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);

  const [activeChapter, setActiveChapter] = useState<ClassicsChapter | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 书架状态
  const [inShelf, setInShelf] = useState(false);

  // CLAI-3：已 AI 探索的章节索引集合
  const [aiExploredChapters, setAiExploredChapters] = useState<Set<number>>(new Set());

  // AI 伴读状态
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiGuide, setAiGuide] = useState<ClassicsChapterGuide | null>(null);
  const [aiGuideLoading, setAiGuideLoading] = useState(false);
  const [aiGuideError, setAiGuideError] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [askResult, setAskResult] = useState<ClassicsAskResponse | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');

  // 上次进度（用于「继续阅读」按钮）
  const [savedProgress, setSavedProgress] = useState<ReadProgress | null>(null);

  // 当前选中的 editionId 和 chapterIndex 取自 URL 参数
  const editionId = searchParams.get('edition') ?? '';
  const chapterIndexStr = searchParams.get('chapter') ?? '';
  const chapterIndex = chapterIndexStr ? Number(chapterIndexStr) : null;

  // 页面挂载时读取已保存进度 + 书架状态 + AI 探索记录
  useEffect(() => {
    if (!id) return;
    setSavedProgress(loadProgress(id));
    setInShelf(isInShelf(id));
    setAiExploredChapters(new Set(getAiExploredChapters(id)));
  }, [id]);

  // 加载书籍详情
  useEffect(() => {
    if (!id) return;
    setBookLoading(true);
    getClassicsDetail(id)
      .then((b) => {
        setBook(b);
        // 如果 URL 没有 edition，使用默认版本
        if (!editionId && b.editions.length > 0) {
          const defaultEdition = b.editions.find((e) => e.isDefault) ?? b.editions[0];
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('edition', defaultEdition.id);
              return next;
            },
            { replace: true },
          );
        }
      })
      .catch(() => setBook(null))
      .finally(() => setBookLoading(false));
  }, [id, editionId, setSearchParams]);

  // 加载章节列表
  useEffect(() => {
    if (!id || !editionId) return;
    setChaptersLoading(true);
    getClassicsChapters(id, editionId)
      .then(setChapters)
      .catch(() => setChapters([]))
      .finally(() => setChaptersLoading(false));
  }, [id, editionId]);

  // 加载章节正文，并在加载完成后保存进度 + 滚回顶部 + 记录最近阅读
  useEffect(() => {
    if (!id || !editionId || chapterIndex == null) return;
    setChapterLoading(true);
    getClassicsChapter(id, editionId, chapterIndex)
      .then((ch) => {
        setActiveChapter(ch);
        // 保存进度
        saveProgress(id, {
          editionId,
          chapterIndex,
          chapterTitle: ch.title,
          savedAt: Date.now(),
        });
        setSavedProgress({ editionId, chapterIndex, chapterTitle: ch.title, savedAt: Date.now() });
        // 写入最近阅读（需要 book 信息）
        setBook((b) => {
          if (b) {
            pushRecentBook({
              id: b.id,
              title: b.title,
              coverUrl: b.coverUrl,
              authorNames: b.authors.map((a) => a.name).join('、'),
              dynasty: b.dynasty,
              editionId,
              chapterIndex,
              chapterTitle: ch.title,
              savedAt: Date.now(),
            });
          }
          return b;
        });
        // 滚到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(() => setActiveChapter(null))
      .finally(() => setChapterLoading(false));
  }, [id, editionId, chapterIndex]);

  const openChapter = (idx: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('chapter', String(idx));
      return next;
    });
    setSidebarOpen(false);
    // 切换章节时重置 AI 状态
    setAiGuide(null);
    setAiGuideError('');
    setAskResult(null);
    setAskError('');
    setAskQuestion('');
  };

  const handleGenerateGuide = async () => {
    if (!id || !editionId || chapterIndex == null) return;
    setAiGuideLoading(true);
    setAiGuideError('');
    try {
      const data = await getClassicsChapterGuide(id, editionId, chapterIndex);
      setAiGuide(data);
      // CLAI-3：标记本章已 AI 探索
      markChapterAiExplored(id, chapterIndex);
      setAiExploredChapters((prev) => new Set([...prev, chapterIndex]));
    } catch {
      setAiGuideError('导读生成失败，请稍后重试。');
    } finally {
      setAiGuideLoading(false);
    }
  };

  const handleAskChapter = async () => {
    if (!id || !editionId || chapterIndex == null) return;
    const q = askQuestion.trim();
    if (!q) {
      setAskError('请输入问题');
      return;
    }
    setAskLoading(true);
    setAskError('');
    try {
      const data = await askClassicsChapter(id, editionId, chapterIndex, q);
      setAskResult(data);
      // CLAI-3：标记本章已 AI 探索
      markChapterAiExplored(id, chapterIndex);
      setAiExploredChapters((prev) => new Set([...prev, chapterIndex]));
    } catch {
      setAskError('暂时无法回答，请换个问法或稍后再试。');
    } finally {
      setAskLoading(false);
    }
  };

  const authorNames = book?.authors.map((a) => a.name).join('、') ?? '';

  if (bookLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="mb-4 h-8 w-24 rounded" />
        <div className="flex gap-6">
          <Skeleton className="h-56 w-36 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-1/2 rounded" />
            <Skeleton className="h-5 w-1/3 rounded" />
            <Skeleton className="h-5 w-1/4 rounded" />
            <Skeleton className="h-20 w-full rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-slate-400">
        <BookOpen className="h-12 w-12" />
        <p className="text-lg">未找到该书目</p>
        <Button variant="outline" onClick={() => navigate('/classics')}>
          返回名著馆
        </Button>
      </div>
    );
  }

  // ---- 阅读模式（章节已选）----
  if (chapterIndex != null) {
    return (
      <div className="flex min-h-screen">
        {/* 章节侧边栏（移动端可折叠） */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 overflow-y-auto border-r border-theme-soft-strong bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
        >
          <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
            <span className="font-semibold text-slate-700">目录</span>
            <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          {chaptersLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : (
            <ul className="py-2">
              {chapters.map((ch) => (
                <li key={ch.index}>
                  <button
                    type="button"
                    onClick={() => openChapter(ch.index)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-theme-soft ${
                      ch.index === chapterIndex
                        ? 'bg-theme-soft font-medium text-theme-primary'
                        : 'text-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <span className="flex-1 line-clamp-1">{ch.title}</span>
                      {aiExploredChapters.has(ch.index) && (
                        <Sparkles className="h-3 w-3 shrink-0 text-theme-primary opacity-70" />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 正文区 */}
        <main ref={mainRef} className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-prose">
            {/* 顶部导航 */}
            <div className="mb-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 lg:hidden"
                >
                  <List className="h-4 w-4" />
                  目录
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete('chapter');
                      return next;
                    });
                  }}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {book.title}
                </button>
              </div>
              {/* 阅读进度 */}
              {chapters.length > 0 && (
                <span className="shrink-0 rounded-full bg-theme-soft px-3 py-0.5 text-xs text-theme-primary">
                  {chapterIndex + 1} / {chapters.length} 章
                </span>
              )}
            </div>

            {chapterLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-7 w-1/2 rounded" />
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full rounded" />
                ))}
              </div>
            ) : activeChapter ? (
              <>
                <h1 className="mb-6 text-2xl font-bold text-slate-800">{activeChapter.title}</h1>
                <div className="prose prose-slate max-w-none text-[17px] leading-8">
                  {activeChapter.content?.split('\n').map((line, i) => (
                    <p key={i}>{line || <br />}</p>
                  ))}
                </div>

                {/* 上下章翻页 */}
                <div className="mt-10 flex items-center justify-between border-t pt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={chapterIndex <= 0}
                    onClick={() => openChapter(chapterIndex - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一章
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={chapterIndex >= chapters.length - 1}
                    onClick={() => openChapter(chapterIndex + 1)}
                  >
                    下一章
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* AI 伴读面板 */}
                {aiPanelOpen && (
                  <div className="mt-8 rounded-2xl border border-theme-soft-strong bg-white/90 p-5 shadow-lg">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Sparkles className="h-4 w-4 text-theme-primary" />
                        AI 伴读
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiPanelOpen(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 章节导读 */}
                    <div className="mb-5">
                      <Button
                        size="sm"
                        className="theme-btn-primary gap-1.5"
                        onClick={() => void handleGenerateGuide()}
                        disabled={aiGuideLoading}
                      >
                        {aiGuideLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        本章导读
                      </Button>
                      {aiGuideError && (
                        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                          {aiGuideError}
                        </p>
                      )}
                      {aiGuide && (
                        <div className="mt-3 rounded-xl border border-theme-soft-strong bg-theme-soft/40 p-3">
                          <p className="text-sm leading-7 text-slate-700">{aiGuide.guide}</p>
                          {aiGuide.highlights?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {aiGuide.highlights.map((h) => (
                                <span
                                  key={h}
                                  className="rounded-full bg-theme-soft px-2.5 py-0.5 text-[11px] text-theme-primary"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 问章节 */}
                    <div className="border-t border-theme-soft-strong pt-4">
                      <p className="mb-2 text-xs font-medium text-slate-600">
                        <Sparkles className="mr-1 inline h-3 w-3 text-theme-primary" />
                        问章节
                      </p>
                      <p className="mb-2 text-xs text-slate-400">基于本章内容回答，不跨章节。</p>
                      <div className="flex gap-2">
                        <input
                          value={askQuestion}
                          onChange={(e) => setAskQuestion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleAskChapter();
                            }
                          }}
                          placeholder="问问这段情节的细节、人物或典故…"
                          className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-theme-soft-strong focus:ring-2 focus:ring-theme-soft"
                        />
                        <Button
                          size="sm"
                          className="theme-btn-primary h-9 rounded-xl px-4"
                          onClick={() => void handleAskChapter()}
                          disabled={askLoading}
                        >
                          {askLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '提问'}
                        </Button>
                      </div>
                      {askError && (
                        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                          {askError}
                        </p>
                      )}
                      {askResult && (
                        <div className="mt-3 rounded-xl border border-theme-soft-strong bg-white/80 p-3">
                          <p className="text-sm leading-7 text-slate-700">{askResult.answer}</p>
                          {askResult.citations?.map((c, i) => (
                            <div
                              key={i}
                              className="mt-2 rounded-lg bg-theme-soft/60 px-3 py-2 text-[11px]"
                            >
                              {c.heading && (
                                <div className="mb-1 font-medium text-theme-primary">
                                  {c.heading}
                                </div>
                              )}
                              <div className="leading-5 text-slate-600">{c.quote}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-400">章节内容加载失败</p>
            )}
          </div>
        </main>

        {/* AI 悬浮按钮（右下角，仅阅读模式） */}
        {!chapterLoading && activeChapter && (
          <button
            type="button"
            onClick={() => setAiPanelOpen((prev) => !prev)}
            className={`fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all hover:scale-110 ${
              aiPanelOpen
                ? 'bg-theme-primary text-white'
                : 'bg-white text-theme-primary border border-theme-soft-strong'
            }`}
            title="AI 伴读"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        )}
      </div>
    );
  }

  // ---- 书籍详情页（未选章节）----
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* 返回 */}
      <button
        type="button"
        onClick={() => navigate('/classics')}
        className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ChevronLeft className="h-4 w-4" />
        返回名著馆
      </button>

      {/* 书籍头部信息 */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* 封面 */}
        <div className="relative h-56 w-36 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-md">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-theme-soft">
              <BookOpen className="h-8 w-8 text-theme-primary opacity-60" />
              <span className="px-2 text-center text-xs text-theme-primary opacity-70">
                {book.title}
              </span>
            </div>
          )}
        </div>

        {/* 元信息 */}
        <div className="flex-1 space-y-3">
          <h1 className="text-3xl font-bold text-slate-800">{book.title}</h1>
          {authorNames && <p className="text-base text-slate-500">作者：{authorNames}</p>}
          {book.dynasty && <p className="text-sm text-slate-400">{book.dynasty}</p>}
          {book.category && (
            <span className="inline-block rounded-full bg-theme-soft px-3 py-0.5 text-xs font-medium text-theme-primary">
              {book.category}
            </span>
          )}
          {book.brief && (
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">{book.brief}</p>
          )}
          {book.wordCount != null && (
            <p className="text-xs text-slate-400">
              约 {(book.wordCount / 10000).toFixed(1)} 万字 · {book.chapterCount} 章
            </p>
          )}

          {/* 继续阅读 / 开始阅读 按钮 */}
          <div className="flex flex-wrap gap-2 pt-1">
            {savedProgress && savedProgress.editionId === (editionId || book.editions[0]?.id) ? (
              <Button
                size="sm"
                className="theme-btn-primary gap-1.5"
                onClick={() => openChapter(savedProgress.chapterIndex)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                继续阅读：{savedProgress.chapterTitle ?? `第 ${savedProgress.chapterIndex + 1} 章`}
              </Button>
            ) : chapters.length > 0 ? (
              <Button size="sm" className="theme-btn-primary" onClick={() => openChapter(0)}>
                开始阅读
              </Button>
            ) : null}
            {/* 书架按钮 */}
            <Button
              size="sm"
              variant="outline"
              className={`gap-1.5 ${inShelf ? 'border-theme-soft-strong text-theme-primary' : ''}`}
              onClick={() => {
                if (!id) return;
                if (inShelf) {
                  removeFromShelf(id);
                  setInShelf(false);
                } else {
                  addToShelf(id);
                  setInShelf(true);
                }
              }}
            >
              {inShelf ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {inShelf ? '已加入书架' : '加入书架'}
            </Button>
          </div>

          {/* 版本选择 */}
          {book.editions.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">选择版本：</p>
              <div className="flex flex-wrap gap-2">
                {book.editions.map((ed) => (
                  <button
                    key={ed.id}
                    type="button"
                    onClick={() =>
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set('edition', ed.id);
                        return next;
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      editionId === ed.id
                        ? 'border-theme-soft-strong bg-theme-soft text-theme-primary'
                        : 'border-slate-200 text-slate-500 hover:border-theme-soft-strong hover:text-theme-primary'
                    }`}
                  >
                    {ed.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 章节列表 */}
      <div className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">目录</h2>
        {chaptersLoading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-sm text-slate-400">暂无章节数据</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {chapters.map((ch) => (
              <button
                key={ch.index}
                type="button"
                onClick={() => openChapter(ch.index)}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-4 py-2.5 text-left text-sm text-slate-700 shadow-sm transition-all hover:border-theme-soft-strong hover:bg-theme-soft hover:text-theme-primary"
              >
                <span className="flex flex-1 items-center gap-1.5 line-clamp-1 min-w-0">
                  <span className="flex-1 line-clamp-1">{ch.title}</span>
                  {aiExploredChapters.has(ch.index) && (
                    <Sparkles className="h-3 w-3 shrink-0 text-theme-primary opacity-70" />
                  )}
                </span>
                {ch.wordCount != null && (
                  <span className="ml-2 shrink-0 text-xs text-slate-400">{ch.wordCount} 字</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
