'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const rules = [
  {
    step: '01',
    title: '输入你的问题',
    desc: '把任何让你纠结的问题丢进去——人生决策、日常烦恼或脑洞奇想均可。',
    color: 'from-violet-500/30 to-purple-500/10',
    border: 'border-violet-400/30',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
  },
  {
    step: '02',
    title: '5 位 AI 人格入场',
    desc: '理性派、毒舌派、赌徒派、父母派、摆烂派，各自代表一种极端视角登场亮相。',
    color: 'from-fuchsia-500/30 to-pink-500/10',
    border: 'border-fuchsia-400/30',
    glow: 'shadow-[0_0_20px_rgba(217,70,239,0.25)]',
  },
  {
    step: '03',
    title: '三轮激烈辩论',
    desc: '每轮依次发言：立场表达 → 交锋与结盟 → 最终陈词。观点碰撞、阵营流动，实时战况可见。',
    color: 'from-blue-500/30 to-indigo-500/10',
    border: 'border-blue-400/30',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.25)]',
  },
  {
    step: '04',
    title: '你来站队',
    desc: '每轮结束后，你可以选择最支持哪位人格，影响最终裁决权重。',
    color: 'from-amber-500/30 to-orange-500/10',
    border: 'border-amber-400/30',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
  },
  {
    step: '05',
    title: '裁判出炉',
    desc: '辩论结束后，中立裁判综合战况与站队数据，给出最终结论和各人格得分排名。',
    color: 'from-emerald-500/30 to-teal-500/10',
    border: 'border-emerald-400/30',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
  },
  {
    step: '加时',
    title: '加时赛机制',
    desc: '若裁判认为双方势均力敌，得分最高的两位将进入加时赛进行第四、五轮决战。',
    color: 'from-rose-500/30 to-red-500/10',
    border: 'border-rose-400/30',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.25)]',
  },
];

export function RulesModal({ open, onClose }: RulesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="规则说明"
    >
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 弹窗主体 */}
      <div className="relative z-10 w-full max-w-2xl max-h-[88vh] overflow-y-auto thin-scrollbar arena-panel rounded-2xl p-6">
        {/* 发光边框顶部装饰 */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />

        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">📜 游戏规则</h2>
            <p className="text-[13px] text-white/50 mt-1">了解脑内会议室的运行方式</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 规则列表 */}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.step}
              className={`flex gap-4 rounded-xl border ${rule.border} bg-gradient-to-r ${rule.color} ${rule.glow} p-4 transition-all`}
            >
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-black/30 border border-white/10">
                <span className="text-[11px] font-black text-white/80 tracking-tight">
                  {rule.step}
                </span>
              </div>
              <div>
                <div className="text-[14px] font-semibold text-white mb-1">{rule.title}</div>
                <div className="text-[13px] text-white/65 leading-relaxed">{rule.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部提示 */}
        <div className="mt-5 rounded-xl border border-white/8 bg-white/4 p-4 text-[12px] text-white/45 leading-relaxed text-center">
          🎯 脑内会议室不提供"正确答案"——它帮你看清自己内心真正的倾向。
        </div>
      </div>
    </div>,
    document.body,
  );
}
