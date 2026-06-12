export function buildAssistantFailureMessage(reply: string, detail: string) {
  const fallback = reply.trim();
  if (fallback) {
    return fallback;
  }

  return `刚才没有连接上生活助理。你可以稍后重试，我会继续基于天气、计划和打卡来安排。(${detail})`;
}
