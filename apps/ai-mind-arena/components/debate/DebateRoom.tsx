'use client';

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Megaphone,
  Radio,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HomeToolbar } from '@/components/home/HomeToolbar';
import { getDebate, getDebateStreamURL, submitRoundSupport } from '@/lib/api';
import { useAudio } from '@/lib/audioProvider';
import {
  appendUniqueDebateMessage,
  buildMessageFromSSEEvent,
  parseDebateSSEEvent,
} from '@/lib/debateEvents';
import { buildDebateScores } from '@/lib/debateScores';
import type {
  DebateMessage,
  DebateResult,
  DebateScore,
  DebateSession,
  Persona,
  RoundSupportChoice,
} from '@/lib/types';
import { DebateBubble } from './DebateBubble';
import { DebateStatePanel } from './DebateStatePanel';
import { PersonaCard } from './PersonaCard';
import { ResultCard } from './ResultCard';
import { ScorePanel } from './ScorePanel';

interface DebateRoomProps {
  initialSession: DebateSession;
}

const baseRoundLabels = ['立场表达', '交锋与结盟', '最终陈词'];

const modeLabels: Record<DebateSession['mode'], string> = {
  serious: '理性裁决',
  funny: '整活模式',
  sharp: '锋芒对线',
  wild: '脑洞失控',
  workplace: '职场会诊',
  emotion: '情绪会诊',
};

function normalizeSupportHistory(history: DebateSession['supportHistory']): RoundSupportChoice[] {
  return Array.isArray(history) ? history : [];
}

function roundLabel(round: number) {
  if (round <= baseRoundLabels.length) {
    return baseRoundLabels[Math.max(round - 1, 0)];
  }
  return `加时赛 ${round - 3}`;
}

function getNextSpeaker(personas: Persona[], personaId: string, round: number) {
  const currentIndex = personas.findIndex((persona) => persona.id === personaId);
  if (currentIndex < 0 || personas.length === 0) return undefined;
  if (currentIndex < personas.length - 1) return personas[currentIndex + 1];
  if (round !== 3) return personas[0];
  return undefined;
}

function getRoundStageLabel(session: DebateSession, fallbackRound: number) {
  if (session.awaitingSupport) {
    const supportRound = session.awaitingSupportRound || fallbackRound || 1;
    return supportRound > 3
      ? `加时赛 ${supportRound - 3} · 站队时刻`
      : `Round ${supportRound} · 站队时刻`;
  }
  const round = session.currentRound || fallbackRound || 1;
  if (round > 3) {
    return `加时赛 ${round - 3} · ${roundLabel(round)}`;
  }
  return `Round ${Math.max(round, 1)} · ${roundLabel(round)}`;
}

function resolveActiveRoundPersonas(
  personas: Persona[],
  round: number,
  overtimePersonaIds?: string[] | null,
) {
  if (round <= 3 || !Array.isArray(overtimePersonaIds) || overtimePersonaIds.length < 2) {
    return personas;
  }
  const idSet = new Set(overtimePersonaIds);
  const active = personas.filter((persona) => idSet.has(persona.id));
  return active.length >= 2 ? active : personas;
}

