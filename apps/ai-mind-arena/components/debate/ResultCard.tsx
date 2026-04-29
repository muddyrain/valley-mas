'use client';

import { Copy, RefreshCcw, Trophy } from 'lucide-react';
import Link from 'next/link';
import type { DebateResult } from '@/lib/types';

interface ResultCardProps {
  result: DebateResult;
}

export function ResultCard({ result }: ResultCardProps) {
  async function copyQuote() {
    await navigator.clipboard?.writeText(result.quote);
  }

  return (
    <section className="animate-popIn rounded-[18px] border border-fuchsia-400/28 bg-[linear-gradient(135deg,rgba(91,33,182,0.22),rgba(15,23,42,0.92))] p-5 shadow-[0_0_30px_rgba(123,92,255,0.2),0_24px_60px_rgba(8,10,24,0.34)]">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Trophy className="h-4 w-4 text-fuchsia-300" />
        裁判亮牌
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-[12px] font-medium text-white/55">本场胜者</div>
          <div className="mt-2 text-[20px] font-semibold text-white">{result.winner}</div>
          <p className="mt-3 rounded-2xl border border-fuchsia-400/18 bg-fuchsia-500/10 px-3 py-3 text-[13px] leading-6 text-fuchsia-50">
            “{result.quote}”
          </p>
        </div>
        <div className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="text-[12px] font-medium text-white/55">最终建议</div>
          <p className="mt-2 text-[14px] leading-6 text-white/86">{result.finalAdvice}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="button" onClick={copyQuote} className="arena-ghost-button">
              <Copy className="h-4 w-4" />
              复制金句
            </button>
            <Link href="/" className="arena-ghost-button">
              <RefreshCcw className="h-4 w-4" />
              再开一局
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
