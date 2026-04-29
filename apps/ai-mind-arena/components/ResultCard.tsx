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
    <section className="mt-10 animate-popIn rounded-3xl border-4 border-arena-yellow bg-gradient-to-br from-yellow-300 to-orange-500 p-7 text-arena-ink shadow-glow">
      <div className="flex items-center gap-3 text-3xl font-black">
        <Trophy className="h-9 w-9" />
        裁判亮牌
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-2xl bg-white/65 p-5">
          <div className="text-sm font-black text-purple-700">本场胜者</div>
          <div className="mt-2 text-4xl font-black text-purple-800">{result.winner}</div>
          <p className="mt-4 rounded-2xl bg-purple-700 px-4 py-3 text-lg font-black text-white">
            “{result.quote}”
          </p>
        </div>
        <div className="rounded-2xl bg-white/65 p-5">
          <div className="text-sm font-black text-purple-700">最终建议</div>
          <p className="mt-2 text-xl font-black leading-9 text-purple-950">{result.finalAdvice}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyQuote}
              className="inline-flex items-center gap-2 rounded-full bg-purple-700 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
            >
              <Copy className="h-4 w-4" />
              复制金句
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-arena-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
            >
              <RefreshCcw className="h-4 w-4" />
              再开一局
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
