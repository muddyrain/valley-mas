import type { DebateMessage, DebateResult, DebateScore, Persona } from './types';

export function buildDebateScores(
  personas: Persona[] | null | undefined,
  messages: DebateMessage[] | null | undefined,
  result?: DebateResult,
): DebateScore[] {
  const safePersonas = Array.isArray(personas) ? personas : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const resultScores = Array.isArray(result?.scores) ? result.scores : [];

  if (resultScores.length) {
    return safePersonas.map((persona, index) => {
      const matched = resultScores.find((score) => score.persona === persona.name);
      return {
        persona: persona.name,
        score: clampScore(matched?.score ?? fallbackScore(index)),
      };
    });
  }

  if (safeMessages.length === 0) {
    return safePersonas.map((persona) => ({
      persona: persona.name,
      score: 0,
    }));
  }

  const totalMessages = safeMessages.length;
  return safePersonas.map((persona, index) => {
    const personaMessages = safeMessages.filter((message) => message.personaId === persona.id);
    if (personaMessages.length === 0) {
      return {
        persona: persona.name,
        score: 0,
      };
    }

    const latestRound = personaMessages.at(-1)?.round || 0;
    const messageShare = personaMessages.length / totalMessages;
    const orderMomentum = Math.max(0, 8 - index * 2);
    const activity = Math.round(messageShare * 58);
    const progress = latestRound * 10;

    return {
      persona: persona.name,
      score: clampScore(orderMomentum + activity + progress),
    };
  });
}

function fallbackScore(index: number) {
  return Math.max(12, 30 - index * 4);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(Math.round(score), 100));
}
