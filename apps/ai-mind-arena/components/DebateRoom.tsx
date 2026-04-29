'use client';

import { ArrowLeft, Loader2, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDebate, getDebateStreamURL } from '@/lib/api';
import type { DebateMessage, DebateResult, DebateSession, DebateSSEEvent } from '@/lib/types';
import { DebateBubble } from './DebateBubble';
import { PersonaCard } from './PersonaCard';
import { ResultCard } from './ResultCard';
import { ScorePanel } from './ScorePanel';

interface DebateRoomProps {
  initialSession: DebateSession;
}

export function DebateRoom({ initialSession }: DebateRoomProps) {
  const [session, setSession] = useState(initialSession);
  const [messages, setMessages] = useState<DebateMessage[]>(initialSession.messages || []);
  const [result, setResult] = useState<DebateResult | undefined>(initialSession.result);
  const [statusText, setStatusText] = useState('脑内评委团正在入场...');
  const [activePersonaId, setActivePersonaId] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);

  const currentRound = messages.at(-1)?.round || (session.status === 'created' ? 1 : 3);

  const scoreMap = useMemo(() => {
    const base = new Map<string, number>();
    session.personas.forEach((persona, index) =>
      base.set(persona.name, Math.max(10, 30 - index * 5)),
    );
    result?.scores.forEach((score) => base.set(score.persona, score.score));
    return base;
  }, [result?.scores, session.personas]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, result]);

  useEffect(() => {
    if (initialSession.status === 'done') return;

    const source = new EventSource(getDebateStreamURL(initialSession.id));

    source.addEventListener('message', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as DebateSSEEvent;
      if (!payload.personaId || !payload.personaName || !payload.content) return;
      const personaId = payload.personaId;
      const personaName = payload.personaName;
      const content = payload.content;
      setActivePersonaId(personaId);
      setStatusText(`${personaName} 正在发言...`);
      setMessages((prev) => {
        const exists = prev.some(
          (message) =>
            message.round === payload.round &&
            message.personaId === personaId &&
            message.content === content,
        );
        if (exists) return prev;
        return [
          ...prev,
          {
            id: `${personaId}-${payload.round}-${prev.length}`,
            round: payload.round || 1,
            roundTitle: payload.roundTitle || '立场表达',
            personaId,
            personaName,
            content,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    });

    source.addEventListener('judge', (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as DebateSSEEvent;
      setResult(payload.result);
      setActivePersonaId(undefined);
      setStatusText('裁判团正在亮牌');
    });

    source.addEventListener('done', async () => {
      source.close();
      setStatusText('辩论结束，金句已出炉');
      const latest = await getDebate(initialSession.id);
      setSession(latest);
      setMessages(latest.messages || []);
      setResult(latest.result);
    });

    source.addEventListener('error', (event) => {
      const messageEvent = event as MessageEvent<string>;
      if (typeof messageEvent.data === 'string' && messageEvent.data) {
        const payload = JSON.parse(messageEvent.data) as DebateSSEEvent;
        setStatusText(payload.message || '流式连接中断');
      } else {
        setStatusText('连接评委席失败，请刷新重试');
      }
      source.close();
    });

    return () => source.close();
  }, [initialSession.id, initialSession.status]);

  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<number, DebateMessage[]>>((acc, message) => {
      acc[message.round] = acc[message.round] || [];
      acc[message.round].push(message);
      return acc;
    }, {});
  }, [messages]);

  return (
    <main className="arena-shell p-4">
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1540px] overflow-hidden rounded-3xl border border-white/10 bg-[#2d1265]/80 shadow-2xl backdrop-blur xl:grid-cols-[390px_minmax(0,1fr)_380px]">
        <aside className="thin-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto bg-[#16072d] px-7 py-8">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/18"
          >
            <ArrowLeft className="h-4 w-4" />
            回到开场
          </Link>
          <h2 className="text-3xl font-black text-arena-yellow">🎭 本场嘉宾</h2>
          <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-arena-yellow to-transparent" />
          <div className="mt-7 space-y-5">
            {session.personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                active={activePersonaId === persona.id}
                score={scoreMap.get(persona.name)}
              />
            ))}
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-2rem)] flex-col border-x-4 border-arena-yellow bg-[#4d1f85]">
          <header className="border-b-4 border-arena-yellow bg-gradient-to-r from-pink-500 via-purple-600 to-blue-600 px-10 py-9">
            <div className="flex items-center gap-3 text-xl font-black text-white/80">
              <Megaphone className="h-7 w-7" />
              本场议题
            </div>
            <h1 className="mt-3 text-5xl font-black leading-tight text-white">{session.topic}</h1>
          </header>

          <div
            ref={listRef}
            className="thin-scrollbar flex-1 space-y-10 overflow-y-auto px-10 py-10"
          >
            {[1, 2, 3].map((round) => {
              const roundMessages = groupedMessages[round] || [];
              if (roundMessages.length === 0 && round > currentRound) return null;
              return (
                <section key={round}>
                  <div className="mb-8 flex items-center gap-4">
                    <div className="h-px flex-1 border-t-2 border-dashed border-arena-yellow/45" />
                    <div className="rounded-full bg-gradient-to-r from-pink-500 to-blue-600 px-16 py-5 text-4xl font-black text-white shadow-lg">
                      Round {round} ·{' '}
                      {roundMessages[0]?.roundTitle ||
                        ['立场表达', '互相反驳', '最终陈词'][round - 1]}
                    </div>
                    <div className="h-px flex-1 border-t-2 border-dashed border-arena-yellow/45" />
                  </div>
                  <div className="space-y-7">
                    {roundMessages.map((message) => (
                      <DebateBubble
                        key={message.id}
                        message={message}
                        persona={session.personas.find(
                          (persona) => persona.id === message.personaId,
                        )}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {!result ? (
              <div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-white/10 px-8 py-4 text-xl font-black text-white/70">
                <Loader2 className="h-6 w-6 animate-spin" />
                {statusText}
              </div>
            ) : (
              <ResultCard result={result} />
            )}
          </div>
        </section>

        <ScorePanel session={session} result={result} currentRound={currentRound} />
      </div>
    </main>
  );
}
