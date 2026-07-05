import { Compass, Home, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, hsl(var(--primary) / 0.15) 28%, hsl(var(--background))) 42%, var(--background) 100%)',
};

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <div className="mx-auto flex max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative w-full overflow-hidden rounded-[36px] border p-6 shadow-[0_24px_70px_hsl(var(--primary) / 0.16)] md:p-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-background/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-56 w-56 rounded-full bg-accent/75 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-4 py-1.5 text-[11px] tracking-[0.25em] uppercase">
                <SearchX className="h-3.5 w-3.5" />
                Not Found
              </div>

              <div className="space-y-3">
                <p className="text-primary text-6xl font-semibold leading-none md:text-7xl">404</p>
                <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
                  页面走丢了
                </h1>
                <p className="max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
                  你访问的地址可能已变更、暂时下线，或者输入有误。可以返回首页继续浏览内容，或者去资源区找灵感。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate('/')} className="rounded-xl px-6 font-semibold">
                  <Home className="mr-2 h-4 w-4" />
                  回到首页
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/resources')}
                  className="rounded-xl border-accent bg-card/85 px-6 text-primary hover:bg-accent"
                >
                  <Compass className="mr-2 h-4 w-4" />
                  去看资源
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate(-1)}
                  className="rounded-xl text-muted-foreground hover:bg-card/70"
                >
                  返回上一页
                </Button>
              </div>
            </div>

            <div className="rounded-[30px] border bg-card/82 p-5 md:p-6">
              <h2 className="text-lg font-semibold text-foreground">你可以试试</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="rounded-xl border border-border bg-card/78 px-3 py-2.5">
                  检查链接拼写是否正确。
                </li>
                <li className="rounded-xl border border-border bg-card/78 px-3 py-2.5">
                  从导航栏进入「创作者」「资源」「博客」。
                </li>
                <li className="rounded-xl border border-border bg-card/78 px-3 py-2.5">
                  如果这是旧收藏链接，欢迎告诉我，我会补上跳转。
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
