'use client';

import { Flame, Lightbulb, Loader2 } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="relative z-10">
      <div className="sticker-panel mx-auto mt-10 max-w-5xl px-10 py-10 text-arena-purple">
        <div className="absolute -left-5 -top-8 animate-floaty text-6xl drop-shadow-lg">☁️</div>
        <div className="absolute -right-2 -top-4 animate-floaty text-5xl drop-shadow-lg">✨</div>

        <label htmlFor="topic" className="sr-only">
          纠结问题
        </label>
        <div className="relative">
          <input
            id="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="比如：我要不要裸辞创业？"
            className="h-24 w-full rounded-2xl border-4 border-purple-300 bg-white/80 px-8 pr-20 text-3xl font-black text-arena-purple outline-none transition placeholder:text-purple-300 focus:border-arena-yellow focus:ring-8 focus:ring-yellow-200/70"
          />
          <span className="absolute right-8 top-1/2 -translate-y-1/2 text-4xl">🤔</span>
        </div>

        <div className="mt-7 flex items-center gap-3 text-lg font-black text-purple-600">
          <Lightbulb className="h-5 w-5 text-arena-yellow" />
          热门纠结问题
          <div className="h-1 flex-1 rounded-full bg-purple-200" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {hotTopics.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTopic(item)}
              className="rounded-full border-2 border-purple-200 bg-purple-100 px-4 py-3 text-base font-black text-purple-700 shadow-[0_4px_0_rgba(123,60,255,.22)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <ModeSelector value={mode} onChange={setMode} />

      <div className="mt-14 flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={disabled}
          className="relative h-24 min-w-96 overflow-hidden rounded-full border-4 border-arena-yellow bg-gradient-to-r from-fuchsia-600 to-orange-500 px-16 text-4xl font-black text-white shadow-glow transition enabled:hover:-translate-y-1 enabled:hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-xl animate-shine" />
          <span className="relative inline-flex items-center gap-5">
            {submitting ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <Flame className="h-10 w-10" />
            )}
            开始开吵
            <Flame className="h-10 w-10" />
          </span>
        </button>
        {error ? (
          <p className="rounded-full bg-red-500/80 px-5 py-2 text-sm font-bold text-white">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
