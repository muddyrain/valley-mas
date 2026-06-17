import type { GrowthLog } from '@/api/types';

const TYPE_LABEL: Record<GrowthLog['type'], string> = {
  birth: '诞生',
  grow: '生长',
  event: '事件',
  harvest: '收获',
};

export function GrowthTimeline({ logs }: { logs: GrowthLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl bg-white/50 p-3 text-sm text-garden-ink/60">
        还没有日志，挂机一会再回来看看吧。
      </div>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {logs.map((l) => (
        <li key={l.id} className="rounded-2xl bg-white/70 p-3 shadow-sm">
          <div className="text-xs text-garden-ink/60 mb-1">
            阶段 {l.stage} · {TYPE_LABEL[l.type] ?? l.type}
          </div>
          <div className="text-sm text-garden-ink whitespace-pre-wrap">{l.content}</div>
        </li>
      ))}
    </ol>
  );
}
