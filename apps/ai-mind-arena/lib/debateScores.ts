import type { DebateResult, DebateScore, Persona } from './types';

export function buildDebateScores(
  personas: Persona[] | null | undefined,
  liveScores: DebateScore[] | null | undefined,
  result: DebateResult | undefined,
): DebateScore[] {
  const safePersonas = Array.isArray(personas) ? personas : [];
  const safeLiveScores = Array.isArray(liveScores) ? liveScores : [];
  const resultScores = result && Array.isArray(result.scores) ? result.scores : [];

  if (safeLiveScores.length > 0) {
    return safePersonas.map((persona) => {
      const matched =
        safeLiveScores.find((score) => score.personaId === persona.id) ||
        safeLiveScores.find((score) => score.persona === persona.name);
      const scoreValue = matched ? matched.score : 0;
      const judgeScore = matched && typeof matched.judgeScore === 'number' ? matched.judgeScore : 0;
      const audienceScore =
        matched && typeof matched.audienceScore === 'number' ? matched.audienceScore : 0;
      const judgeNote = matched?.judgeNote || '等待裁判给分';
      return {
        persona: persona.name,
        personaId: persona.id,
        score: clampScore(scoreValue),
        judgeScore: clampScore(judgeScore),
        audienceScore: clampScore(audienceScore),
        judgeNote,
      };
    });
  }

  if (resultScores.length > 0) {
    return safePersonas.map((persona) => {
      const matched = resultScores.find((score) => score.persona === persona.name);
      const scoreValue = matched ? matched.score : 0;
      return {
        persona: persona.name,
        personaId: persona.id,
        score: clampScore(scoreValue),
        judgeScore: clampScore(scoreValue),
        audienceScore: 0,
        judgeNote: '最终裁决已出炉',
      };
    });
  }

  return safePersonas.map((persona) => ({
    persona: persona.name,
    personaId: persona.id,
    score: 0,
    judgeScore: 0,
    audienceScore: 0,
    judgeNote: '等待裁判给分',
  }));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(Math.round(score), 100));
}
