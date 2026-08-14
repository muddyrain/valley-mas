import { ArrowRight, FileText, ImagePlus, Images, PenLine, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminPosts, type Post } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { cn } from '@/lib/utils';

const primaryTasks = [
  {
    number: '01',
    title: '写文章',
    description: '从 Markdown、观点或空白页开始',
    to: '/studio/articles/new',
    icon: PenLine,
  },
  {
    number: '02',
    title: '导入图片',
    description: '批量整理标题、标签与可见范围',
    to: '/studio/images/import',
    icon: ImagePlus,
  },
  {
    number: '03',
    title: '管理图片',
    description: '查看、编辑或删除已导入图片',
    to: '/studio/images/library',
    icon: Images,
  },
  {
    number: '04',
    title: 'AI 图片',
    description: '创作文章封面或图库草稿',
    to: '/studio/images',
    icon: Sparkles,
  },
] as const;

export default function StudioHome() {
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminPosts({ page: 1, pageSize: 4, status: 'draft', postType: 'blog', sort: 'created' })
      .then((result) => {
        if (!active) return;
        setDrafts(result.list || []);
        setFailed(false);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <header className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">PRIVATE STUDIO</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          今天从哪里开始？
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          把想写的、拍到的或想象中的画面带进来。
        </p>
      </header>

      <section
        className="mt-10 grid border-y border-border md:grid-cols-2 xl:grid-cols-4"
        aria-label="开始创作"
      >
        {primaryTasks.map((task, index) => {
          const Icon = task.icon;
          return (
            <Link
              key={task.to}
              to={task.to}
              className={cn(
                'group flex min-h-52 flex-col p-6 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                index > 0 && 'border-t border-border',
                index % 2 === 1 && 'md:border-l',
                index === 1 && 'md:border-t-0',
                index > 0 && 'xl:border-l',
                index > 1 && 'xl:border-t-0',
              )}
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs text-muted-foreground">{task.number}</span>
                <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <div className="mt-auto">
                <h2 className="font-serif text-2xl font-semibold">{task.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
                <ArrowRight className="mt-5 size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="relative mt-12 min-h-44">
        <BoxLoadingOverlay show={loading} title="正在整理最近草稿" />
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">最近草稿</h2>
          </div>
          <Link
            to="/studio/articles"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            进入文章库
          </Link>
        </div>

        {!loading && failed ? (
          <div className="border border-border p-6 text-sm text-muted-foreground">
            暂时无法读取草稿，稍后再试。
          </div>
        ) : !loading && drafts.length === 0 ? (
          <Link
            to="/studio/articles/new"
            className="flex min-h-36 items-center justify-between border border-dashed border-border p-6 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span>还没有草稿</span>
            <span className="flex items-center gap-2 text-sm">
              写第一篇文章 <ArrowRight className="size-4" />
            </span>
          </Link>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                to={`/studio/articles/${draft.id}`}
                className="group grid gap-2 py-5 transition-colors hover:bg-muted/35 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:px-3"
              >
                <span className="text-xs text-muted-foreground">
                  {draft.group?.name || '未设专栏'}
                </span>
                <strong className="truncate text-base font-medium">
                  {draft.title || '未命名文章'}
                </strong>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  继续编辑{' '}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted-foreground">
        <Link to="/articles" className="inline-flex items-center gap-2 hover:text-foreground">
          <FileText className="size-4" /> 公开文章
        </Link>
        <Link to="/gallery" className="inline-flex items-center gap-2 hover:text-foreground">
          <Images className="size-4" /> 公开图库
        </Link>
      </div>
    </div>
  );
}
