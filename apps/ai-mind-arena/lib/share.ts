import type { DebateResult, DebateSession } from './types';

export function buildShareText(session: DebateSession, result: DebateResult) {
  return [
    `脑内会议室裁判结果：${result.winner} 胜出`,
    `议题：${session.topic}`,
    `建议：${result.finalAdvice}`,
    `金句：${result.quote}`,
    typeof window === 'undefined' ? '' : window.location.href,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function shareDebateResult(session: DebateSession, result: DebateResult) {
  const text = buildShareText(session, result);
  const title = `脑内会议室：${session.topic}`;

  if (navigator.share) {
    await navigator.share({ title, text });
    return 'shared';
  }

  await navigator.clipboard?.writeText(text);
  return 'copied';
}
