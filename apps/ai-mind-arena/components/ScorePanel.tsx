import { TrendingUp } from 'lucide-react';
import type { DebateResult, DebateSession } from '@/lib/types';

interface ScorePanelProps {
  session: DebateSession;
  result?: DebateResult;
  currentRound: number;
}

export function ScorePanel({ session, result, currentRound }: ScorePanelProps) {
  const scores =
    result?.scores ||
    session.personas.map((persona, index) => ({
      persona: persona.name,
      score: Math.max(12, 30 - index * 4),
    }));

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <aside className="h-full bg-[#210733] px-7 py-8 text-white">
      <div className="flex items-center gap-3 text-3xl font-black text-cyan-300">
        <TrendingUp className="h-8 w-8" />
        当前战况
      </div>
      <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-cyan-300 to-transparent" />

      <section className="mt-8 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 p-6 shadow-lg">
        <div className="text-sm font-black text-white/85">当前轮次</div>
        <div className="mt-2 text-5xl font-black">Round {Math.max(currentRound, 1)}</div>
      </section>

      <div className="mt-7 space-y-4">
        {sortedScores.map((score, index) => {
          const persona = session.personas.find((item) => item.name === score.persona);
          return (
            <div key={score.persona} className="rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-arena-yellow text-lg font-black text-arena-purple">
                  {index + 1}
                </span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-2xl">
                  {persona?.avatar || '🧠'}
                </span>
                <span className="flex-1 text-lg font-black">{score.persona}</span>
                <span className="text-2xl font-black text-cyan-300">{score.score}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full border border-white/15 bg-black/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-arena-yellow via-pink-400 to-cyan-300"
                  style={{ width: `${Math.min(score.score, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border-2 border-arena-yellow/60 bg-yellow-950/40 p-5">
        <h3 className="text-xl font-black text-arena-yellow">⚡ 金句候选</h3>
        <div className="mt-4 space-y-3 text-sm font-bold leading-6">
          {(result?.quote
            ? [result.quote]
            : session.personas.map((persona) => persona.catchphrase).slice(0, 3)
          ).map((quote) => (
            <p key={quote} className="rounded-xl bg-black/20 px-4 py-3">
              “{quote}”
            </p>
          ))}
        </div>
      </section>
    </aside>
  );
}
