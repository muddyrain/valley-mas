import { Compass, Home, SearchX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1.5 text-[11px] tracking-[0.25em] uppercase text-primary">
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
                <Button onClick={() => navigate('/')}>
                  <Home className="mr-2 h-4 w-4" />
                  回到首页
                </Button>
                <Button variant="outline" onClick={() => navigate('/resources')}>
                  <Compass className="mr-2 h-4 w-4" />
                  去看资源
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  返回上一页
                </Button>
              </div>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold text-foreground mb-4">你可以试试</h2>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="rounded-lg border border-border bg-card/78 px-3 py-2.5">
                    检查链接拼写是否正确。
                  </li>
                  <li className="rounded-lg border border-border bg-card/78 px-3 py-2.5">
                    从导航栏进入「资源」「博客」。
                  </li>
                  <li className="rounded-lg border border-border bg-card/78 px-3 py-2.5">
                    如果这是旧收藏链接，欢迎告诉我，我会补上跳转。
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
