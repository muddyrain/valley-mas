import { ArrowUpRight, Brain, Gamepad2, TicketPercent, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type LabStatus = 'live' | 'beta' | 'soon';

export type LabEntry = {
  id: string;
  icon: ReactNode;
  tag: string;
  title: string;
  description: string;
  status: LabStatus;
  href: string;
  external?: boolean;
  colorTheme: 'violet' | 'emerald' | 'amber' | 'sky';
};

// ── 预设实验场目录 ────────────────────────────────────────────────────────────

const MIND_ARENA_URL =
  (import.meta.env.VITE_MIND_ARENA_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5175';

export const labEntries: LabEntry[] = [
  {
    id: 'mind-arena',
    icon: <Brain className="h-6 w-6" />,
    tag: 'AI 实验',
    title: '脑内会议室',
    description:
      '输入一个你纠结的问题，五个 AI 人格代入你的多面性展开辩论，最终由 AI 裁判亮出结果。',
    status: 'live',
    href: MIND_ARENA_URL,
    external: true,
    colorTheme: 'violet',
  },
  {
    id: 'climber-lab',
    icon: <Gamepad2 className="h-6 w-6" />,
    tag: '游戏实验',
    title: '玩具攀爬',
    description: '打开独立的玩具攀爬入口，继续在谷仓、城堡和云端里往上爬。',
    status: 'live',
    href: '/labs/climber',
    external: false,
    colorTheme: 'emerald',
  },
  {
    id: 'format-tools',
    icon: <Wrench className="h-6 w-6" />,
    tag: '工具',
    title: '格式转换',
    description: '常用格式互转工具，JSON、YAML、Base64、时间戳等，直接在浏览器内完成。',
    status: 'live',
    href: '/tools/format',
    external: false,
    colorTheme: 'amber',
  },
  {
    id: 'scratch-legend',
    icon: <TicketPercent className="h-6 w-6" />,
    tag: '游戏实验',
    title: '刮刮传说',
    description:
      '洗盘子攒金币，买刮刮卡，升级工具，用荣耀点数 Prestige——关于运气与积累的循环小游戏。',
    status: 'live',
    href: '/labs/scratch-legend',
    external: false,
    colorTheme: 'sky',
  },
];

const statusLabelMap: Record<LabStatus, string> = {
  live: '已上线',
  beta: 'Beta',
  soon: '即将上线',
};

// ── 单张卡片 ──────────────────────────────────────────────────────────────────

function LabCard({ entry }: { entry: LabEntry }) {
  const handleClick = () => {
    if (entry.external) {
      window.open(entry.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = entry.href;
    }
  };

  return (
    <Card
      className="cursor-pointer transition hover:border-accent hover:shadow"
      onClick={handleClick}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
            {entry.icon}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline">{entry.tag}</Badge>
            <Badge variant="secondary">
              <span
                className={`mr-1 h-1.5 w-1.5 rounded-full bg-primary ${entry.status === 'live' ? 'animate-pulse' : ''}`}
              />
              {statusLabelMap[entry.status]}
            </Badge>
          </div>
        </div>

        <div className="text-base font-semibold text-foreground">{entry.title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{entry.description}</div>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{entry.external ? '前往体验' : '立即进入'}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section 入口 ───────────────────────────────────────────────────────────────

export default function HomeLabSection() {
  return (
    <section className="mt-10">
      <SectionHeading
        eyebrow="LABS & TOOLS"
        title="互动实验场"
        description="这里是各种实验性项目的聚集地，包含 AI 对战、小游戏和实用工具。后续还有更多在路上。"
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Badge variant="secondary">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {labEntries.filter((e) => e.status === 'live').length} 个已上线 · {labEntries.length}{' '}
              个项目
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labEntries.map((entry) => (
              <LabCard key={entry.id} entry={entry} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// Re-use SectionHeading locally to avoid import cycle
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3">
      <div className="inline-flex items-center rounded-full border border-accent bg-accent px-4 py-1.5 text-[11px] tracking-[0.24em] text-primary uppercase">
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {title}
        </h2>
        {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
