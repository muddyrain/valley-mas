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

  const rawScores = safePersonas.map((persona) => {
    const personaMessages = safeMessages.filter((message) => message.personaId === persona.id);
    if (personaMessages.length === 0) {
      return {
        persona: persona.name,
        raw: 0,
        active: false,
      };
    }

    const ownContents: string[] = [];
    const raw = personaMessages.reduce((total, message) => {
      const content = normalizeContent(message.content);
      if (!content) return total;

      const contentLength = [...content].length;
      const lengthScore = Math.min(contentLength, 36) * 0.35;
      const stanceScore = keywordHitScore(content, stanceKeywords, 3.5);
      const clarityScore = keywordHitScore(content, clarityKeywords, 2.5);
      const toneScore = keywordHitScore(content, toneKeywords, 2);
      const roundScore =
        message.round === 1
          ? keywordHitScore(content, openingKeywords, 4)
          : message.round === 2
            ? keywordHitScore(content, rebuttalKeywords, 6)
            : keywordHitScore(content, adviceKeywords, 6.5);
      const mentionScore =
        message.round === 2
          ? keywordHitScore(
              content,
              safePersonas
                .filter((candidate) => candidate.id !== persona.id)
                .map((candidate) => candidate.name),
              4.5,
            )
          : 0;
      const actionScore = message.round === 3 ? countActionSteps(content) * 3.5 : 0;
      const repetitionPenalty = ownContents.some((previous) => previous === content) ? 10 : 0;

      ownContents.push(content);

      return (
        total +
        roundBaseScore(message.round) +
        lengthScore +
        stanceScore +
        clarityScore +
        toneScore +
        roundScore +
        mentionScore +
        actionScore -
        repetitionPenalty
      );
    }, 0);

    const completionBonus = completedRounds(personaMessages) * 4;
    return {
      persona: persona.name,
      raw: raw + completionBonus,
      active: true,
    };
  });

  const activeScores = rawScores.filter((entry) => entry.active);
  const minRaw = activeScores.length > 0 ? Math.min(...activeScores.map((entry) => entry.raw)) : 0;
  const maxRaw = activeScores.length > 0 ? Math.max(...activeScores.map((entry) => entry.raw)) : 0;

  return rawScores.map((entry) => ({
    persona: entry.persona,
    score: entry.active ? normalizeLiveScore(entry.raw, minRaw, maxRaw) : 0,
  }));
}

function fallbackScore(index: number) {
  return Math.max(12, 30 - index * 4);
}

function normalizeContent(content: string) {
  return content.trim().replace(/\s+/g, '');
}

function roundBaseScore(round: number) {
  switch (round) {
    case 1:
      return 12;
    case 2:
      return 18;
    case 3:
      return 24;
    default:
      return 10;
  }
}

function completedRounds(messages: DebateMessage[]) {
  return new Set(messages.map((message) => message.round)).size;
}

function keywordHitScore(content: string, keywords: string[], weight: number) {
  return keywords.reduce(
    (score, keyword) => (content.includes(keyword) ? score + weight : score),
    0,
  );
}

function countActionSteps(content: string) {
  return actionStepKeywords.reduce(
    (count, keyword) => (content.includes(keyword) ? count + 1 : count),
    0,
  );
}

function normalizeLiveScore(raw: number, minRaw: number, maxRaw: number) {
  if (maxRaw <= minRaw) {
    return clampScore(52);
  }
  const normalized = 36 + ((raw - minRaw) / (maxRaw - minRaw)) * 56;
  return clampScore(normalized);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(Math.round(score), 100));
}

const stanceKeywords = ['支持', '反对', '建议', '主张', '结论', '不建议', '值得', '不值'];
const clarityKeywords = ['先', '再', '别', '但', '因为', '如果', '不是', '而是'];
const toneKeywords = ['风险', '现金流', '逃避', '上头', '机会', '稳定', '退路', '睡够'];
const openingKeywords = ['我', '先', '支持', '反对', '建议', '立场'];
const rebuttalKeywords = ['但', '别', '不是', '问题', '漏洞', '却', '可', '先别'];
const adviceKeywords = ['建议', '先', '再', '如果', '可以', '别', '结论', '方案'];
const actionStepKeywords = ['先', '再', '然后', '如果', '存够', '验证', '启动', '止损'];
