import { ArrowUpRight, Brain, Gamepad2, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type LabStatus = 'live' | 'beta' | 'soon';

export interface LabEntry {
  /** 唯一标识，用于 key */
  id: string;
  /** 图标节点 */
  icon: ReactNode;
  /** 分类标签文字 */
  tag: string;
  /** 标题 */
  title: string;
  /** 一句话描述 */
  description: string;
  /** 状态标签 */
  status: LabStatus;
  /** 点击时跳转的 URL（外链或 path） */
  href: string;
  /** 是否在新 tab 打开（外链默认 true） */
  external?: boolean;
  /** 卡片渐变色主题 */
  colorTheme: 'violet' | 'emerald' | 'amber';
}

// ── 预设实验场目录（后续追加只需在这里加对象）─────────────────────────────────

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
];

// ── 颜色 Token 映射 ────────────────────────────────────────────────────────────

const colorMap: Record<
  LabEntry['colorTheme'],
  {
    card: string;
    glow: string;
    iconBg: string;
    iconText: string;
    tag: string;
    tagDot: string;
    accent: string;
    liveDot: string;
    liveBg: string;
    liveText: string;
  }
> = {
  violet: {
    card: 'bg-[linear-gradient(148deg,rgba(15,10,40,0.96),rgba(88,28,135,0.52),rgba(99,102,241,0.18))]',
    glow: 'bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.32),transparent_55%)]',
    iconBg: 'bg-purple-500/20 border-purple-400/30',
    iconText: 'text-purple-300',
    tag: 'bg-purple-500/18 text-purple-300 border-purple-400/28',
    tagDot: 'bg-purple-400',
    accent: 'from-purple-500/70 to-indigo-500/70',
    liveDot: 'bg-emerald-400',
    liveBg: 'bg-emerald-500/16 border-emerald-400/28',
    liveText: 'text-emerald-300',
  },
  emerald: {
    card: 'bg-[linear-gradient(148deg,rgba(10,25,20,0.96),rgba(6,78,59,0.52),rgba(16,185,129,0.16))]',
    glow: 'bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.28),transparent_55%)]',
    iconBg: 'bg-emerald-500/18 border-emerald-400/28',
    iconText: 'text-emerald-300',
    tag: 'bg-emerald-500/16 text-emerald-300 border-emerald-400/26',
    tagDot: 'bg-emerald-400',
    accent: 'from-emerald-500/70 to-teal-500/70',
    liveDot: 'bg-amber-400',
    liveBg: 'bg-amber-500/16 border-amber-400/28',
    liveText: 'text-amber-300',
  },
  amber: {
    card: 'bg-[linear-gradient(148deg,rgba(20,15,5,0.96),rgba(120,53,15,0.50),rgba(245,158,11,0.16))]',
    glow: 'bg-[radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.26),transparent_55%)]',
    iconBg: 'bg-amber-500/18 border-amber-400/26',
    iconText: 'text-amber-300',
    tag: 'bg-amber-500/16 text-amber-300 border-amber-400/24',
    tagDot: 'bg-amber-400',
    accent: 'from-amber-500/70 to-orange-500/70',
    liveDot: 'bg-emerald-400',
    liveBg: 'bg-emerald-500/16 border-emerald-400/28',
    liveText: 'text-emerald-300',
  },
};

const statusLabelMap: Record<LabStatus, string> = {
  live: '已上线',
  beta: 'Beta',
  soon: '即将上线',
};

// ── 单张卡片 ──────────────────────────────────────────────────────────────────

function LabCard({ entry }: { entry: LabEntry }) {
  const c = colorMap[entry.colorTheme];

  const handleClick = () => {
    if (entry.external) {
      window.open(entry.href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = entry.href;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex flex-col overflow-hidden rounded-[28px] border border-white/10 p-5 text-left shadow-[0_20px_52px_rgba(0,0,0,0.32)] transition-all duration-300 hover:-translate-y-1.5 hover:border-white/18 hover:shadow-[0_28px_64px_rgba(0,0,0,0.42)] ${c.card}`}
    >
      {/* 光晕 */}
      <div className={`pointer-events-none absolute inset-0 ${c.glow}`} />
      {/* 顶部高光线 */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent ${c.accent} to-transparent opacity-60`}
      />
      {/* 悬停扫光 */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent_16%,rgba(255,255,255,0.06)_52%,transparent_88%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* 头部：图标 + 分类标签 */}
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${c.iconBg} ${c.iconText} shadow-[0_8px_20px_rgba(0,0,0,0.22)]`}
        >
          {entry.icon}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${c.tag}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${c.tagDot}`} />
            {entry.tag}
          </span>
          {/* 状态 */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${c.liveBg} ${c.liveText}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${c.liveDot} ${entry.status === 'live' ? 'animate-pulse' : ''}`}
            />
            {statusLabelMap[entry.status]}
          </span>
        </div>
      </div>

      {/* 内容 */}
      <div className="relative flex-1">
        <div className="text-[17px] font-semibold leading-snug text-white">{entry.title}</div>
        <div className="mt-2 text-sm leading-7 text-white/55">{entry.description}</div>
      </div>

      {/* 底部跳转提示 */}
      <div className="relative mt-5 flex items-center gap-1.5 text-xs text-white/40 transition-colors duration-300 group-hover:text-white/70">
        <span>{entry.external ? '前往体验' : '立即进入'}</span>
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </button>
  );
}

// ── Section 入口 ───────────────────────────────────────────────────────────────

export default function HomeLabSection() {
  return (
    <section className="mt-20 px-4 sm:mt-24 sm:px-0">
      {/* 标题栏 */}
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <div className="theme-eyebrow inline-flex items-center rounded-full border bg-white/88 px-4 py-1.5 text-[11px] tracking-[0.24em] uppercase shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur sm:tracking-[0.3em]">
            LABS & TOOLS
          </div>
          <div className="space-y-2">
            <h2 className="text-[30px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[34px] md:text-[46px]">
              互动实验场
            </h2>
            <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">
              这里是各种实验性项目的聚集地，包含 AI 对战、小游戏和实用工具。后续还有更多在路上。
            </p>
          </div>
        </div>
      </div>

      {/* 卡片网格 */}
      <div className="relative overflow-hidden rounded-[30px] border border-slate-900/12 bg-[linear-gradient(160deg,rgba(15,12,36,0.96),rgba(22,18,50,0.98))] p-4 shadow-[0_28px_72px_rgba(0,0,0,0.28)] sm:rounded-[38px] sm:p-5 md:p-6">
        {/* 背景光晕装饰 */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.14),transparent_60%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.10),transparent_60%)]" />

        {/* 顶部小标签 */}
        <div className="relative mb-5 flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] tracking-[0.18em] text-white/50 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            {labEntries.filter((e) => e.status === 'live').length} 个已上线 · {labEntries.length}{' '}
            个项目
          </div>
        </div>

        <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labEntries.map((entry) => (
            <LabCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </section>
  );
}
