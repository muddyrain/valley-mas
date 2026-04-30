import { TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { getPersonaAsset, getPersonaTone } from '@/lib/personaTheme';
import type { DebateResult, DebateScore, DebateSession } from '@/lib/types';

interface ScorePanelProps {
  session: DebateSession;
  result?: DebateResult;
  currentRound: number;
  scores: DebateScore[];
}

export function ScorePanel({ session, result, currentRound, scores }: ScorePanelProps) {
  const personas = Array.isArray(session.personas) ? session.personas : [];
  const supportHistory = Array.isArray(session.supportHistory) ? session.supportHistory : [];
  const latestSupport = supportHistory.at(-1);
  const sortedScores = [...(scores || [])].sort((a, b) => b.score - a.score);
  const quoteCandidates = result?.quote
    ? [result.quote]
    : personas.map((persona) => persona.catchphrase).slice(0, 3);

  return (
    <aside className="arena-panel flex min-h-0 flex-col gap-4 px-4 py-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[18px] font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-fuchsia-300" />
            当前战况
          </div>
          <p className="mt-1 text-[12px] leading-5 text-white/50">按发言内容实时测算支持率</p>
        </div>
        <span className="arena-chip">Round {Math.max(currentRound, 1)}</span>
      </div>

      <section className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(123,92,255,0.18)]">
        <div className="text-[12px] font-medium text-white/55">发言轮次</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="text-[30px] font-semibold leading-none text-white">
            {Math.max(currentRound, 1)}
            <span className="ml-1 text-[15px] text-white/45">/ 3</span>
          </div>
          <div className="text-right text-[12px] leading-5 text-white/45">
            {result ? '裁判已亮牌' : '辩论直播中'}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_10px_rgba(255,77,157,0.6)]"
            style={{ width: `${Math.min((Math.max(currentRound, 1) / 3) * 100, 100)}%` }}
          />
        </div>
      </section>

      <section className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(123,92,255,0.18)] flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-white">支持率走势</div>
          <span className="text-[12px] text-white/42">{result ? '最终结果' : '内容测算中'}</span>
        </div>
        <div className="thin-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {sortedScores.length === 0 ? (
            <div className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-4 text-[12px] leading-5 text-white/48">
              人格发言后开始按内容测算支持率。
            </div>
          ) : (
            sortedScores.map((score, index) => {
              const persona = personas.find((item) => item.name === score.persona);
              const tone = getPersonaTone(persona?.color);
              const avatarSrc = getPersonaAsset(score.persona, persona?.color);
              return (
                <div
                  key={score.persona}
                  className={`rounded-lg border p-3 transition hover:bg-white/5 ${tone.surface}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-white/12 bg-white/[0.06] text-[12px] font-semibold text-white/72">
                      {index + 1}
                    </span>
                    <span
                      className={`grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.3)] ${tone.avatar}`}
                    >
                      <Image
                        src={avatarSrc}
                        alt={score.persona}
                        className="h-full w-full object-cover"
                        sizes="40px"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-white">
                        {score.persona}
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_10px_rgba(255,77,157,0.6)] ${tone.bar}`}
                          style={{ width: `${Math.min(score.score, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-[13px] font-semibold ${tone.accentText}`}>
                      {score.score}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(123,92,255,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-white">你的站队</h3>
          <span className="text-[12px] text-white/42">
            {supportHistory.length > 0 ? `${supportHistory.length} 次表态` : '尚未表态'}
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {latestSupport ? (
            <div className="rounded-2xl border border-fuchsia-400/18 bg-[linear-gradient(135deg,rgba(168,85,247,0.14),rgba(236,72,153,0.08))] px-3 py-3 text-[12px] leading-5 text-white/78 shadow-[0_0_16px_rgba(255,77,157,0.12)]">
              {latestSupport.skipped
                ? `上一轮你先跳过了站队，所有人格还在抢你的票。`
                : `上一轮你更支持 ${latestSupport.personaName}，下一轮他们会围着这个偏好继续开火。`}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3 text-[12px] leading-5 text-white/48">
              每轮结束后，你都可以临时站队一次，看看谁最会说服你。
            </div>
          )}
          {supportHistory.map((choice) => (
            <div
              key={`${choice.round}-${choice.personaId || 'skip'}`}
              className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5 text-[12px] leading-5 text-white/66"
            >
              Round {choice.round}
              {choice.skipped ? ' · 你先保留态度' : ` · 你支持了 ${choice.personaName}`}
            </div>
          ))}
        </div>
      </section>

      <section className="arena-subpanel border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-[0_0_20px_rgba(123,92,255,0.18)]">
        <h3 className="text-[15px] font-semibold text-white">金句候选</h3>
        <div className="mt-3 space-y-2.5">
          {quoteCandidates.map((quote) => (
            <p
              key={quote}
              className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5 text-[12px] leading-5 text-white/72"
            >
              “{quote}”
            </p>
          ))}
          {!result?.quote && personas.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5 text-[12px] leading-5 text-white/45">
              口头禅生成后会在这里点亮。
            </p>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
