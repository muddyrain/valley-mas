import { Clock, MapPin } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

export function TracesPage() {
  const traces = useLifeTraceStore((state) => state.traces);
  const tracesLoading = useLifeTraceStore((state) => state.tracesLoading);
  const tracesError = useLifeTraceStore((state) => state.tracesError);

  return (
    <div className="space-y-5">
      <SectionHeader title="踪迹" meta={`${traces.length} 条记录`} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['全部', '电影', '美食', '运动', '日常'].map((filter, index) => (
          <button
            type="button"
            key={filter}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              index === 0 ? 'bg-life-trace text-background' : 'bg-card text-muted-foreground'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {tracesError ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {tracesError}
        </Card>
      ) : null}

      {tracesLoading ? (
        <Card className="p-5 text-sm text-muted-foreground">正在同步你的生活踪迹...</Card>
      ) : null}

      <div className="relative space-y-6 pl-7">
        <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
        {traces.map((trace) => (
          <article key={trace.id} className="relative">
            <span className="absolute -left-[1.7rem] top-5 size-3 rounded-full border-2 border-life-trace bg-background" />
            <Card className="overflow-hidden">
              {trace.imageUrl ? (
                <img
                  src={trace.imageUrl}
                  alt={trace.title}
                  className="aspect-video w-full object-cover opacity-85"
                />
              ) : null}
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold leading-snug">{trace.title}</h2>
                  <Badge tone="trace">{trace.mood}</Badge>
                </div>
                <div className="rounded-2xl bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                  {trace.summary}
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    {trace.timeLabel}
                  </div>
                  {trace.location ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4" />
                      {trace.location}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {trace.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          </article>
        ))}
      </div>

      {!tracesLoading && traces.length === 0 ? (
        <Card className="p-5 text-sm leading-6 text-muted-foreground">
          还没有生活踪迹。先完成一个计划，Life Trace 会把它沉淀为可回看的记录。
        </Card>
      ) : null}
    </div>
  );
}
