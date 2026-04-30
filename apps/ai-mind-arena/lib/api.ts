import type {
  CreateDebateRequest,
  CreateDebateResponse,
  DebateResult,
  DebateSession,
  SubmitRoundSupportRequest,
} from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8080';

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.message || `请求失败：${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createDebate(data: CreateDebateRequest) {
  return requestJSON<CreateDebateResponse>('/api/v1/mind-arena/debates', {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(normalizeCreateDebateResponse);
}

export function getDebate(id: string) {
  return requestJSON<DebateSession>(`/api/v1/mind-arena/debates/${id}`).then(
    normalizeDebateSession,
  );
}

export function getDebateStreamURL(id: string) {
  return `${API_BASE_URL}/api/v1/mind-arena/debates/${id}/stream`;
}

export function submitRoundSupport(id: string, data: SubmitRoundSupportRequest) {
  return requestJSON<DebateSession>(`/api/v1/mind-arena/debates/${id}/support`, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(normalizeDebateSession);
}

function normalizeCreateDebateResponse(response: CreateDebateResponse): CreateDebateResponse {
  return {
    ...response,
    personaCount: response.personaCount ?? normalizedPersonaCount(response.personas),
    currentRound: response.currentRound ?? 1,
    personas: Array.isArray(response.personas) ? response.personas : [],
  };
}

function normalizeDebateSession(session: DebateSession): DebateSession {
  const personas = Array.isArray(session.personas) ? session.personas : [];
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const supportHistory = Array.isArray(session.supportHistory) ? session.supportHistory : [];
  const liveScores = Array.isArray(session.liveScores) ? session.liveScores : [];
  return {
    ...session,
    personaCount: session.personaCount ?? normalizedPersonaCount(personas),
    currentRound: session.currentRound ?? (messages.at(-1)?.round || 1),
    lastCompletedRound: session.lastCompletedRound ?? messages.at(-1)?.round ?? 0,
    awaitingSupport: Boolean(session.awaitingSupport),
    awaitingSupportRound: session.awaitingSupportRound ?? 0,
    personas,
    messages,
    liveScores,
    overtimePersonaIds: Array.isArray(session.overtimePersonaIds) ? session.overtimePersonaIds : [],
    supportHistory,
    result: session.result ? normalizeDebateResult(session.result) : undefined,
  };
}

function normalizeDebateResult(result: DebateResult): DebateResult {
  return {
    ...result,
    scores: Array.isArray(result.scores) ? result.scores : [],
  };
}

function normalizedPersonaCount(personas: unknown) {
  return Array.isArray(personas) && personas.length > 0 ? personas.length : 5;
}
