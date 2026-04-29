'use client';

import { Flame, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createDebate } from '@/lib/api';
import type { DebateMode } from '@/lib/types';
import { ModeSelector } from './ModeSelector';

const hotTopics = [
  '我要不要裸辞创业？',
  '要不要跟前任复合？',
  '该不该买这个包？',
  '要不要接受降薪换工作？',
  '周末该加班还是摆烂？',
  '要不要向喜欢的人表白？',
  '该不该辞职考研？',
  '要不要买房上车？',
];

export function TopicForm() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<DebateMode>('serious');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedTopic = topic.trim();
  const disabled = !trimmedTopic || submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    setSubmitting(true);
    setError('');
    try {
      const debate = await createDebate({ topic: trimmedTopic, mode, personaCount: 5 });
      router.push(`/debate/${debate.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '开场失败，评委团还在化妆');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative z-10 mx-auto mt-4 max-w-[1200px]">
      <div className="rounded-[28px] border border-purple-400/40 bg-[linear-gradient(180deg,rgba(18,14,46,0.88),rgba(12,13,34,0.9))] px-7 py-4 shadow-[0_0_30px_rgba(123,92,255,0.2),0_24px_70px_rgba(12,8,32,0.34)]">
        <label htmlFor="topic" className="sr-only">
          纠结问题
        </label>
        <div className="relative">
          <input
            id="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder=""
            className="h-[68px] w-full rounded-2xl border border-purple-400/30 bg-white/5 px-5 pr-20 text-[17px] font-semibold text-white outline-none backdrop-blur-md transition shadow-[0_0_30px_rgba(123,92,255,0.2)] focus:border-purple-300/60 focus:ring-2 focus:ring-purple-500/50 focus:shadow-[0_0_20px_rgba(123,92,255,0.4)]"
          />
          {!topic ? (
            <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-[17px] font-semibold">
              <span className="text-fuchsia-500 ml-1">比如：</span>
              <span className="ml-2 text-white/92">我要不要裸辞创业？</span>
            </div>
          ) : null}
          <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[40px] leading-none">
            🤔
          </span>
        </div>

        <div className="mt-6 flex items-center gap-3 text-[14px] font-semibold text-fuchsia-300">
          <Flame className="h-4 w-4" />
          热门纠结问题
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3">
          {hotTopics.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTopic(item)}
              className="rounded-full border border-purple-400/50 bg-purple-500/5 bg-[linear-gradient(180deg,rgba(85,41,159,0.28),rgba(54,27,103,0.2))] px-4 py-3.5 text-sm text-white/90 transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-500/10 font-bold hover:shadow-[0_0_12px_rgba(123,92,255,0.3)]"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <ModeSelector value={mode} onChange={setMode} />

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="relative h-14 w-[320px] overflow-hidden rounded-full border border-[#ffd18a] bg-gradient-to-r from-[#7B5CFF] via-[#FF4D9D] to-[#FF9A5A] px-10 text-[18px] font-semibold tracking-[0.04em] text-white shadow-[0_0_40px_rgba(255,77,157,0.6)] transition enabled:hover:scale-105 enabled:hover:shadow-[0_0_60px_rgba(255,77,157,0.8)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-xl animate-shine" />
          <span className="relative inline-flex h-full items-center gap-5">
            {submitting ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Flame className="h-7 w-7" />
            )}
            开始开吵
            <Flame className="h-7 w-7" />
          </span>
        </button>
        <div className="flex items-center gap-2 text-[13px] text-white/56">
          <span className="h-3 w-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.9)]" />
          AI 正在等待你的问题...
        </div>
        {error ? (
          <p className="rounded-full border border-red-400/30 bg-red-500/18 px-4 py-2 text-[12px] font-medium text-red-100">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
