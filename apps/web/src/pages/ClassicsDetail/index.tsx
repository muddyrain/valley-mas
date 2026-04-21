import {
  BookMarked,
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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  addToShelfWithSync,
  getAiExploredChaptersWithSync,
  getProgressWithSync,
  getShelfIdsWithSync,
  markChapterAiExploredWithSync,
  pushRecentBookWithSync,
  type ReadProgress,
  removeFromShelfWithSync,
  saveProgressWithSync,
} from '@/hooks/useClassicsShelf';

type EditionLanguage = 'zh' | 'en' | 'other';

function isForeignBookMeta(book: ClassicsBook): boolean {
  return book.category === '外国文学' || book.dynasty === '外国';
}

function detectEditionLanguage(label: string): EditionLanguage {
  const lower = label.toLowerCase();
  if (
    lower.includes('project gutenberg') ||
    lower.includes('english') ||
    lower.includes('original') ||
    label.includes('英文') ||
    label.includes('原文') ||
    label.includes('原版')
  ) {
    return 'en';
  }
  if (
    label.includes('简体') ||
    label.includes('中文') ||
    label.includes('译本') ||
    label.includes('导读') ||
    label.includes('人民文学') ||
    label.includes('维基文库')
  ) {
    return 'zh';
  }
  return 'other';
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
  const languageParam = searchParams.get('lang');

  // 页面挂载时读取已保存进度 + 书架状态 + AI 探索记录
  useEffect(() => {
    if (!id) return;
    let disposed = false;

    void Promise.all([
      getShelfIdsWithSync(),
      getProgressWithSync(id),
      getAiExploredChaptersWithSync(id),
    ]).then(([shelfIds, progress, exploredChapters]) => {
      if (disposed) return;
      setInShelf(shelfIds.includes(id));
      setSavedProgress(progress);
      setAiExploredChapters(new Set(exploredChapters));
    });

    return () => {
      disposed = true;
    };
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
          const isForeign = isForeignBookMeta(b);
          const byLang = (lang: 'zh' | 'en') =>
            b.editions.find((e) => detectEditionLanguage(e.label) === lang);
          const defaultEdition =
            isForeign && languageParam === 'zh'
              ? (byLang('zh') ?? b.editions.find((e) => e.isDefault) ?? b.editions[0])
              : isForeign && languageParam === 'en'
                ? (byLang('en') ?? b.editions.find((e) => e.isDefault) ?? b.editions[0])
                : (b.editions.find((e) => e.isDefault) ?? b.editions[0]);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('edition', defaultEdition.id);
              if (isForeign && (languageParam === 'zh' || languageParam === 'en')) {
                next.set('lang', languageParam);
              }
              return next;
            },
            { replace: true },
          );
        }
      })
      .catch(() => setBook(null))
      .finally(() => setBookLoading(false));
  }, [id, editionId, languageParam, setSearchParams]);

  const editionLangMap = useMemo(() => {
    const map = new Map<string, EditionLanguage>();
    if (!book) return map;
    for (const ed of book.editions) {
      map.set(ed.id, detectEditionLanguage(ed.label));
    }
    return map;
  }, [book]);

  const currentEdition = useMemo(() => {
    if (!book) return null;
    return book.editions.find((ed) => ed.id === editionId) ?? null;
  }, [book, editionId]);

  const foreignLangEditions = useMemo(() => {
    const zh = book?.editions.filter((ed) => editionLangMap.get(ed.id) === 'zh') ?? [];
    const en = book?.editions.filter((ed) => editionLangMap.get(ed.id) === 'en') ?? [];
    return { zh, en };
  }, [book, editionLangMap]);

  const isForeignBook = Boolean(book && isForeignBookMeta(book));

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
        const nextProgress: ReadProgress = {
          editionId,
          chapterIndex,
          chapterTitle: ch.title,
          savedAt: Date.now(),
        };
        // 保存进度（登录态云端同步，游客本地兜底）
        setSavedProgress(nextProgress);
        void saveProgressWithSync(id, nextProgress);
        // 写入最近阅读（需要 book 信息）
        setBook((b) => {
          if (b) {
            void pushRecentBookWithSync({
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
      void markChapterAiExploredWithSync(id, chapterIndex);
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
      void markChapterAiExploredWithSync(id, chapterIndex);
      setAiExploredChapters((prev) => new Set([...prev, chapterIndex]));
    } catch {
      setAskError('暂时无法回答，请换个问法或稍后再试。');
    } finally {
      setAskLoading(false);
    }
  };

  const authorNames = book?.authors.map((a) => a.name).join('、') ?? '';
  const currentEditionLang = currentEdition
    ? (editionLangMap.get(currentEdition.id) ?? 'other')
    : 'other';
  const isEnglishReading = currentEditionLang === 'en' || languageParam === 'en';
  const readingProseClassName = isEnglishReading
    ? "prose prose-slate max-w-none text-[1.16rem] leading-9 tracking-[0.01em] text-slate-700 [font-family:'Cormorant_Garamond','Georgia','Times_New_Roman',serif]"
    : "prose prose-slate max-w-none text-[1.06rem] leading-9 text-slate-700 [font-family:'Source_Han_Serif_SC','Noto_Serif_SC','Songti_SC',serif]";

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
          返回阅读库
        </Button>
      </div>
    );
  }

  // ---- 阅读模式（章节已选）----
  if (chapterIndex != null) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(244,231,210,0.45),transparent_46%),radial-gradient(circle_at_80%_90%,rgba(221,233,244,0.3),transparent_42%),linear-gradient(180deg,#fcfaf6_0%,#f8f6f1_100%)]">
        {/* 章节侧边栏（移动端可折叠） */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 overflow-y-auto border-r border-theme-soft-strong/80 bg-[#fffdfa]/95 shadow-xl backdrop-blur transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
            sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
        >
          <div className="sticky top-0 border-b border-theme-soft-strong/70 bg-[#fffdfa]/95 px-4 py-3 backdrop-blur">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-700">目录</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="lg:hidden">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <p className="line-clamp-1 text-[11px] text-slate-400">{book.title}</p>
            {currentEdition && (
              <p className="mt-1 line-clamp-1 text-[11px] text-theme-primary">
                {currentEdition.label}
              </p>
            )}
          </div>
          {chaptersLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : (
            <ul className="p-2">
              {chapters.map((ch) => (
                <li key={ch.index}>
                  <button
                    type="button"
                    onClick={() => openChapter(ch.index)}
                    className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      ch.index === chapterIndex
                        ? 'bg-theme-soft font-medium text-theme-primary shadow-sm'
                        : 'text-slate-600 hover:bg-theme-soft/80'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
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
        <main ref={mainRef} className="flex-1 px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-4xl">
            {/* 顶部导航 */}
            <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-theme-soft-strong/60 bg-white/80 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 lg:hidden"
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
                <div className="rounded-3xl border border-theme-soft-strong/70 bg-white/85 px-5 py-6 shadow-sm backdrop-blur sm:px-8">
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    {currentEdition && (
                      <span className="rounded-full bg-theme-soft px-2.5 py-0.5 text-xs text-theme-primary">
                        {currentEdition.label}
                      </span>
                    )}
                    <span className="rounded-full border border-theme-soft-strong/60 px-2.5 py-0.5 text-xs text-slate-500">
                      {isEnglishReading ? 'English Reading Mode' : '中文阅读模式'}
                    </span>
                  </div>
                  <h1 className="mb-6 text-3xl font-semibold text-slate-800 [font-family:'Source_Han_Serif_SC','Noto_Serif_SC','Songti_SC',serif]">
                    {activeChapter.title}
                  </h1>
                  <div className={readingProseClassName}>
                    {activeChapter.content?.split('\n').map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                    ))}
                  </div>
                </div>

                {/* 上下章翻页 */}
                <div className="mt-6 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl bg-white/80"
                    disabled={chapterIndex <= 0}
                    onClick={() => openChapter(chapterIndex - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    上一章
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl bg-white/80"
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_8%,rgba(244,231,210,0.5),transparent_45%),radial-gradient(circle_at_82%_82%,rgba(219,231,244,0.32),transparent_44%),linear-gradient(180deg,#fcfaf6_0%,#f7f5f0_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {/* 返回 */}
        <button
          type="button"
          onClick={() => navigate('/classics')}
          className="mb-5 inline-flex items-center gap-1 rounded-full border border-theme-soft-strong/70 bg-white/80 px-3 py-1.5 text-sm text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
          返回阅读库
        </button>

        {/* 书籍头部信息 */}
        <section className="rounded-3xl border border-theme-soft-strong/70 bg-white/85 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* 封面 */}
            <div className="relative mx-auto h-64 w-44 shrink-0 overflow-hidden rounded-2xl border border-theme-soft-strong/80 bg-slate-100 shadow-lg lg:mx-0">
              {book.coverUrl ? (
                <img src={book.coverUrl} alt={book.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-theme-soft">
                  <BookOpen className="h-9 w-9 text-theme-primary opacity-60" />
                  <span className="px-3 text-center text-xs text-theme-primary opacity-75">
                    {book.title}
                  </span>
                </div>
              )}
            </div>

            {/* 元信息 */}
            <div className="flex-1">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {book.category && (
                  <span className="inline-block rounded-full bg-theme-soft px-3 py-1 text-xs font-medium text-theme-primary">
                    {book.category}
                  </span>
                )}
                {book.dynasty && (
                  <span className="inline-block rounded-full border border-theme-soft-strong/70 px-3 py-1 text-xs text-slate-500">
                    {book.dynasty}
                  </span>
                )}
                {currentEdition && (
                  <span className="inline-block rounded-full border border-theme-soft-strong/70 bg-theme-soft/50 px-3 py-1 text-xs text-theme-primary">
                    当前版本：{currentEdition.label}
                  </span>
                )}
              </div>

              <h1 className="mb-2 text-3xl font-semibold text-slate-800 [font-family:'Source_Han_Serif_SC','Noto_Serif_SC','Songti_SC',serif] sm:text-[2.1rem]">
                {book.title}
              </h1>
              {authorNames && <p className="text-base text-slate-600">作者：{authorNames}</p>}

              {book.brief && (
                <p className="mt-4 rounded-2xl border border-theme-soft-strong/60 bg-theme-soft/25 px-4 py-3 text-sm leading-7 text-slate-600">
                  {book.brief}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-sm">
                <div className="rounded-xl border border-theme-soft-strong/60 bg-white/80 px-3 py-2">
                  <p className="text-[11px] text-slate-400">字数</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {book.wordCount != null
                      ? `约 ${(book.wordCount / 10000).toFixed(1)} 万字`
                      : '--'}
                  </p>
                </div>
                <div className="rounded-xl border border-theme-soft-strong/60 bg-white/80 px-3 py-2">
                  <p className="text-[11px] text-slate-400">章节</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{book.chapterCount} 章</p>
                </div>
              </div>

              {/* 继续阅读 / 开始阅读 按钮 */}
              <div className="mt-5 flex flex-wrap gap-2">
                {savedProgress &&
                savedProgress.editionId === (editionId || book.editions[0]?.id) ? (
                  <Button
                    size="sm"
                    className="theme-btn-primary gap-1.5"
                    onClick={() => openChapter(savedProgress.chapterIndex)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    继续阅读：
                    {savedProgress.chapterTitle ?? `第 ${savedProgress.chapterIndex + 1} 章`}
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
                  className={`gap-1.5 bg-white/80 ${inShelf ? 'border-theme-soft-strong text-theme-primary' : ''}`}
                  onClick={async () => {
                    if (!id) return;
                    if (inShelf) {
                      setInShelf(false);
                      await removeFromShelfWithSync(id);
                    } else {
                      setInShelf(true);
                      await addToShelfWithSync(id);
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
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 bg-white/80"
                  onClick={() => navigate('/classics/shelf')}
                >
                  <BookMarked className="h-3.5 w-3.5" />
                  查看书架
                </Button>
              </div>

              {/* 版本选择 */}
              {book.editions.length > 1 && (
                <div className="mt-6 rounded-2xl border border-theme-soft-strong/70 bg-white/75 p-4">
                  {isForeignBook &&
                    (foreignLangEditions.zh.length > 0 || foreignLangEditions.en.length > 0) && (
                      <div className="mb-3 space-y-2">
                        <p className="text-xs font-medium text-slate-500">语言切换</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={foreignLangEditions.zh.length === 0}
                            onClick={() => {
                              const target = foreignLangEditions.zh[0];
                              if (!target) return;
                              setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set('lang', 'zh');
                                next.set('edition', target.id);
                                next.delete('chapter');
                                return next;
                              });
                            }}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              languageParam === 'zh'
                                ? 'border-theme-soft-strong bg-theme-soft text-theme-primary'
                                : 'border-slate-200 text-slate-500 hover:border-theme-soft-strong hover:text-theme-primary'
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            简体中文
                          </button>
                          <button
                            type="button"
                            disabled={foreignLangEditions.en.length === 0}
                            onClick={() => {
                              const target = foreignLangEditions.en[0];
                              if (!target) return;
                              setSearchParams((prev) => {
                                const next = new URLSearchParams(prev);
                                next.set('lang', 'en');
                                next.set('edition', target.id);
                                next.delete('chapter');
                                return next;
                              });
                            }}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                              languageParam === 'en'
                                ? 'border-theme-soft-strong bg-theme-soft text-theme-primary'
                                : 'border-slate-200 text-slate-500 hover:border-theme-soft-strong hover:text-theme-primary'
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            English
                          </button>
                        </div>
                        {currentEdition?.label.includes('导读') && (
                          <p className="text-xs text-slate-400">
                            当前为简体导读版，可切换到 English 查看英文原文。
                          </p>
                        )}
                      </div>
                    )}
                  <p className="mb-2 text-xs font-medium text-slate-500">选择版本</p>
                  <div className="flex flex-wrap gap-2">
                    {book.editions.map((ed) => (
                      <button
                        key={ed.id}
                        type="button"
                        onClick={() =>
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set('edition', ed.id);
                            if (isForeignBook) {
                              const lang = editionLangMap.get(ed.id);
                              if (lang === 'zh' || lang === 'en') {
                                next.set('lang', lang);
                              }
                            }
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
        </section>

        {/* 章节列表 */}
        <section className="mt-8 rounded-3xl border border-theme-soft-strong/70 bg-white/88 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.07)] backdrop-blur sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-700 [font-family:'Source_Han_Serif_SC','Noto_Serif_SC','Songti_SC',serif]">
              目录
            </h2>
            <p className="text-xs text-slate-400">
              {chapters.length > 0 ? `共 ${chapters.length} 章` : '暂无章节'}
            </p>
          </div>
          {chaptersLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : chapters.length === 0 ? (
            <p className="text-sm text-slate-400">暂无章节数据</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((ch) => (
                <button
                  key={ch.index}
                  type="button"
                  onClick={() => openChapter(ch.index)}
                  className="group rounded-xl border border-theme-soft-strong/60 bg-white/85 px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-theme-soft-strong hover:bg-theme-soft/60 hover:shadow-md"
                >
                  <span className="mb-1 flex min-w-0 items-center gap-1.5 text-sm text-slate-700">
                    <span className="flex-1 line-clamp-1">{ch.title}</span>
                    {aiExploredChapters.has(ch.index) && (
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-theme-primary opacity-70" />
                    )}
                  </span>
                  <span className="text-xs text-slate-400 group-hover:text-slate-500">
                    {ch.wordCount != null ? `${ch.wordCount} 字` : '点击进入阅读'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