export function DebateRoom({ initialSession }: DebateRoomProps) {
  const { playEntrance, playSpeak } = useAudio();
  const [session, setSession] = useState(initialSession);
  const [messages, setMessages] = useState<DebateMessage[]>(initialSession.messages || []);
  const [result, setResult] = useState<DebateResult | undefined>(initialSession.result);
  const [statusText, setStatusText] = useState('脑内评委团正在入场...');
  const [streamError, setStreamError] = useState('');
  const [activePersonaId, setActivePersonaId] = useState<string | undefined>();
  const [selectedSupportPersonaId, setSelectedSupportPersonaId] = useState<string>('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  // 连接状态：connecting | connected | stale | disconnected
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'stale' | 'disconnected'>(
    'connecting',
  );
  const [reconnectKey, setReconnectKey] = useState(0);
  // 不可恢复的错误（status=failed），重连无意义，引导用户重开话题
  const [isFatalError, setIsFatalError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const personasRef = useRef<Persona[]>([]);
  const lastEventAtRef = useRef<number>(Date.now());

  const personas = useMemo(
    () => (Array.isArray(session.personas) ? session.personas : []),
    [session.personas],
  );
  const safeSession = useMemo(
    () => ({
      ...session,
      personaCount: session.personaCount ?? Math.max(personas.length, 5),
      currentRound: session.currentRound ?? (messages.at(-1)?.round || 1),
      lastCompletedRound: session.lastCompletedRound ?? messages.at(-1)?.round ?? 0,
      awaitingSupport: Boolean(session.awaitingSupport),
      awaitingSupportRound: session.awaitingSupportRound ?? 0,
      personas,
      messages,
      liveScores: Array.isArray(session.liveScores) ? session.liveScores : [],
      overtimePersonaIds: Array.isArray(session.overtimePersonaIds)
        ? session.overtimePersonaIds
        : [],
      supportHistory: normalizeSupportHistory(session.supportHistory),
    }),
    [messages, personas, session],
  );
  const personaTargetCount = Math.max(safeSession.personaCount || 5, personas.length, 1);
  const hasAllPersonas = personas.length >= personaTargetCount;
  const isPreparingPersonas = !hasAllPersonas && messages.length === 0 && !result && !streamError;
  const isPreparingFirstMessage =
    hasAllPersonas && messages.length === 0 && !result && !streamError;
  const currentRound = messages.at(-1)?.round || safeSession.currentRound || 1;
  const supportHistory = normalizeSupportHistory(safeSession.supportHistory);
  const latestSupport = supportHistory.at(-1);
  const supportPromptRound = safeSession.awaitingSupportRound || 0;
  const isAwaitingSupport = Boolean(safeSession.awaitingSupport && supportPromptRound > 0);
  const supportCandidates = useMemo(
    () =>
      resolveActiveRoundPersonas(
        personas,
        supportPromptRound || currentRound,
        safeSession.overtimePersonaIds,
      ),
    [currentRound, personas, safeSession.overtimePersonaIds, supportPromptRound],
  );
  const liveScores = useMemo<DebateScore[]>(
    () => buildDebateScores(personas, safeSession.liveScores, result),
    [personas, result, safeSession.liveScores],
  );

  const scoreMap = useMemo(() => {
    const base = new Map<string, number>();
    liveScores.map((score) => base.set(score.persona, score.score));
    return base;
  }, [liveScores]);

  useEffect(() => {
    personasRef.current = personas;
  }, [personas]);

  useEffect(() => {
    if (result) {
      setStatusText('辩论结束，金句已出炉');
      return;
    }
    if (isAwaitingSupport) {
      setStatusText(
        supportPromptRound > 3
          ? `加时赛 ${supportPromptRound - 3} 结束，轮到你选这一轮更支持谁。`
          : `Round ${supportPromptRound} 结束，轮到你选这一轮更支持谁。`,
      );
      setActivePersonaId(undefined);
    }
  }, [isAwaitingSupport, result, supportPromptRound]);

  useEffect(() => {
    const shouldScroll = messages.length > 0 || Boolean(result);
    if (!shouldScroll) return;

    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, result]);

  useEffect(() => {
    if (safeSession.status === 'done' || result) return;
    if (safeSession.awaitingSupport) return;

    // failed：直接展示错误，不创建 EventSource
    if (safeSession.status === 'failed') {
      const errMsg = session.error || '辩论因错误中止，请重新开场';
      setIsFatalError(true);
      setConnState('disconnected');
      setStreamError(errMsg);
      setStatusText(errMsg);
      return;
    }

    setConnState('connecting');
    lastEventAtRef.current = Date.now();
    // reconnectKey 变化时会触发 effect 重新执行，实现手动重连
    void reconnectKey;
    const source = new EventSource(getDebateStreamURL(initialSession.id));

    // ── 心跳检测：每 8s 检查一次是否超过 20s 没收到任何事件 ──
    const STALE_MS = 20_000;
    const DEAD_MS = 45_000;
    const heartbeatTimer = setInterval(() => {
      const silent = Date.now() - lastEventAtRef.current;
      if (silent > DEAD_MS) {
        setIsFatalError(false);
        setConnState('disconnected');
        setStreamError('连接超时，可以试试重新连接');
        setStatusText('连接超时，可以试试重新连接');
        source.close();
        clearInterval(heartbeatTimer);
      } else if (silent > STALE_MS) {
        setConnState('stale');
      }
    }, 8_000);

    function markAlive() {
      lastEventAtRef.current = Date.now();
      setConnState('connected');
      setStreamError('');
    }

    source.addEventListener('personas', (event) => {
      markAlive();
      const payload = parseDebateSSEEvent(event as MessageEvent<string>);
      if (!payload) return;
      const nextPersonas = Array.isArray(payload.personas) ? payload.personas : [];
      if (nextPersonas.length === 0) return;
      const latestPersona = nextPersonas.at(-1);
      const targetCount = payload.personaCount || initialSession.personaCount || 5;
      setStreamError('');
      setActivePersonaId(
        nextPersonas.length >= targetCount ? nextPersonas[0]?.id : latestPersona?.id,
      );
      setSession((prev) => ({
        ...prev,
        personaCount: targetCount,
        personas: nextPersonas,
      }));
      setStatusText(
        nextPersonas.length >= targetCount
          ? '五位人格已入场，第一位正在组织发言...'
          : latestPersona
            ? `${latestPersona.name} 已入场，正在准备出场口号...`
            : '人格设定同步中...',
      );
      playEntrance();
    });

    source.addEventListener('message', (event) => {
      markAlive();
      const payload = parseDebateSSEEvent(event as MessageEvent<string>);
      if (!payload || !payload.personaId || !payload.personaName || !payload.content) return;

      setStreamError('');
      const nextSpeaker = getNextSpeaker(
        resolveActiveRoundPersonas(
          personasRef.current,
          payload.round || 1,
          payload.overtimePersonaIds || safeSession.overtimePersonaIds,
        ),
        payload.personaId,
        payload.round || 1,
      );
      setActivePersonaId(nextSpeaker?.id);
      setStatusText(
        nextSpeaker
          ? `${payload.personaName} 已发言，${nextSpeaker.name} 接棒中...`
          : `${payload.personaName} 已发言，本轮总结后轮到你站队...`,
      );
      setSession((prev) => ({
        ...prev,
        currentRound: payload.round ?? prev.currentRound ?? 1,
        liveScores: Array.isArray(payload.scores) ? payload.scores : prev.liveScores,
        neutralJudge: payload.neutralJudge ?? prev.neutralJudge,
        overtimePersonaIds: Array.isArray(payload.overtimePersonaIds)
          ? payload.overtimePersonaIds
          : prev.overtimePersonaIds,
      }));
      setMessages((prev) => {
        const message = buildMessageFromSSEEvent(payload, prev.length);
        if (!message) return prev;
        return appendUniqueDebateMessage(prev, message);
      });
      playSpeak();
    });

    source.addEventListener('support_prompt', (event) => {
      markAlive();
      const payload = parseDebateSSEEvent(event as MessageEvent<string>);
      if (!payload) return;
      setStreamError('');
      setActivePersonaId(undefined);
      setSelectedSupportPersonaId('');
      setSession((prev) => ({
        ...prev,
        currentRound: payload.currentRound ?? prev.currentRound ?? 1,
        awaitingSupport: payload.awaitingSupport ?? true,
        awaitingSupportRound: payload.awaitingSupportRound ?? payload.round ?? 0,
        liveScores: Array.isArray(payload.scores) ? payload.scores : prev.liveScores,
        neutralJudge: payload.neutralJudge ?? prev.neutralJudge,
        overtimePersonaIds: Array.isArray(payload.overtimePersonaIds)
          ? payload.overtimePersonaIds
          : prev.overtimePersonaIds,
        supportHistory: Array.isArray(payload.supportHistory)
          ? payload.supportHistory
          : prev.supportHistory,
        personas:
          Array.isArray(payload.personas) && payload.personas.length > 0
            ? payload.personas
            : prev.personas,
      }));
      setStatusText(
        (payload.round || 1) > 3
          ? `加时赛 ${(payload.round || 1) - 3} 结束，轮到你站队了。`
          : `Round ${payload.round || 1} 结束，轮到你站队了。`,
      );
      source.close();
    });

    source.addEventListener('judge', (event) => {
      markAlive();
      const payload = parseDebateSSEEvent(event as MessageEvent<string>);
      if (!payload || !payload.result) return;
      setStreamError('');
      setResult(payload.result);
      setActivePersonaId(undefined);
      setStatusText('裁判团正在亮牌');
    });

    source.addEventListener('done', async () => {
      markAlive();
      source.close();
      clearInterval(heartbeatTimer);
      setStatusText('辩论结束，金句已出炉');
      const latest = await getDebate(initialSession.id);
      setSession(latest);
      setMessages(latest.messages || []);
      setResult(latest.result);
    });

    source.addEventListener('error', (event) => {
      if (source.readyState === EventSource.CLOSED) return;
      const payload = parseDebateSSEEvent(event as MessageEvent<string>);
      const rawMessage = payload ? payload.message : '';
      // 过滤掉后端技术报错（含 http 地址、Go 错误格式等），只展示用户友好文案
      const isTechnical =
        !rawMessage ||
        /https?:\/\//i.test(rawMessage) ||
        /context canceled|EOF|dial tcp|connection refused|upstream request failed/i.test(
          rawMessage,
        );
      const nextError = isTechnical ? '连接出了点问题，可以试试重新连接' : rawMessage;
      setIsFatalError(false);
      setConnState('disconnected');
      setStreamError(nextError);
      setStatusText(nextError);
      source.close();
      clearInterval(heartbeatTimer);
    });

    return () => {
      source.close();
      clearInterval(heartbeatTimer);
    };
  }, [
    initialSession.id,
    initialSession.personaCount,
    result,
    reconnectKey,
    safeSession.awaitingSupport,
    safeSession.overtimePersonaIds,
    safeSession.status,
    session.error,
    playEntrance,
    playSpeak,
  ]);

  const groupedMessages = useMemo(() => {
    return messages.reduce<Record<number, DebateMessage[]>>((acc, message) => {
      acc[message.round] = acc[message.round] || [];
      acc[message.round].push(message);
      return acc;
    }, {});
  }, [messages]);

  async function handleSubmitSupport(skip = false) {
    if (!skip && !selectedSupportPersonaId) return;
    if (!supportPromptRound) return;

    setIsSubmittingSupport(true);
    setStreamError('');
    try {
      const latest = await submitRoundSupport(initialSession.id, {
        round: supportPromptRound,
        supportedPersonaId: skip ? undefined : selectedSupportPersonaId,
        skip,
      });
      setSession(latest);
      setMessages(latest.messages || []);
      setResult(latest.result);
      setSelectedSupportPersonaId('');
      setStatusText(
        skip ? '你先按下保留态度，下一轮人格马上继续争宠。' : '收到你的站队，下一轮正在重开麦...',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '站队提交失败，请重试';
      setStreamError(message);
      setStatusText(message);
    } finally {
      setIsSubmittingSupport(false);
    }
  }

  return (
    <main className="arena-shell arena-debate-page h-screen overflow-hidden px-3 py-3 xl:px-4 xl:py-4">
      <div className="arena-debate-frame relative z-10 mx-auto flex h-full max-w-[1880px] flex-col gap-3 xl:gap-4">
        <header className="arena-panel arena-debate-header flex items-center justify-between gap-4 border-purple-400/20 px-4 py-3 shadow-[0_0_30px_rgba(123,92,255,0.2)] xl:px-5 xl:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-fuchsia-400/35 bg-[linear-gradient(135deg,rgba(168,85,247,0.28),rgba(99,102,241,0.14),rgba(236,72,153,0.22))] shadow-[0_0_30px_rgba(123,92,255,0.2)]">
              <Image src="/logo.svg" width={44} height={44} alt="Brain Circuit" />
            </div>
            <div className="flex items-center">
              <div className="truncate text-xl font-semibold leading-none text-white">
                脑内会议室
              </div>
              <div className="ml-3 text-md leading-none text-zinc-400">AI人格对战场</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 连接状态指示器 */}
            {!result &&
              !safeSession.awaitingSupport &&
              (connState === 'disconnected' ? (
                <button
                  type="button"
                  onClick={() => {
                    setStreamError('');
                    setConnState('connecting');
                    setReconnectKey((k) => k + 1);
                  }}
                  className="arena-chip border-red-400/50 bg-red-500/14 px-3 py-2 text-[12px] text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:border-red-400/80 transition-colors cursor-pointer"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                  已断开 · 点击重连
                </button>
              ) : connState === 'stale' ? (
                <button
                  type="button"
                  onClick={() => {
                    setStreamError('');
                    setConnState('connecting');
                    setReconnectKey((k) => k + 1);
                  }}
                  className="arena-chip border-amber-400/50 bg-amber-500/14 px-3 py-2 text-[12px] text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:border-amber-400/80 transition-colors cursor-pointer"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  响应迟缓 · 点击重连
                </button>
              ) : connState === 'connecting' ? (
                <span className="arena-chip border-violet-400/34 bg-violet-500/14 px-3 py-2 text-[12px] text-violet-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  连接中...
                </span>
              ) : (
                <span className="arena-chip hidden text-md sm:inline-flex py-2">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-300" />
                  {result ? '裁判已出结果' : '直播中'}
                </span>
              ))}
            {(result || safeSession.awaitingSupport) && (
              <span className="arena-chip hidden text-md sm:inline-flex py-2">
                <span className="h-2 w-2 rounded-full bg-fuchsia-300" />
                {result ? '裁判已出结果' : '直播中'}
              </span>
            )}
            <HomeToolbar />
            <Link href="/" className="arena-ghost-button text-md py-2">
              <ArrowLeft className="h-4 w-4" />
              <span>返回开场</span>
            </Link>
          </div>
        </header>

        <div className="arena-debate-grid grid min-h-0 flex-1 gap-3 xl:gap-4">
          <aside className="arena-panel flex min-h-0 flex-col border-purple-400/20 px-3 py-3 shadow-[0_0_30px_rgba(123,92,255,0.2)] xl:px-4 xl:py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold text-white">本场嘉宾</h2>
                <p className="mt-1 text-[12px] leading-5 text-white/50">观点阵营与发言状态</p>
              </div>
              <span className="arena-chip">
                {personas.length}/{personaTargetCount} 位
              </span>
            </div>
            <div className="thin-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {personas.length === 0 ? (
                <div className="arena-subpanel flex h-full min-h-[220px] flex-col items-center justify-center border-purple-400/20 bg-white/[0.03] px-5 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-fuchsia-300/24 bg-fuchsia-500/12 text-fuchsia-100 shadow-[0_0_20px_rgba(255,77,157,0.24)]">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <p className="mt-4 text-[14px] font-semibold text-white">人格设定中</p>
                  <p className="mt-2 text-[12px] leading-5 text-white/50">嘉宾生成后会陆续入场。</p>
                </div>
              ) : (
                personas.map((persona) => (
                  <PersonaCard
                    key={persona.id}
                    persona={persona}
                    active={activePersonaId === persona.id}
                    score={scoreMap.get(persona.name)}
                  />
                ))
              )}
            </div>
          </aside>

          <section className="arena-panel flex min-h-0 flex-col overflow-hidden border-purple-400/20 shadow-[0_0_30px_rgba(123,92,255,0.2)]">
            <header className="border-b border-white/8 px-4 pb-3 pt-4 xl:pb-4 xl:pt-5">
              <div className="flex items-center gap-2 text-[14px] font-medium text-fuchsia-100">
                <Megaphone className="h-4 w-4" />
                本次议题
              </div>
              <div className="mb-3 mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-purple-400/30 bg-gradient-to-r from-purple-500/30 to-pink-500/30 px-4 py-3 shadow-[0_0_30px_rgba(255,77,157,0.6)] backdrop-blur-lg xl:mb-4 xl:mt-4">
                <h1 className="min-w-0 flex-1 text-base font-bold tracking-wide text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.16)]">
                  {session.topic}
                </h1>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-fuchsia-300/26 bg-black/15 px-3 py-1.5 text-[12px] font-medium text-fuchsia-50 shadow-[0_0_12px_rgba(255,77,157,0.18)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                  辩论风格：{modeLabels[session.mode]}
                </span>
              </div>
            </header>

            <div className="px-4 pt-3 xl:pt-4">
              <div className="arena-subpanel flex items-center justify-between gap-3 border-purple-400/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-3 shadow-[0_0_20px_rgba(123,92,255,0.24)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[12px] text-white/48">
                    <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
                    当前阶段
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-white">
                    {getRoundStageLabel(safeSession, currentRound)}
                  </div>
                </div>
                <div className="max-w-[48%] text-right text-[12px] leading-5 text-white/55">
                  {statusText}
                </div>
              </div>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-3 pr-2 pt-3 xl:pb-4 xl:pt-4">
              <div className="space-y-4 xl:space-y-5">
                {Array.from(
                  new Set([
                    ...Object.keys(groupedMessages).map((key) => Number(key)),
                    ...(currentRound > 0 ? [currentRound] : []),
                  ]),
                )
                  .filter((round) => round > 0)
                  .sort((a, b) => a - b)
                  .map((round) => {
                    const roundMessages = groupedMessages[round] || [];
                    if (roundMessages.length === 0 && round > currentRound) return null;
                    return (
                      <section key={round} className="space-y-3">
                        <div className="sticky top-0 z-10 -mx-1 bg-[linear-gradient(180deg,rgba(15,12,34,0.96),rgba(15,12,34,0.78),transparent)] px-1 pb-2 pt-1 backdrop-blur-sm">
                          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/24 bg-fuchsia-500/12 px-3 py-1.5 text-[12px] font-medium text-fuchsia-50 shadow-[0_0_12px_rgba(255,77,157,0.18)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                            {round > 3 ? `加时赛 ${round - 3}` : `Round ${round}`}
                            <span className="text-white/48">
                              {roundMessages[0]?.roundTitle || roundLabel(round)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {roundMessages.map((message) => (
                            <DebateBubble
                              key={message.id}
                              message={message}
                              persona={personas.find((persona) => persona.id === message.personaId)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}

                {streamError ? (
                  <DebateStatePanel
                    icon={<AlertTriangle className="h-5 w-5" />}
                    title={isFatalError ? '这场会议已无法继续' : '连接出了点问题'}
                    description={
                      isFatalError
                        ? 'AI 评委团在准备阶段遭遇了技术故障，这场会议无法恢复。换个新话题重新开一场吧！'
                        : '与后台的连接意外中断，可以先试试重新连接，若还是不行就换个新话题。'
                    }
                  >
                    {!isFatalError && (
                      <button
                        type="button"
                        onClick={() => {
                          setStreamError('');
                          setConnState('connecting');
                          setReconnectKey((k) => k + 1);
                        }}
                        className="arena-ghost-button"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        重新连接
                      </button>
                    )}
                    <Link href="/" className="arena-ghost-button">
                      <Sparkles className="h-4 w-4" />
                      换个新话题
                    </Link>
                  </DebateStatePanel>
                ) : !result ? (
                  <DebateStatePanel
                    icon={
                      messages.length === 0 ? (
                        <Radio className="h-5 w-5" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      )
                    }
                    title={
                      isPreparingPersonas
                        ? '正在定义本场人格'
                        : isPreparingFirstMessage
                          ? '第一轮发言准备中'
                          : isAwaitingSupport
                            ? supportPromptRound > 3
                              ? `加时赛 ${supportPromptRound - 3} 已结束`
                              : `Round ${supportPromptRound} 已结束`
                            : statusText
                    }
                    description={
                      isPreparingPersonas
                        ? `已入场 ${personas.length}/${personaTargetCount} 位，全部到齐后自动开始第一轮。`
                        : isPreparingFirstMessage
                          ? '五位人格已到齐，理性派正在组织第一句开场。'
                          : isAwaitingSupport
                            ? '选一个你这一轮更支持的人格，或先跳过，下一轮才会继续。'
                            : '支持率会随着每次发言持续刷新。'
                    }
                  />
                ) : (
                  <ResultCard session={safeSession} result={result} />
                )}
                {isAwaitingSupport ? (
                  <div className="sticky bottom-3 z-20 mt-4 xl:mt-5">
                    <div className="arena-subpanel border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(22,18,49,0.96),rgba(59,21,84,0.82))] px-4 py-3 shadow-[0_0_30px_rgba(255,77,157,0.18)] backdrop-blur-xl xl:py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-fuchsia-100">
                            <CheckCircle2 className="h-4 w-4 text-fuchsia-300" />
                            这一轮你更支持谁？
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-white/58">
                            你选完后，下一轮他们会围着你的偏好继续争宠。
                          </p>
                          {latestSupport ? (
                            <p className="mt-2 text-[12px] leading-5 text-white/48">
                              {latestSupport.skipped
                                ? '上一轮你暂时没有站队。'
                                : `上一轮你支持了 ${latestSupport.personaName}。`}
                            </p>
                          ) : null}
                        </div>
                        <span className="arena-chip">
                          {supportPromptRound > 3
                            ? `加时赛 ${supportPromptRound - 3}`
                            : `Round ${supportPromptRound}`}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {supportCandidates.map((persona) => {
                          const active = selectedSupportPersonaId === persona.id;
                          return (
                            <button
                              key={persona.id}
                              type="button"
                              disabled={isSubmittingSupport}
                              onClick={() => setSelectedSupportPersonaId(persona.id)}
                              className={`rounded-2xl border px-4 py-3 text-left transition ${
                                active
                                  ? 'border-fuchsia-300/60 bg-fuchsia-500/18 shadow-[0_0_20px_rgba(255,77,157,0.2)]'
                                  : 'border-white/10 bg-white/[0.04] hover:border-fuchsia-300/30 hover:bg-white/[0.06]'
                              } disabled:cursor-not-allowed disabled:opacity-70`}
                            >
                              <div className="text-[14px] font-semibold text-white">
                                {persona.name}
                              </div>
                              <div className="mt-1 text-[12px] leading-5 text-white/55">
                                {persona.stance}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          disabled={isSubmittingSupport}
                          onClick={() => handleSubmitSupport(true)}
                          className="arena-ghost-button disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSubmittingSupport ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          先跳过本站队
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingSupport || !selectedSupportPersonaId}
                          onClick={() => handleSubmitSupport(false)}
                          className="arena-chip border-fuchsia-300/30 bg-[linear-gradient(135deg,rgba(217,70,239,0.22),rgba(168,85,247,0.2))] px-4 py-2 text-[13px] text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSubmittingSupport ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : null}
                          锁定这一票，继续下一轮
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>
          </section>

          <ScorePanel
            session={safeSession}
            result={result}
            currentRound={isAwaitingSupport ? supportPromptRound : currentRound}
            scores={liveScores}
          />
        </div>
      </div>
    </main>
  );
}
